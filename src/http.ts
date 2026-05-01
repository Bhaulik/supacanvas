import { Hono } from "hono";
import {
  createPlate,
  updatePlate,
  getPlate,
  listPlates,
  deletePlate,
  listVersions,
  restoreVersion,
  listThemes,
  listAllTags,
  ensureLayout,
} from "./storage.ts";
import { renderPlateDoc, escapeHtml } from "./render.ts";
import { toMarkdown, toStandaloneHtml, toPrintHtml } from "./export.ts";
import { screenshotPlate, ChromeNotFoundError } from "./screenshot.ts";
import type { PlateMeta, SnapshotInfo } from "./types.ts";

export function buildApp() {
  const app = new Hono();

  app.get("/", async (c) => {
    const plates = await listPlates();
    const themes = await listThemes();
    return c.html(galleryHtml(plates, themes));
  });

  app.get("/p/:id", async (c) => {
    const plate = await getPlate(c.req.param("id"));
    if (!plate) return c.notFound();
    const themes = await listThemes();
    const versions = await listVersions(plate.meta.id);
    return c.html(viewerHtml(plate.meta, themes, versions));
  });

  // The actual plate content, served into a sandboxed iframe.
  app.get("/p/:id/raw", async (c) => {
    const plate = await getPlate(c.req.param("id"));
    if (!plate) return c.notFound();
    const doc = await renderPlateDoc(plate);
    c.header("Cache-Control", "no-store");
    return c.html(doc);
  });

  // ---- Exports ----

  app.get("/p/:id/export.md", async (c) => {
    const plate = await getPlate(c.req.param("id"));
    if (!plate) return c.notFound();
    c.header("Content-Type", "text/markdown; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${safeFilename(plate.meta.title)}.md"`);
    return c.body(toMarkdown(plate));
  });

  app.get("/p/:id/export.html", async (c) => {
    const plate = await getPlate(c.req.param("id"));
    if (!plate) return c.notFound();
    const html = await toStandaloneHtml(plate);
    c.header("Content-Type", "text/html; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${safeFilename(plate.meta.title)}.html"`);
    return c.body(html);
  });

  // Auto-print page — user gets the browser's native print sheet → Save as PDF.
  app.get("/p/:id/print", async (c) => {
    const plate = await getPlate(c.req.param("id"));
    if (!plate) return c.notFound();
    const html = await toPrintHtml(plate);
    c.header("Cache-Control", "no-store");
    return c.html(html);
  });

  app.get("/p/:id/screenshot.png", async (c) => {
    const plate = await getPlate(c.req.param("id"));
    if (!plate) return c.notFound();
    const w = c.req.query("w");
    const h = c.req.query("h");
    const dpr = c.req.query("dpr");
    try {
      const png = await screenshotPlate(plate, {
        width: w ? Number(w) : undefined,
        height: h ? Number(h) : undefined,
        deviceScaleFactor: dpr ? Number(dpr) : undefined,
        fullPage: c.req.query("full") === "1",
      });
      // Build the Response directly with an ArrayBuffer slice — Bun's TS lib
      // types disagree with DOM's BodyInit on Uint8Array generics, so going
      // via a clean ArrayBuffer avoids the type dance.
      const ab = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
      return new Response(ab, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
          "Content-Disposition": `inline; filename="${safeFilename(plate.meta.title)}.png"`,
        },
      });
    } catch (e) {
      const status = e instanceof ChromeNotFoundError ? 503 : 500;
      return c.json({ error: (e as Error).message }, status);
    }
  });

  // ---- JSON API ----

  app.get("/api/plates", async (c) => {
    const tag = c.req.query("tag") ?? undefined;
    const search = c.req.query("search") ?? undefined;
    return c.json(await listPlates({ tag, search }));
  });

  app.post("/api/plates", async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const meta = await createPlate({
      title: String(body.title ?? "Untitled"),
      html: String(body.html ?? ""),
      css: typeof body.css === "string" ? body.css : "",
      js: typeof body.js === "string" ? body.js : "",
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      theme: typeof body.theme === "string" ? body.theme : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      context: typeof body.context === "string" ? body.context : undefined,
      source: typeof body.source === "string" ? body.source : undefined,
    });
    return c.json(meta, 201);
  });

  app.get("/api/plates/:id", async (c) => {
    const plate = await getPlate(c.req.param("id"));
    if (!plate) return c.notFound();
    return c.json(plate);
  });

  app.patch("/api/plates/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    try {
      const result = await updatePlate(id, {
        title: typeof body.title === "string" ? body.title : undefined,
        html: typeof body.html === "string" ? body.html : undefined,
        css: typeof body.css === "string" ? body.css : undefined,
        js: typeof body.js === "string" ? body.js : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        theme: typeof body.theme === "string" ? body.theme : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        context: typeof body.context === "string" ? body.context : undefined,
        source: typeof body.source === "string" ? body.source : undefined,
      });
      return c.json(result);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  app.delete("/api/plates/:id", async (c) => {
    try {
      await deletePlate(c.req.param("id"));
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  app.get("/api/plates/:id/versions", async (c) => {
    return c.json(await listVersions(c.req.param("id")));
  });

  app.post("/api/plates/:id/restore", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const version = String(body.version ?? "");
    try {
      const result = await restoreVersion(id, version);
      return c.json(result);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  app.get("/api/themes", async (c) => c.json(await listThemes()));
  app.get("/api/tags", async (c) => c.json(await listAllTags()));

  return app;
}

export async function startServer(port: number): Promise<{ url: string; stop: () => void }> {
  await ensureLayout();
  const app = buildApp();
  const server = Bun.serve({ port, fetch: app.fetch });
  return {
    url: `http://localhost:${server.port}`,
    stop: () => server.stop(),
  };
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "plate";
}

// ---------------------------------------------------------------------------
// HTML templates — server-rendered, no client framework.
//
// Aesthetic: curatorial archive / specimen plates.
//   - Cream paper with subtle grain
//   - Display: Fraunces (italic), Body: General Sans, Mono: JetBrains Mono
//   - Single oxidized-red accent, used sparingly
//   - Hairline ink rules, generous breathing room
//   - Lexicon: tags → Subjects, versions → Revisions, id → Catalog №
// ---------------------------------------------------------------------------

const FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link href="https://api.fontshare.com/v2/css?f%5B%5D=general-sans@400,500,600&display=swap" rel="stylesheet">
`.trim();

const NOISE_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='280' height='280'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const SHARED_CSS = `
:root {
  --paper:    #f3eddf;
  --paper-2:  #ebe3d2;
  --card:     #fbf7ec;
  --ink:      #1a1814;
  --ink-2:    #3b362c;
  --muted:    #6a604c;          /* darkened: ~5.0:1 contrast on paper, passes AA */
  --muted-soft: #8a7e6a;        /* whisper text only — atmospheric, never important */
  --rule:     rgba(26, 24, 20, 0.22);
  --rule-2:   rgba(26, 24, 20, 0.45);
  --accent:   #b04a32;
  --accent-soft: rgba(176, 74, 50, 0.10);
  --serif:    "Fraunces", "Cormorant Garamond", Georgia, serif;
  --sans:     "General Sans", ui-sans-serif, -apple-system, "Helvetica Neue", sans-serif;
  --mono:     "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --easing:   cubic-bezier(0.2, 0.7, 0.15, 1);
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background-color: var(--paper);
  background-image: ${NOISE_BG};
  color: var(--ink);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -webkit-font-feature-settings: "ss01", "ss02";
  font-feature-settings: "ss01", "ss02";
}

a { color: inherit; text-decoration: none; border-bottom: 1px solid var(--rule); transition: border-color 180ms var(--easing), color 180ms var(--easing); }
a:hover { color: var(--accent); border-bottom-color: var(--accent); }

button, input, select, textarea {
  font: inherit; color: inherit;
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 6px 0;
  appearance: none;
}
input, select { border-bottom: 1px solid var(--rule); transition: border-color 180ms var(--easing); }
input:focus, select:focus { outline: none; border-bottom-color: var(--ink); }

button {
  cursor: pointer;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-2);
  font-weight: 500;
  border-bottom: 1px solid var(--rule);
  padding: 4px 0;
  transition: color 180ms var(--easing), border-color 180ms var(--easing);
}
button:hover { color: var(--accent); border-bottom-color: var(--accent); }
button.danger:hover { color: var(--accent); }

.eyebrow {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-2);          /* harder contrast — was --muted, was unreadable on cream */
  font-weight: 500;
}
.eyebrow.quiet { color: var(--muted); font-weight: 400; }
.mono { font-family: var(--mono); }
.serif { font-family: var(--serif); }
.italic { font-style: italic; }
.muted { color: var(--muted); }
hr { border: 0; border-top: 1px solid var(--rule); margin: 0; }

::selection { background: var(--accent); color: var(--card); }
`;

function pageShell(title: string, body: string, extraHead = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${FONT_LINKS}
<style>${SHARED_CSS}</style>
${extraHead}
</head>
<body>
${body}
</body>
</html>`;
}

interface GallerySummary {
  id: string;
  title: string;
  description: string;
  tags: string[];
  theme: string;
  source: string;
  updatedAt: string;
}

function galleryHtml(plates: GallerySummary[], _themes: string[]): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).toUpperCase();

  const total = plates.length;
  const totalPad = String(total).padStart(2, "0");

  const cards = plates.map((c, i) => {
    const plate = String(i + 1).padStart(2, "0");
    return `
    <a class="plate" href="/p/${encodeURIComponent(c.id)}" style="--i:${i}">
      <header class="plate-head">
        <span class="plate-no">PLATE Nº ${plate} / ${totalPad}</span>
        <span class="plate-date">${formatRelative(c.updatedAt)}</span>
      </header>
      ${c.source ? `<div class="plate-source" title="Authored by ${escapeHtml(c.source)}">via ${escapeHtml(c.source)}</div>` : ``}
      <div class="plate-frame">
        <iframe src="/p/${encodeURIComponent(c.id)}/raw" sandbox="allow-scripts" loading="lazy" tabindex="-1"></iframe>
        <div class="plate-frame-mask"></div>
      </div>
      <div class="plate-caption">
        <div class="plate-title">${escapeHtml(c.title)}</div>
        ${c.description
          ? `<div class="plate-blurb">${escapeHtml(c.description)}</div>`
          : ``}
        ${c.tags.length
          ? `<div class="plate-subjects">${c.tags.map(t => escapeHtml(t)).join(" · ")}</div>`
          : `<div class="plate-subjects muted">Unclassified</div>`}
        <div class="plate-catalog">№ ${escapeHtml(c.id)}</div>
      </div>
    </a>`;
  }).join("");

  const empty = total === 0 ? `
    <div class="empty">
      <div class="empty-rule"></div>
      <h2 class="serif italic">Awaiting first specimen.</h2>
      <p>Connect this archive to an AI client over MCP, then ask it to make something.</p>
      <pre class="recipe"><code>{
  "mcpServers": {
    "plate": { "command": "plate", "args": ["mcp"] }
  }
}</code></pre>
    </div>` : "";

  const body = `
<header class="masthead">
  <div class="masthead-row">
    <span class="eyebrow">PL ⁄ Plate ⁄ Vol. I</span>
    <span class="eyebrow">${today}</span>
  </div>
  <h1 class="masthead-title">
    <span class="title-roman">The</span>
    <span class="title-italic">Archive</span>
    <span class="title-mark">№</span>
  </h1>
  <div class="masthead-row masthead-meta">
    <span class="eyebrow">A live registry of AI-generated specimens — held on disk, viewable in browser.</span>
    <span class="eyebrow">${total} ${total === 1 ? "specimen" : "specimens"}</span>
  </div>
  <hr />
  <div class="toolbar">
    <input id="search" placeholder="Search the archive…" autocomplete="off" />
    <button id="new">+ Catalog blank</button>
  </div>
</header>

<main class="archive">
  ${empty}
  <section class="grid" id="grid">${cards}</section>
</main>

<footer class="footnote eyebrow">— FIN —</footer>

<style>
  .masthead { max-width: 1320px; margin: 0 auto; padding: 36px 48px 16px; }
  .masthead-row { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
  .masthead-row .eyebrow { font-size: 13px; }
  .masthead-meta .eyebrow:first-child {
    /* Subhead "A live registry of…" — primary content, not a label. */
    font-family: var(--mono);
    font-size: 13px;
    letter-spacing: 0.08em;
    color: var(--ink);
    font-weight: 500;
    max-width: 60ch;
  }
  .masthead-title {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(56px, 12vw, 168px);
    line-height: 0.92;
    letter-spacing: -0.035em;
    margin: 14px 0 16px;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.18em;
    color: var(--ink);
  }
  .masthead-title .title-roman { font-style: normal; font-weight: 300; }
  .masthead-title .title-italic { font-style: italic; font-weight: 400; }
  .masthead-title .title-mark { font-style: italic; color: var(--accent); font-size: 0.42em; align-self: flex-start; transform: translateY(0.5em); margin-left: 0.05em; }
  .masthead-meta { padding-bottom: 16px; }
  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 16px 0 4px; }
  .toolbar input { width: 320px; max-width: 60%; font-family: var(--serif); font-style: italic; font-size: 18px; }
  .toolbar input::placeholder { color: var(--muted); font-style: italic; }

  .archive { max-width: 1320px; margin: 0 auto; padding: 8px 48px 80px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 56px 40px;
    margin-top: 28px;
  }

  .plate {
    display: block;
    color: var(--ink);
    border-bottom: 0;
    transition: transform 220ms var(--easing);
    animation: rise 0.6s var(--easing) backwards;
    animation-delay: calc(var(--i, 0) * 35ms);
  }
  .plate:hover { transform: translateY(-3px); border-bottom: 0; }
  .plate-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 500;
    padding-bottom: 9px;
    border-bottom: 1px solid var(--rule);
  }
  .plate-frame {
    position: relative;
    aspect-ratio: 4 / 3;
    background: var(--card);
    border: 1px solid var(--rule-2);
    border-top: 0;
    overflow: hidden;
    transition: border-color 220ms var(--easing);
  }
  .plate:hover .plate-frame { border-color: var(--ink); }
  .plate-frame iframe {
    width: 200%; height: 200%; border: 0;
    transform: scale(0.5); transform-origin: 0 0;
    pointer-events: none;
    background: white;
  }
  .plate-frame-mask {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 70%, rgba(243, 237, 223, 0.2) 100%);
    pointer-events: none;
  }
  .plate-caption {
    padding-top: 14px;
    display: grid;
    gap: 6px;
  }
  .plate-title {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 400;
    font-size: 22px;
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--ink);
  }
  .plate-blurb {
    font-size: 14px;
    color: var(--ink-2);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .plate-subjects {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 500;
  }
  .plate-catalog {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-2);
    letter-spacing: 0.04em;
    margin-top: 2px;
  }
  .plate-source {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty {
    text-align: center;
    padding: 80px 20px 40px;
    color: var(--ink-2);
    grid-column: 1 / -1;
    margin-top: 24px;
  }
  .empty-rule { width: 60px; height: 1px; background: var(--rule-2); margin: 0 auto 28px; }
  .empty h2 { font-size: 38px; font-weight: 300; margin: 0 0 12px; color: var(--ink); }
  .empty p { color: var(--muted); margin: 0 auto 28px; max-width: 44ch; }
  .recipe {
    display: inline-block; text-align: left;
    background: var(--card);
    border: 1px solid var(--rule-2);
    padding: 14px 18px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-2);
  }

  .footnote {
    text-align: center;
    padding: 8px 0 48px;
    color: var(--muted);
  }

  @keyframes rise {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }

  @media (max-width: 720px) {
    .masthead, .archive { padding-left: 24px; padding-right: 24px; }
    .grid { gap: 40px 24px; }
  }
</style>

<script>
  const search = document.getElementById('search');
  const grid = document.getElementById('grid');
  search?.addEventListener('input', () => {
    const q = search.value.toLowerCase().trim();
    for (const card of grid.querySelectorAll('.plate')) {
      const text = card.textContent.toLowerCase();
      card.style.display = !q || text.includes(q) ? '' : 'none';
    }
  });
  document.getElementById('new')?.addEventListener('click', async () => {
    const title = prompt('Title?', 'Untitled');
    if (title === null) return;
    const res = await fetch('/api/plates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        html: '<main><h1>Hello</h1><p>Edit me.</p></main>',
        css: 'main { padding: 40px; font-family: system-ui; }',
        js: '',
      }),
    });
    if (res.ok) { const m = await res.json(); location.href = '/c/' + m.id; }
  });
</script>`;
  return pageShell("The Archive — Plate", body);
}

function viewerHtml(meta: PlateMeta, themes: string[], versions: SnapshotInfo[]): string {
  const themeOptions = themes.map(t =>
    `<option value="${escapeHtml(t)}"${t === meta.theme ? " selected" : ""}>${escapeHtml(t)}</option>`
  ).join("");

  const revisionItems = versions.length === 0
    ? `<div class="empty-note">No revisions on file. Snapshots appear after each AI edit.</div>`
    : versions.map(v => `
        <div class="revision">
          <div class="revision-meta">
            <code class="mono">${escapeHtml(formatVersion(v.version))}</code>
            ${v.source ? `<span class="revision-source">via ${escapeHtml(v.source)}</span>` : ``}
          </div>
          <button data-restore="${escapeHtml(v.version)}">Restore</button>
        </div>`).join("");

  const body = `
<header class="vbar">
  <a href="/" class="back">‹‹ Archive</a>
  <div class="vbar-center">
    <div class="eyebrow">PLATE — № ${escapeHtml(meta.id)}</div>
    <h1 id="title-display" class="serif italic">${escapeHtml(meta.title)}</h1>
  </div>
  <div class="vbar-right">
    <button id="rename">Rename</button>
    <button id="delete" class="danger">Discard</button>
  </div>
</header>

<main class="viewer">
  <section class="frame-wrap">
    <div class="frame-corner tl"></div>
    <div class="frame-corner tr"></div>
    <div class="frame-corner bl"></div>
    <div class="frame-corner br"></div>
    <button class="fs-btn" id="fs-btn" type="button" title="Fullscreen — F · Esc to exit"><span class="fs-icon"></span></button>
    <iframe id="frame" src="/p/${encodeURIComponent(meta.id)}/raw" sandbox="allow-scripts" allowfullscreen allow="fullscreen"></iframe>
  </section>

  <aside class="drawer">
    <section class="dsec">
      <div class="eyebrow">Description</div>
      <textarea id="description" rows="2" placeholder="One or two sentences. What is this plate?">${escapeHtml(meta.description)}</textarea>
    </section>

    <section class="dsec">
      <div class="dsec-head">
        <div class="eyebrow">Context</div>
        <button class="ctx-toggle" id="ctx-toggle" type="button">${meta.context ? "Hide" : "Show"}</button>
      </div>
      <textarea id="context" rows="6" class="${meta.context ? "" : "collapsed"}" placeholder="What data does this represent? Where is it sourced from? What should the next agent know?">${escapeHtml(meta.context)}</textarea>
    </section>

    <section class="dsec">
      <div class="eyebrow">Plate</div>
      <select id="theme">${themeOptions}</select>
    </section>

    <section class="dsec">
      <div class="eyebrow">Subjects</div>
      <div class="chip-input">
        <div class="chips" id="chips"></div>
        <input id="tag-add" placeholder="Add subject…" autocomplete="off" />
        <div class="chip-suggest" id="chip-suggest" hidden></div>
      </div>
    </section>

    <section class="dsec">
      <div class="dsec-head">
        <div class="eyebrow">Revisions</div>
        <span class="mono small muted">${versions.length}</span>
      </div>
      <div id="versions" class="revisions">${revisionItems}</div>
    </section>

    <section class="dsec">
      <div class="eyebrow">Export</div>
      <div class="export-row">
        <a href="/p/${encodeURIComponent(meta.id)}/export.md" class="export-link" download>Markdown</a>
        <a href="/p/${encodeURIComponent(meta.id)}/export.html" class="export-link" download>Standalone HTML</a>
        <a href="/p/${encodeURIComponent(meta.id)}/screenshot.png" class="export-link" target="_blank" rel="noopener">PNG (Screenshot)</a>
        <a href="/p/${encodeURIComponent(meta.id)}/print" class="export-link" target="_blank" rel="noopener">PDF (Print sheet)</a>
      </div>
      <div class="export-note">PDF opens the browser's print dialog — choose “Save as PDF.” PNG renders via headless Chrome (must be installed locally).</div>
    </section>

    <section class="dsec">
      <div class="eyebrow">Source</div>
      ${meta.source
        ? `<code class="mono source-tag">${escapeHtml(meta.source)}</code>`
        : `<div class="empty-note">No source recorded. AI tools should pass <code>source</code> on each edit.</div>`}
    </section>

    <section class="dsec">
      <div class="eyebrow">Catalog №</div>
      <code class="mono catalog" id="catalog">${escapeHtml(meta.id)}</code>
    </section>
  </aside>
</main>

<style>
  .vbar {
    display: grid;
    grid-template-columns: 200px 1fr 200px;
    align-items: center;
    gap: 24px;
    padding: 22px 36px 18px;
    border-bottom: 1px solid var(--rule);
    background: linear-gradient(180deg, var(--paper) 0%, var(--paper) 70%, transparent 100%);
    position: sticky; top: 0; z-index: 10;
    backdrop-filter: blur(6px);
  }
  .vbar .back { font-family: var(--mono); font-size: 12px; letter-spacing: 0.10em; text-transform: uppercase; color: var(--ink-2); font-weight: 500; border-bottom: 0; }
  .vbar .back:hover { color: var(--accent); }
  .vbar-center { text-align: center; }
  .vbar-center .eyebrow { font-size: 12px; }
  .vbar-center h1 { font-size: 28px; font-weight: 400; margin: 4px 0 0; line-height: 1.1; letter-spacing: -0.01em; color: var(--ink); }
  .vbar-right { display: flex; justify-content: flex-end; gap: 22px; }

  main.viewer {
    display: grid;
    grid-template-columns: 1fr 360px;
    min-height: calc(100vh - 78px);
  }

  .frame-wrap {
    position: relative;
    margin: 36px;
    background: white;
    border: 1px solid var(--rule-2);
    box-shadow:
      0 1px 0 rgba(26, 24, 20, 0.04),
      0 24px 48px -28px rgba(26, 24, 20, 0.18);
  }
  .frame-corner {
    position: absolute; width: 14px; height: 14px;
    border: 1px solid var(--ink);
    background: var(--paper);
  }
  .frame-corner.tl { top: -7px; left: -7px; }
  .frame-corner.tr { top: -7px; right: -7px; }
  .frame-corner.bl { bottom: -7px; left: -7px; }
  .frame-corner.br { bottom: -7px; right: -7px; }
  .frame-wrap iframe {
    display: block;
    width: 100%;
    height: calc(100vh - 78px - 72px);
    border: 0;
    background: white;
  }

  .drawer {
    border-left: 1px solid var(--rule);
    padding: 36px 32px;
    display: grid;
    grid-auto-rows: max-content;
    gap: 28px;
    align-content: start;
    background: linear-gradient(180deg, transparent 0%, rgba(235, 227, 210, 0.18) 100%);
  }
  .dsec { display: grid; gap: 10px; }
  .dsec .eyebrow { color: var(--muted); }
  .dsec-head { display: flex; align-items: baseline; justify-content: space-between; }

  /* Theme picker keeps the elegant italic-serif display — single short word like "default". */
  .dsec select { width: 100%; font-family: var(--serif); font-style: italic; font-size: 18px; padding-bottom: 6px; color: var(--ink); }

  /* Subjects/tags input goes upright sans for legibility — comma-separated labels read worse in italic. */
  .dsec input {
    width: 100%;
    font-family: var(--sans);
    font-style: normal;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink);
    padding: 4px 0 8px;
    letter-spacing: 0;
  }
  .dsec input::placeholder { color: var(--muted); font-style: normal; }

  .dsec textarea {
    width: 100%;
    font-family: var(--sans);
    font-style: normal;
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--rule-2);
    padding: 11px 13px;
    resize: vertical;
    min-height: 64px;
    transition: border-color 180ms var(--easing), box-shadow 180ms var(--easing);
  }
  .dsec textarea:focus { outline: none; border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink) inset; }
  .dsec textarea::placeholder { color: var(--muted); font-style: normal; }
  .dsec textarea.collapsed { display: none; }
  .ctx-toggle {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 500;
    border-bottom: 1px solid var(--rule);
    padding: 2px 0;
    cursor: pointer;
  }
  .ctx-toggle:hover { color: var(--accent); border-bottom-color: var(--accent); }
  .save-flash { color: var(--accent); font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0; transition: opacity 180ms var(--easing); margin-left: 8px; }
  .save-flash.on { opacity: 1; }

  /* ---- Chip-style tags ---- */
  .chip-input { display: grid; gap: 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 4px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 4px 4px 10px;
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--rule-2);
    border-radius: 999px;
    transition: border-color 180ms var(--easing), background 180ms var(--easing);
    font-weight: 500;
  }
  .chip:hover { border-color: var(--ink); }
  .chip-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    line-height: 1;
    font-size: 13px;
    color: var(--muted);
    cursor: pointer;
    border-radius: 999px;
    transition: color 180ms var(--easing), background 180ms var(--easing);
  }
  .chip-x:hover { color: var(--card); background: var(--accent); }
  .chip-input input#tag-add {
    border-bottom: 1px dashed var(--rule);
    padding: 6px 0;
  }
  .chip-input input#tag-add:focus { border-bottom: 1px solid var(--ink); border-bottom-style: solid; }
  .chip-suggest {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0 2px;
  }
  .chip-suggest .sg {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-2);
    background: transparent;
    border: 1px dashed var(--rule-2);
    border-radius: 999px;
    cursor: pointer;
    transition: color 180ms var(--easing), border-color 180ms var(--easing), border-style 180ms var(--easing);
  }
  .chip-suggest .sg:hover { color: var(--ink); border-color: var(--ink); border-style: solid; }
  .chip-suggest .sg .ct { color: var(--muted); font-size: 11px; }

  /* ---- Fullscreen toggle ---- */
  .fs-btn {
    position: absolute;
    top: 10px; right: 10px;
    z-index: 5;
    width: 34px; height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--rule-2);
    background: rgba(243, 237, 223, 0.9);
    backdrop-filter: blur(6px);
    color: var(--ink-2);
    font-family: var(--mono);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    border-radius: 999px;
    opacity: 0.55;
    transition: opacity 180ms var(--easing), color 180ms var(--easing), border-color 180ms var(--easing), transform 180ms var(--easing);
  }
  .frame-wrap:hover .fs-btn,
  .fs-btn:focus,
  body.is-immersive .fs-btn { opacity: 1; }
  .fs-btn:hover { color: var(--accent); border-color: var(--accent); transform: scale(1.06); }
  .fs-icon { display: inline-block; }
  body.is-immersive .fs-icon::before { content: "✕"; }
  body:not(.is-immersive) .fs-icon::before { content: "⤢"; }

  body.is-immersive { overflow: hidden; }
  body.is-immersive .vbar,
  body.is-immersive .drawer { display: none; }
  body.is-immersive main.viewer {
    grid-template-columns: 1fr;
    min-height: 100vh;
    height: 100vh;
  }
  body.is-immersive .frame-wrap {
    margin: 0;
    border: 0;
    box-shadow: none;
    height: 100vh;
  }
  body.is-immersive .frame-corner { display: none; }
  body.is-immersive .frame-wrap iframe { height: 100vh; }
  body.is-immersive .fs-btn {
    top: 16px; right: 16px;
    background: rgba(255, 255, 255, 0.92);
  }

  .revisions { display: grid; gap: 0; }
  .revision {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 12px 0;
    border-bottom: 1px solid var(--rule);
  }
  .revision:last-child { border-bottom: 0; }
  .revision-meta { display: grid; gap: 2px; min-width: 0; }
  .revision code { font-size: 12px; color: var(--ink-2); }
  .revision-source {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .revisions .empty-note { font-size: 13px; color: var(--muted); padding: 4px 0 2px; }
  .source-tag {
    display: inline-block;
    font-size: 13px;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--rule-2);
    border-radius: 999px;
    padding: 4px 12px;
    letter-spacing: 0.02em;
  }
  .dsec .empty-note { font-size: 13px; color: var(--muted); line-height: 1.5; }
  .dsec .empty-note code { font-family: var(--mono); font-size: 12px; padding: 1px 5px; background: var(--card); border: 1px solid var(--rule); border-radius: 4px; }

  .export-row { display: flex; flex-direction: column; gap: 0; padding-top: 4px; }
  .export-link {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
    color: var(--ink-2);
    font-weight: 500;
  }
  .export-link:first-child { border-top: 1px solid var(--rule); }
  .export-link:hover { color: var(--accent); border-bottom-color: var(--accent); }
  .export-note { font-size: 13px; line-height: 1.55; color: var(--muted); padding-top: 10px; }

  .catalog { font-size: 14px; color: var(--ink-2); cursor: copy; }
  .catalog:hover { color: var(--accent); }
  .catalog[data-copied] { color: var(--accent); }
  .catalog[data-copied]::after { content: " ✓ copied"; font-family: var(--mono); font-size: 12px; letter-spacing: 0.10em; text-transform: uppercase; }

  .small { font-size: 13px; }

  @media (max-width: 880px) {
    main.viewer { grid-template-columns: 1fr; }
    .drawer { border-left: 0; border-top: 1px solid var(--rule); }
    .frame-wrap iframe { height: 70vh; }
    .vbar { grid-template-columns: auto 1fr auto; padding: 18px 20px; }
  }
</style>

<script>
  const id = ${JSON.stringify(meta.id)};
  const frame = document.getElementById('frame');
  const reload = () => { frame.src = frame.src; };

  async function patch(body) {
    const res = await fetch('/api/plates/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) alert('save failed: ' + (await res.text()));
    return res.ok;
  }

  document.getElementById('theme').addEventListener('change', async (e) => {
    if (await patch({ theme: e.target.value })) reload();
  });

  function bindAutosave(el, field) {
    if (!el) return;
    let last = el.value;
    el.addEventListener('blur', async () => {
      if (el.value === last) return;
      if (await patch({ [field]: el.value })) {
        last = el.value;
      }
    });
  }
  bindAutosave(document.getElementById('description'), 'description');
  bindAutosave(document.getElementById('context'), 'context');

  const ctxToggle = document.getElementById('ctx-toggle');
  const ctxArea = document.getElementById('context');
  ctxToggle?.addEventListener('click', () => {
    const collapsed = ctxArea.classList.toggle('collapsed');
    ctxToggle.textContent = collapsed ? 'Show' : 'Hide';
    if (!collapsed) ctxArea.focus();
  });

  // ---- Chip-style tag editor with autocomplete from the global corpus ----
  const tagState = { current: ${JSON.stringify(meta.tags)}, corpus: [] };
  const chipsEl = document.getElementById('chips');
  const tagAddEl = document.getElementById('tag-add');
  const suggestEl = document.getElementById('chip-suggest');

  const _esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const _norm = (s) => s.trim().toLowerCase().replace(/\\s+/g, '-').slice(0, 40);

  function renderChips() {
    chipsEl.innerHTML = tagState.current.map(t =>
      \`<span class="chip">\${_esc(t)}<span class="chip-x" data-remove="\${_esc(t)}" title="Remove">×</span></span>\`
    ).join('');
    chipsEl.querySelectorAll('[data-remove]').forEach(x => {
      x.addEventListener('click', (e) => { e.stopPropagation(); removeTag(x.dataset.remove); });
    });
  }

  async function commitTags() {
    await patch({ tags: tagState.current });
  }

  async function addTag(raw) {
    const t = _norm(raw);
    if (!t || tagState.current.includes(t)) return;
    tagState.current.push(t);
    renderChips();
    await commitTags();
    await loadCorpus();
    renderSuggestions();
  }

  async function removeTag(t) {
    tagState.current = tagState.current.filter(x => x !== t);
    renderChips();
    await commitTags();
    renderSuggestions();
  }

  tagAddEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && tagAddEl.value)) {
      if (tagAddEl.value.trim()) {
        e.preventDefault();
        addTag(tagAddEl.value);
        tagAddEl.value = '';
      }
    } else if (e.key === 'Backspace' && !tagAddEl.value && tagState.current.length) {
      removeTag(tagState.current[tagState.current.length - 1]);
    } else if (e.key === 'Escape') {
      tagAddEl.value = '';
      tagAddEl.blur();
      suggestEl.hidden = true;
    }
  });
  tagAddEl.addEventListener('input', renderSuggestions);
  tagAddEl.addEventListener('focus', renderSuggestions);
  tagAddEl.addEventListener('blur', () => { setTimeout(() => { suggestEl.hidden = true; }, 120); });

  async function loadCorpus() {
    try {
      const r = await fetch('/api/tags');
      if (r.ok) tagState.corpus = await r.json();
    } catch { /* ignore */ }
  }

  function renderSuggestions() {
    const q = tagAddEl.value.trim().toLowerCase();
    const used = new Set(tagState.current);
    const list = tagState.corpus
      .filter(t => !used.has(t.name) && (!q || t.name.includes(q)))
      .slice(0, 14);
    if (list.length === 0) { suggestEl.hidden = true; return; }
    suggestEl.hidden = false;
    suggestEl.innerHTML = list.map(t =>
      \`<span class="sg" data-add="\${_esc(t.name)}">\${_esc(t.name)}<span class="ct">\${t.count}</span></span>\`
    ).join('');
    suggestEl.querySelectorAll('[data-add]').forEach(x => {
      x.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addTag(x.dataset.add);
        tagAddEl.value = '';
        tagAddEl.focus();
      });
    });
  }

  renderChips();
  loadCorpus().then(renderSuggestions);

  // ---- Fullscreen toggle (layout-immersive — hides chrome, iframe goes 100vw × 100vh) ----
  const fsBtn = document.getElementById('fs-btn');
  function toggleImmersive(force) {
    const next = force === undefined ? !document.body.classList.contains('is-immersive') : force;
    document.body.classList.toggle('is-immersive', next);
  }
  fsBtn?.addEventListener('click', () => toggleImmersive());
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'Escape') { toggleImmersive(false); return; }
    if (!typing && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); toggleImmersive(); }
  });

  document.getElementById('rename').addEventListener('click', async () => {
    const next = prompt('New title?', document.getElementById('title-display').textContent);
    if (!next) return;
    if (await patch({ title: next })) {
      document.getElementById('title-display').textContent = next;
      document.title = next;
    }
  });

  document.getElementById('delete').addEventListener('click', async () => {
    if (!confirm('Move this specimen to the trash?')) return;
    const res = await fetch('/api/plates/' + encodeURIComponent(id), { method: 'DELETE' });
    if (res.ok) location.href = '/';
  });

  document.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const version = btn.getAttribute('data-restore');
      const res = await fetch('/api/plates/' + encodeURIComponent(id) + '/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (res.ok) location.reload();
    });
  });

  const catalog = document.getElementById('catalog');
  catalog?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(catalog.textContent); catalog.dataset.copied = '1'; setTimeout(() => delete catalog.dataset.copied, 900); } catch {}
  });
</script>`;
  return pageShell(meta.title + " — Archive", body);
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

function formatVersion(stamp: string): string {
  // 2026-05-01T16-09-59-484Z → 2026-05-01 · 16:09:59
  const m = stamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!m) return stamp;
  return `${m[1]} · ${m[2]}:${m[3]}:${m[4]}`;
}
