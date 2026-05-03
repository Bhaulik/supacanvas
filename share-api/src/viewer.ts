import type { ShareMeta } from "./lib";

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function renderViewer(
  meta: ShareMeta,
  htmlBody: string,
  publicBase: string,
): string {
  const title = escapeHtml(meta.title || "Untitled canvas");
  const description = escapeHtml(meta.description || "Made with supacanvas.");
  const url = `${publicBase}/c/${meta.slug}`;
  const ogImage = meta.hasScreenshot ? `${publicBase}/c/${meta.slug}.png` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Supacanvas</title>
  <meta name="description" content="${description}">

  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${escapeAttr(url)}">
  ${ogImage ? `<meta property="og:image" content="${escapeAttr(ogImage)}">` : ""}

  <meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${ogImage ? `<meta name="twitter:image" content="${escapeAttr(ogImage)}">` : ""}

  <style id="supacanvas-foot-style">
    .supacanvas-foot {
      position: fixed;
      bottom: 14px;
      right: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif;
      font-size: 11px;
      color: rgba(26, 22, 20, 0.6);
      background: rgba(245, 240, 230, 0.92);
      padding: 7px 12px;
      border-radius: 999px;
      border: 1px solid rgba(26, 22, 20, 0.08);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 2147483647;
      letter-spacing: 0.02em;
    }
    .supacanvas-foot a {
      color: #a8352d;
      text-decoration: none;
      font-weight: 500;
    }
    .supacanvas-foot a:hover { text-decoration: underline; }
  </style>
</head>
<body>
${htmlBody}
<aside class="supacanvas-foot" aria-label="Made with Supacanvas">
  Made with <a href="${escapeAttr(publicBase)}" target="_blank" rel="noreferrer">supacanvas</a>
</aside>
</body>
</html>`;
}

// One-click deep links for clients that support them.
function buildCursorDeepLink(): string {
  const config = JSON.stringify({ command: "supacanvas", args: ["mcp"] });
  const b64 = btoa(config);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=supacanvas&config=${encodeURIComponent(b64)}`;
}

function buildVSCodeDeepLink(insiders = false): string {
  const config = JSON.stringify({ name: "supacanvas", command: "supacanvas", args: ["mcp"] });
  const scheme = insiders ? "vscode-insiders" : "vscode";
  return `${scheme}:mcp/install?${encodeURIComponent(config)}`;
}

const INSTALL_CMD = "npm install -g supacanvas";
const CLAUDE_CODE_CMD = "claude mcp add supacanvas supacanvas mcp";
const CLAUDE_DESKTOP_JSON = JSON.stringify(
  { mcpServers: { supacanvas: { command: "supacanvas", args: ["mcp"] } } },
  null,
  2,
);
const CONTINUE_YAML = `mcpServers:
  - name: supacanvas
    command: supacanvas
    args:
      - mcp`;
const UNIVERSAL_JSON = JSON.stringify(
  { supacanvas: { command: "supacanvas", args: ["mcp"] } },
  null,
  2,
);

export function renderLanding(): string {
  const cursorLink = buildCursorDeepLink();
  const vscodeLink = buildVSCodeDeepLink(false);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Supacanvas — understand what your agents are doing</title>
  <meta name="description" content="Understand what your Agents are doing — visually, easily. A local-first MCP server + viewer for the canvases your AI tools build.">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Supacanvas">
  <meta property="og:description" content="Understand what your Agents are doing — visually, easily.">
  <meta property="og:url" content="https://supacanvas.com">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&family=General+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap">

  <style>
    :root {
      --paper: #f4ede0;
      --paper-tint: #ede4d0;
      --ink: #1a1614;
      --ink-soft: #3b352d;
      --ink-faint: #6a604c;
      --rule: #d2c5a6;
      --rule-strong: #b9aa86;
      --accent: #a8352d;
      --easing: cubic-bezier(0.2, 0.8, 0.2, 1);
      --display: 'Fraunces', 'Times New Roman', Georgia, serif;
      --sans: 'General Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 16px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }
    a { color: inherit; text-decoration: none; }
    button { font-family: inherit; cursor: pointer; }

    .page {
      max-width: 880px;
      margin: 0 auto;
      padding: 32px 32px 64px;
    }

    /* ============================================================ TOP */
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 64px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .top__brand { color: var(--ink); font-weight: 500; }
    .top__brand em {
      font-family: var(--display);
      font-style: italic;
      font-size: 14px;
      letter-spacing: 0;
      text-transform: none;
      color: var(--accent);
      margin-left: 4px;
      font-weight: 400;
    }
    .top__links { display: flex; gap: 18px; }
    .top__links a {
      color: var(--ink-faint);
      transition: color 160ms var(--easing);
    }
    .top__links a:hover { color: var(--accent); }

    /* ============================================================ HERO */
    .hero {
      text-align: center;
      padding: 24px 0 80px;
    }
    .wordmark {
      font-family: var(--display);
      font-weight: 300;
      font-size: clamp(64px, 11vw, 128px);
      line-height: 0.9;
      letter-spacing: -0.045em;
      margin: 0 0 36px;
      color: var(--ink);
      font-feature-settings: "ss01" on;
      font-optical-sizing: auto;
    }
    .wordmark__supa { font-style: normal; }
    .wordmark__canvas {
      font-style: italic;
      color: var(--accent);
      font-weight: 400;
      letter-spacing: -0.05em;
    }

    .tagline {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: clamp(22px, 3vw, 30px);
      line-height: 1.3;
      letter-spacing: -0.012em;
      color: var(--ink-soft);
      margin: 0 auto 48px;
      max-width: 22ch;
    }
    .tagline strong {
      font-style: italic;
      font-weight: 400;
      color: var(--accent);
    }

    /* === Install command, the single hero CTA === */
    .install {
      display: inline-flex;
      align-items: stretch;
      background: var(--ink);
      color: var(--paper);
      border-radius: 8px;
      overflow: hidden;
      max-width: 100%;
      font-family: var(--mono);
      font-size: 14px;
      box-shadow: 0 1px 0 rgba(26, 22, 20, 0.08), 0 12px 28px -12px rgba(26, 22, 20, 0.22);
      transition: transform 220ms var(--easing), box-shadow 220ms var(--easing);
    }
    .install:hover {
      transform: translateY(-2px);
      box-shadow: 0 1px 0 rgba(26, 22, 20, 0.08), 0 18px 36px -14px rgba(168, 53, 45, 0.32);
    }
    .install__cmd {
      padding: 16px 20px 16px 24px;
      letter-spacing: 0.02em;
      white-space: pre;
      overflow-x: auto;
    }
    .install__cmd::before { content: "$ "; opacity: 0.45; }
    .install__btn {
      flex-shrink: 0;
      padding: 0 22px;
      background: rgba(245, 240, 230, 0.08);
      color: var(--paper);
      border: 0;
      border-left: 1px solid rgba(245, 240, 230, 0.14);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-weight: 500;
      transition: background 160ms var(--easing);
    }
    .install__btn:hover { background: var(--accent); }
    .install__btn[data-copied="1"] { background: var(--accent); }
    .install__btn[data-copied="1"]::before { content: "✓ "; }

    .meta {
      margin-top: 28px;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .meta span { padding: 0 10px; }
    .meta span + span { border-left: 1px solid var(--rule); }

    /* ============================================================ CONNECT */
    .connect {
      padding-top: 48px;
      border-top: 1px solid var(--rule);
    }
    .connect__head {
      text-align: center;
      margin-bottom: 44px;
    }
    .connect__title {
      font-family: var(--display);
      font-weight: 300;
      font-size: clamp(32px, 4.4vw, 48px);
      line-height: 1.05;
      letter-spacing: -0.02em;
      margin: 0 0 8px;
      color: var(--ink);
    }
    .connect__title em { font-style: italic; color: var(--accent); font-weight: 400; }
    .connect__sub {
      font-size: 14px;
      color: var(--ink-faint);
      margin: 0;
    }

    .featured {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .secondary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }

    .card {
      background: var(--paper-tint);
      border: 1px solid var(--rule);
      border-radius: 10px;
      padding: 24px 24px 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: border-color 200ms var(--easing), transform 200ms var(--easing);
    }
    .card--featured {
      background: linear-gradient(180deg, rgba(168, 53, 45, 0.06) 0%, var(--paper-tint) 80%);
      border-color: var(--rule-strong);
    }
    .card--featured:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
    }

    .card__name {
      font-family: var(--display);
      font-weight: 400;
      font-size: 26px;
      line-height: 1;
      margin: 0;
      color: var(--ink);
      letter-spacing: -0.01em;
    }
    .card__name em { font-style: italic; color: var(--accent); }

    .card__head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
    }

    .badge {
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      padding: 4px 10px;
      border: 1px solid var(--rule-strong);
      color: var(--ink-faint);
      border-radius: 999px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .badge--accent {
      background: var(--accent);
      color: var(--paper);
      border-color: var(--accent);
    }

    /* === CTA button (one-click installers) === */
    .cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      align-self: flex-start;
      padding: 12px 22px;
      background: var(--ink);
      color: var(--paper);
      font-family: var(--mono);
      font-size: 13px;
      letter-spacing: 0.04em;
      font-weight: 500;
      border-radius: 6px;
      transition: background 200ms var(--easing), transform 200ms var(--easing);
    }
    .cta:hover { background: var(--accent); transform: translateY(-1px); }
    .cta__arrow { transition: transform 200ms var(--easing); display: inline-block; }
    .cta:hover .cta__arrow { transform: translateX(3px); }

    /* === Snippet block (copy-paste cards) === */
    .snippet {
      position: relative;
      background: var(--ink);
      color: var(--paper);
      border-radius: 5px;
      overflow: hidden;
      font-family: var(--mono);
    }
    .snippet pre {
      margin: 0;
      padding: 14px 70px 14px 14px;
      font-size: 11.5px;
      line-height: 1.55;
      overflow-x: auto;
      white-space: pre;
      color: var(--paper);
    }
    .snippet__btn {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 5px 10px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--paper);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      transition: background 160ms var(--easing);
    }
    .snippet__btn:hover { background: var(--accent); border-color: var(--accent); }
    .snippet__btn[data-copied="1"] { background: var(--accent); border-color: var(--accent); }
    .snippet__btn[data-copied="1"]::before { content: "✓ "; }

    /* ============================================================ FOOTER */
    .foot {
      margin-top: 80px;
      padding-top: 24px;
      border-top: 1px solid var(--rule);
      text-align: center;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .foot a { color: var(--ink-faint); margin: 0 8px; transition: color 160ms var(--easing); }
    .foot a:hover { color: var(--accent); }
    .foot__sep { color: var(--rule-strong); margin: 0 4px; }

    /* ============================================================ RESPONSIVE */
    @media (max-width: 720px) {
      .page { padding: 22px 22px 48px; }
      .top { padding-bottom: 40px; }
      .hero { padding: 8px 0 56px; }
      .featured { grid-template-columns: 1fr; }
      .secondary { grid-template-columns: 1fr; }
      .install { font-size: 13px; }
      .install__cmd { padding: 14px 16px 14px 18px; }
      .install__btn { padding: 0 16px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0ms !important;
        transition-duration: 0ms !important;
      }
    }
  </style>
</head>
<body>
  <main class="page">

    <header class="top">
      <div class="top__brand">Supacanvas <em>v0.8.0</em></div>
      <nav class="top__links">
        <a href="https://github.com/Bhaulik/supacanvas">GitHub</a>
        <a href="https://www.npmjs.com/package/supacanvas">npm</a>
      </nav>
    </header>

    <section class="hero">
      <h1 class="wordmark">
        <span class="wordmark__supa">Supa</span><span class="wordmark__canvas">canvas</span>
      </h1>

      <p class="tagline">Understand what your <strong>Agents</strong> are doing — <em>visually, easily.</em></p>

      <div class="install" role="group" aria-label="Install command">
        <span class="install__cmd">${INSTALL_CMD}</span>
        <button class="install__btn" data-copy="${INSTALL_CMD}" type="button">Copy</button>
      </div>

      <div class="meta">
        <span>Local-first</span>
        <span>MIT</span>
        <span>No telemetry</span>
      </div>
    </section>

    <section class="connect">
      <header class="connect__head">
        <h2 class="connect__title">Add to your <em>AI tool</em></h2>
        <p class="connect__sub">One click for Cursor and VS Code. One paste for the rest.</p>
      </header>

      <div class="featured">
        <article class="card card--featured">
          <div class="card__head">
            <h3 class="card__name"><em>Cursor</em></h3>
            <span class="badge badge--accent">One click</span>
          </div>
          <a class="cta" href="${cursorLink}">+ Add to Cursor <span class="cta__arrow">→</span></a>
        </article>

        <article class="card card--featured">
          <div class="card__head">
            <h3 class="card__name"><em>VS Code</em></h3>
            <span class="badge badge--accent">One click</span>
          </div>
          <a class="cta" href="${vscodeLink}">+ Add to VS Code <span class="cta__arrow">→</span></a>
        </article>
      </div>

      <div class="secondary">
        <article class="card">
          <div class="card__head">
            <h3 class="card__name">Claude Code</h3>
            <span class="badge">Command</span>
          </div>
          <div class="snippet">
            <pre>${escapeForHtml(CLAUDE_CODE_CMD)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(CLAUDE_CODE_CMD)}" type="button">Copy</button>
          </div>
        </article>

        <article class="card">
          <div class="card__head">
            <h3 class="card__name">Claude Desktop</h3>
            <span class="badge">JSON</span>
          </div>
          <div class="snippet">
            <pre>${escapeForHtml(CLAUDE_DESKTOP_JSON)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(CLAUDE_DESKTOP_JSON)}" type="button">Copy</button>
          </div>
        </article>

        <article class="card">
          <div class="card__head">
            <h3 class="card__name">Continue</h3>
            <span class="badge">YAML</span>
          </div>
          <div class="snippet">
            <pre>${escapeForHtml(CONTINUE_YAML)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(CONTINUE_YAML)}" type="button">Copy</button>
          </div>
        </article>

        <article class="card">
          <div class="card__head">
            <h3 class="card__name">Anything else MCP</h3>
            <span class="badge">JSON</span>
          </div>
          <div class="snippet">
            <pre>${escapeForHtml(UNIVERSAL_JSON)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(UNIVERSAL_JSON)}" type="button">Copy</button>
          </div>
        </article>
      </div>
    </section>

    <footer class="foot">
      <a href="https://github.com/Bhaulik/supacanvas">GitHub</a>
      <span class="foot__sep">·</span>
      <a href="https://www.npmjs.com/package/supacanvas">npm</a>
      <span class="foot__sep">·</span>
      <a href="https://github.com/Bhaulik/supacanvas#readme">Docs</a>
      <span class="foot__sep">·</span>
      <a href="https://github.com/Bhaulik/supacanvas/blob/main/AGENTS.md">AGENTS.md</a>
    </footer>

  </main>

  <script>
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-copy') || '';
        try {
          await navigator.clipboard.writeText(text);
        } catch (_) {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (__) {}
          document.body.removeChild(ta);
        }
        btn.dataset.copied = '1';
        const originalLabel = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => {
          delete btn.dataset.copied;
          btn.textContent = originalLabel;
        }, 1400);
      });
    });
  </script>
</body>
</html>`;
}

// Escape HTML text content (between tags) — for code blocks visible in <pre>
function escapeForHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Escape values that go inside HTML attributes (data-copy="...")
function escapeForAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderGone(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Revoked · Supacanvas</title>
  <style>
    body {
      font-family: -apple-system, system-ui, sans-serif;
      background: #f5f0e6;
      color: #1a1614;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 40px;
      text-align: center;
    }
    h1 { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 400; font-size: 48px; margin: 0 0 12px; color: #a8352d; }
    p { color: #6a604c; max-width: 40ch; }
    a { color: #a8352d; }
  </style>
</head>
<body>
  <h1>410 — Gone</h1>
  <p>This shared canvas was revoked by its creator. Visit <a href="https://supacanvas.com">supacanvas.com</a> to learn more.</p>
</body>
</html>`;
}

export function renderNotFound(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Not found · Supacanvas</title>
  <style>
    body {
      font-family: -apple-system, system-ui, sans-serif;
      background: #f5f0e6;
      color: #1a1614;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 40px;
      text-align: center;
    }
    h1 { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 400; font-size: 48px; margin: 0 0 12px; }
    p { color: #6a604c; max-width: 40ch; }
    a { color: #a8352d; }
  </style>
</head>
<body>
  <h1>404</h1>
  <p>No canvas found at this URL. It may have been revoked, or the link may be incorrect. Visit <a href="https://supacanvas.com">supacanvas.com</a>.</p>
</body>
</html>`;
}
