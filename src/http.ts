import { Hono } from "hono";
import {
  createCanvas,
  updateCanvas,
  getCanvas,
  listCanvases,
  deleteCanvas,
  listVersions,
  restoreVersion,
  listThemes,
  listAllTags,
  listFolders,
  renameFolder,
  ensureLayout,
} from "./storage.ts";
import { renderCanvasDoc, escapeHtml } from "./render.ts";
import { toMarkdown, toStandaloneHtml, toPrintHtml } from "./export.ts";
import { screenshotCanvas, ChromeNotFoundError } from "./screenshot.ts";
import { renderInstallPage } from "./install.ts";
import type { CanvasMeta, SnapshotInfo } from "./types.ts";

export function buildApp() {
  const app = new Hono();

  app.get("/", async (c) => {
    const folderQ = c.req.query("folder");
    const canvases = await listCanvases({
      folder: folderQ !== undefined ? folderQ : undefined,
      descendants: c.req.query("descendants") === "1",
    });
    const themes = await listThemes();
    const folders = await listFolders();
    return c.html(galleryHtml(canvases, themes, folders, folderQ ?? null));
  });

  app.get("/install", async (c) => {
    return c.html(pageShell("Install Supacanvas", renderInstallPage({ includeInstallStep: true })));
  });

  app.get("/c/:id", async (c) => {
    const canvas = await getCanvas(c.req.param("id"));
    if (!canvas) return c.notFound();
    const themes = await listThemes();
    const versions = await listVersions(canvas.meta.id);
    return c.html(viewerHtml(canvas.meta, themes, versions));
  });

  // The actual canvas content, served into a sandboxed iframe.
  app.get("/c/:id/raw", async (c) => {
    const canvas = await getCanvas(c.req.param("id"));
    if (!canvas) return c.notFound();
    const doc = await renderCanvasDoc(canvas);
    c.header("Cache-Control", "no-store");
    return c.html(doc);
  });

  // ---- Exports ----

  app.get("/c/:id/export.md", async (c) => {
    const canvas = await getCanvas(c.req.param("id"));
    if (!canvas) return c.notFound();
    c.header("Content-Type", "text/markdown; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${safeFilename(canvas.meta.title)}.md"`);
    return c.body(toMarkdown(canvas));
  });

  app.get("/c/:id/export.html", async (c) => {
    const canvas = await getCanvas(c.req.param("id"));
    if (!canvas) return c.notFound();
    const html = await toStandaloneHtml(canvas);
    c.header("Content-Type", "text/html; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${safeFilename(canvas.meta.title)}.html"`);
    return c.body(html);
  });

  // Auto-print page — user gets the browser's native print sheet → Save as PDF.
  app.get("/c/:id/print", async (c) => {
    const canvas = await getCanvas(c.req.param("id"));
    if (!canvas) return c.notFound();
    const html = await toPrintHtml(canvas);
    c.header("Cache-Control", "no-store");
    return c.html(html);
  });

  app.get("/c/:id/screenshot.png", async (c) => {
    const canvas = await getCanvas(c.req.param("id"));
    if (!canvas) return c.notFound();
    const w = c.req.query("w");
    const h = c.req.query("h");
    const dpr = c.req.query("dpr");
    try {
      const png = await screenshotCanvas(canvas, {
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
          "Content-Disposition": `inline; filename="${safeFilename(canvas.meta.title)}.png"`,
        },
      });
    } catch (e) {
      const status = e instanceof ChromeNotFoundError ? 503 : 500;
      return c.json({ error: (e as Error).message }, status);
    }
  });

  // ---- JSON API ----

  app.get("/api/canvases", async (c) => {
    const tag = c.req.query("tag") ?? undefined;
    const search = c.req.query("search") ?? undefined;
    const folder = c.req.query("folder");
    const descendants = c.req.query("descendants") === "1";
    return c.json(await listCanvases({ tag, search, folder: folder !== undefined ? folder : undefined, descendants }));
  });

  app.post("/api/canvases", async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const meta = await createCanvas({
      title: String(body.title ?? "Untitled"),
      html: String(body.html ?? ""),
      css: typeof body.css === "string" ? body.css : "",
      js: typeof body.js === "string" ? body.js : "",
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      theme: typeof body.theme === "string" ? body.theme : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      context: typeof body.context === "string" ? body.context : undefined,
      source: typeof body.source === "string" ? body.source : undefined,
      folder: typeof body.folder === "string" ? body.folder : undefined,
    });
    return c.json(meta, 201);
  });

  app.get("/api/canvases/:id", async (c) => {
    const canvas = await getCanvas(c.req.param("id"));
    if (!canvas) return c.notFound();
    return c.json(canvas);
  });

  app.patch("/api/canvases/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    try {
      const result = await updateCanvas(id, {
        title: typeof body.title === "string" ? body.title : undefined,
        html: typeof body.html === "string" ? body.html : undefined,
        css: typeof body.css === "string" ? body.css : undefined,
        js: typeof body.js === "string" ? body.js : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        theme: typeof body.theme === "string" ? body.theme : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        context: typeof body.context === "string" ? body.context : undefined,
        source: typeof body.source === "string" ? body.source : undefined,
      folder: typeof body.folder === "string" ? body.folder : undefined,
      });
      return c.json(result);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  app.delete("/api/canvases/:id", async (c) => {
    try {
      await deleteCanvas(c.req.param("id"));
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  app.get("/api/canvases/:id/versions", async (c) => {
    return c.json(await listVersions(c.req.param("id")));
  });

  app.post("/api/canvases/:id/restore", async (c) => {
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

  app.get("/api/folders", async (c) => c.json(await listFolders()));

  app.post("/api/folders/rename", async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const from = String(body.from ?? "");
    const to = String(body.to ?? "");
    try {
      const result = await renameFolder(from, to);
      return c.json(result);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

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
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "canvas";
}

// ---------------------------------------------------------------------------
// HTML templates — server-rendered, no client framework.
//
// Aesthetic: curatorial archive / specimen canvases.
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
  folder: string;
  updatedAt: string;
}

interface FolderEntry { name: string; count: number; }

function galleryHtml(canvases: GallerySummary[], _themes: string[], folders: FolderEntry[] = [], currentFolder: string | null = null): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).toUpperCase();

  const total = canvases.length;
  const totalPad = String(total).padStart(2, "0");

  const cards = canvases.map((c, i) => {
    const canvas = String(i + 1).padStart(2, "0");
    return `
    <a class="canvas" href="/c/${encodeURIComponent(c.id)}" style="--i:${i}" draggable="true" data-id="${escapeHtml(c.id)}" data-folder="${escapeHtml(c.folder)}">
      <header class="canvas-head">
        <span class="canvas-no">CANVAS Nº ${canvas} / ${totalPad}</span>
        <span class="canvas-date">${formatRelative(c.updatedAt)}</span>
      </header>
      ${c.source ? `<div class="canvas-source" title="Authored by ${escapeHtml(c.source)}">via ${escapeHtml(c.source)}</div>` : ``}
      <div class="canvas-frame">
        <iframe src="/c/${encodeURIComponent(c.id)}/raw" sandbox="allow-scripts" loading="lazy" tabindex="-1"></iframe>
        <div class="canvas-frame-mask"></div>
      </div>
      <div class="canvas-caption">
        <div class="canvas-title">${escapeHtml(c.title)}</div>
        ${c.description
          ? `<div class="canvas-blurb">${escapeHtml(c.description)}</div>`
          : ``}
        ${c.tags.length
          ? `<div class="canvas-subjects">${c.tags.map(t => escapeHtml(t)).join(" · ")}</div>`
          : `<div class="canvas-subjects muted">Unclassified</div>`}
        <div class="canvas-catalog">
          <span>№ ${escapeHtml(c.id)}</span>
          ${c.folder ? `<span class="canvas-folder">/${escapeHtml(c.folder)}</span>` : ``}
        </div>
      </div>
    </a>`;
  }).join("");

  // Folder filter row. "All" + "Unfiled" (root) + each named folder.
  const allActive = currentFolder === null;
  const rootActive = currentFolder === "";
  const folderChips = `
    <div class="folder-bar" id="folder-bar">
      <a class="folder-chip${allActive ? " active" : ""}" href="/" data-folder-target>All <span class="ct">${canvases.length || ""}</span></a>
      <a class="folder-chip${rootActive ? " active" : ""}" href="/?folder=" data-folder-target="">Unfiled${rootActive || allActive ? "" : ""}</a>
      ${folders.filter(f => f.name !== "").map(f => {
        const active = currentFolder !== null && currentFolder === f.name;
        return `<a class="folder-chip${active ? " active" : ""}" href="/?folder=${encodeURIComponent(f.name)}" data-folder-target="${escapeHtml(f.name)}">/${escapeHtml(f.name)} <span class="ct">${f.count}</span></a>`;
      }).join("")}
    </div>`;

  const empty = total === 0 ? `
    <div class="empty">
      <div class="empty-rule"></div>
      <h2 class="serif italic">Awaiting first specimen.</h2>
      <p>Connect this archive to an AI client over MCP, then ask it to make something.</p>
      <pre class="recipe"><code>{
  "mcpServers": {
    "canvas": { "command": "canvas", "args": ["mcp"] }
  }
}</code></pre>
    </div>` : "";

  const body = `
<header class="masthead">
  <div class="masthead-row">
    <span class="eyebrow">SC ⁄ Supacanvas ⁄ Vol. I</span>
    <span class="eyebrow">${today}</span>
  </div>
  <h1 class="masthead-title">
    <span class="title-roman">Supa</span>
    <span class="title-italic">Canvas</span>
    <span class="title-mark">№</span>
  </h1>
  <div class="masthead-row masthead-meta">
    <span class="eyebrow">Your AI-generated canvases — held on disk, viewable in browser, exportable anywhere.</span>
    <span class="eyebrow">${total} ${total === 1 ? "specimen" : "specimens"}</span>
  </div>
  <hr />
  <div class="toolbar">
    <input id="search" placeholder="Search the archive…" autocomplete="off" />
    <button id="new">+ Catalog blank</button>
  </div>
  ${folders.length > 0 ? folderChips : ""}
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

  /* Folder filter chips */
  .folder-bar {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    padding: 14px 0 4px;
  }
  .folder-chip {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--mono); font-size: 12px; font-weight: 500;
    letter-spacing: 0.04em; text-transform: lowercase;
    color: var(--ink-2); background: transparent;
    border: 1px solid var(--rule-2); border-radius: 999px;
    padding: 4px 11px; text-decoration: none; border-bottom: 1px solid var(--rule-2);
    transition: color 180ms var(--easing), border-color 180ms var(--easing), background 180ms var(--easing);
  }
  .folder-chip:hover { color: var(--accent); border-color: var(--accent); border-bottom-color: var(--accent); }
  .folder-chip.active { color: var(--card); background: var(--ink); border-color: var(--ink); }
  .folder-chip .ct { color: var(--muted); font-size: 11px; }
  .folder-chip.active .ct { color: var(--card); opacity: 0.7; }
  .folder-chip.drop-hover {
    color: var(--card); background: var(--accent); border-color: var(--accent);
    transform: scale(1.04);
  }
  .canvas-folder {
    font-family: var(--mono); font-size: 11px; color: var(--accent);
    margin-left: 8px; letter-spacing: 0.02em;
  }
  .canvas[draggable="true"] { cursor: grab; }
  .canvas[draggable="true"]:active { cursor: grabbing; }

  .archive { max-width: 1320px; margin: 0 auto; padding: 8px 48px 80px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 56px 40px;
    margin-top: 28px;
  }

  .canvas {
    display: block;
    color: var(--ink);
    border-bottom: 0;
    transition: transform 220ms var(--easing);
    animation: rise 0.6s var(--easing) backwards;
    animation-delay: calc(var(--i, 0) * 35ms);
  }
  .canvas:hover { transform: translateY(-3px); border-bottom: 0; }
  .canvas-head {
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
  .canvas-frame {
    position: relative;
    aspect-ratio: 4 / 3;
    background: var(--card);
    border: 1px solid var(--rule-2);
    border-top: 0;
    overflow: hidden;
    transition: border-color 220ms var(--easing);
  }
  .canvas:hover .canvas-frame { border-color: var(--ink); }
  .canvas-frame iframe {
    width: 200%; height: 200%; border: 0;
    transform: scale(0.5); transform-origin: 0 0;
    pointer-events: none;
    background: white;
  }
  .canvas-frame-mask {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 70%, rgba(243, 237, 223, 0.2) 100%);
    pointer-events: none;
  }
  .canvas-caption {
    padding-top: 14px;
    display: grid;
    gap: 6px;
  }
  .canvas-title {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 400;
    font-size: 22px;
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--ink);
  }
  .canvas-blurb {
    font-size: 14px;
    color: var(--ink-2);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .canvas-subjects {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 500;
  }
  .canvas-catalog {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-2);
    letter-spacing: 0.04em;
    margin-top: 2px;
  }
  .canvas-source {
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
    for (const card of grid.querySelectorAll('.canvas')) {
      const text = card.textContent.toLowerCase();
      card.style.display = !q || text.includes(q) ? '' : 'none';
    }
  });

  // Drag-and-drop: drop a card on a folder chip to move it.
  let draggingId = null;
  for (const card of grid.querySelectorAll('.canvas[draggable="true"]')) {
    card.addEventListener('dragstart', (e) => {
      draggingId = card.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.id);
    });
    card.addEventListener('dragend', () => { draggingId = null; });
  }
  for (const chip of document.querySelectorAll('.folder-chip[data-folder-target]')) {
    chip.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; chip.classList.add('drop-hover'); });
    chip.addEventListener('dragleave', () => { chip.classList.remove('drop-hover'); });
    chip.addEventListener('drop', async (e) => {
      e.preventDefault();
      chip.classList.remove('drop-hover');
      const id = draggingId || e.dataTransfer.getData('text/plain');
      if (!id) return;
      const target = chip.getAttribute('data-folder-target');
      const res = await fetch('/api/canvases/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: target }),
      });
      if (res.ok) location.reload();
      else alert('move failed: ' + (await res.text()));
    });
  }
  document.getElementById('new')?.addEventListener('click', async () => {
    const title = prompt('Title?', 'Untitled');
    if (title === null) return;
    const res = await fetch('/api/canvases', {
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
  return pageShell("Supa Canvas — your AI canvas archive", body);
}

function viewerHtml(meta: CanvasMeta, themes: string[], versions: SnapshotInfo[]): string {
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
    <div class="eyebrow">CANVAS — № ${escapeHtml(meta.id)}</div>
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
    <iframe id="frame" src="/c/${encodeURIComponent(meta.id)}/raw" sandbox="allow-scripts" allowfullscreen allow="fullscreen"></iframe>
  </section>

  <aside class="drawer">
    <section class="dsec">
      <div class="eyebrow">Description</div>
      <textarea id="description" rows="2" placeholder="One or two sentences. What is this canvas?">${escapeHtml(meta.description)}</textarea>
    </section>

    <section class="dsec">
      <div class="dsec-head">
        <div class="eyebrow">Context</div>
        <button class="ctx-toggle" id="ctx-toggle" type="button">${meta.context ? "Hide" : "Show"}</button>
      </div>
      <textarea id="context" rows="6" class="${meta.context ? "" : "collapsed"}" placeholder="What data does this represent? Where is it sourced from? What should the next agent know?">${escapeHtml(meta.context)}</textarea>
    </section>

    <section class="dsec">
      <div class="eyebrow">Folder</div>
      <input id="folder" value="${escapeHtml(meta.folder)}" placeholder="e.g. work/q2-2026 — empty = unfiled" autocomplete="off" list="folder-list" />
      <datalist id="folder-list"></datalist>
      <div class="empty-note small" id="folder-help">${meta.folder ? `In <code>${escapeHtml(meta.folder)}</code>` : "Unfiled. Type a path to file this canvas — autocomplete suggests folders you already use."}</div>
    </section>

    <section class="dsec">
      <div class="eyebrow">Theme</div>
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
        <a href="/c/${encodeURIComponent(meta.id)}/export.md" class="export-link" download>Markdown</a>
        <a href="/c/${encodeURIComponent(meta.id)}/export.html" class="export-link" download>Standalone HTML</a>
        <a href="/c/${encodeURIComponent(meta.id)}/screenshot.png" class="export-link" target="_blank" rel="noopener">PNG (Screenshot)</a>
        <a href="/c/${encodeURIComponent(meta.id)}/print" class="export-link" target="_blank" rel="noopener">PDF (Print sheet)</a>
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
    const res = await fetch('/api/canvases/' + encodeURIComponent(id), {
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

  // Folder field with autocomplete from /api/folders.
  const folderInput = document.getElementById('folder');
  const folderList = document.getElementById('folder-list');
  if (folderInput) {
    fetch('/api/folders').then(r => r.ok ? r.json() : []).then((folders) => {
      folderList.innerHTML = (folders || [])
        .filter(f => f.name)
        .sort((a, b) => b.count - a.count)
        .map(f => '<option value="' + f.name.replace(/"/g, '&quot;') + '">' + f.count + ' canvas' + (f.count === 1 ? '' : 'es') + '</option>')
        .join('');
    }).catch(() => {});
    let lastFolder = folderInput.value;
    folderInput.addEventListener('blur', async () => {
      if (folderInput.value === lastFolder) return;
      const res = await fetch('/api/canvases/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folderInput.value }),
      });
      if (res.ok) {
        lastFolder = folderInput.value;
        const help = document.getElementById('folder-help');
        if (help) help.innerHTML = folderInput.value
          ? 'In <code>' + folderInput.value.replace(/</g,'&lt;') + '</code>'
          : 'Unfiled.';
      } else {
        alert('move failed: ' + (await res.text()));
        folderInput.value = lastFolder;
      }
    });
  }

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
    const res = await fetch('/api/canvases/' + encodeURIComponent(id), { method: 'DELETE' });
    if (res.ok) location.href = '/';
  });

  document.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const version = btn.getAttribute('data-restore');
      const res = await fetch('/api/canvases/' + encodeURIComponent(id) + '/restore', {
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
  return pageShell(meta.title + " — Supacanvas", body);
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
