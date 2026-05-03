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
const CODEX_TOML = `[mcp_servers.supacanvas]
command = "supacanvas"
args = ["mcp"]`;
const OPENCODE_JSON = JSON.stringify(
  {
    $schema: "https://opencode.ai/config.json",
    mcp: {
      supacanvas: {
        type: "local",
        command: ["supacanvas", "mcp"],
        enabled: true,
      },
    },
  },
  null,
  2,
);
const FACTORY_DROID_JSON = JSON.stringify(
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

// Other MCP-compatible tools — listed by name only, the universal JSON
// snippet works for all of them with minor wrapping differences (most
// just want the entry inside their `mcpServers` map).
const OTHER_MCP_TOOLS = [
  "Cline",
  "Windsurf",
  "Gemini CLI",
  "Zed",
  "JetBrains AI",
  "Goose",
  "Charm Crush",
  "Aider",
  "Roo Code",
  "ChatGPT (when MCP ships)",
];

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

    /* === Universal card (catch-all for "any other MCP tool") === */
    .universal {
      margin-top: 14px;
      padding: 24px 26px 26px;
      background: var(--paper);
      border: 1px dashed var(--rule-strong);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .universal__head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
    }
    .universal__name {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 22px;
      line-height: 1;
      margin: 0;
      color: var(--ink);
      letter-spacing: -0.01em;
    }
    .universal__list {
      font-size: 13px;
      color: var(--ink-soft);
      margin: 0;
      line-height: 1.7;
    }
    .universal__list span {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.02em;
      color: var(--ink-faint);
      white-space: nowrap;
    }
    .universal__list code {
      font-family: var(--mono);
      font-size: 11.5px;
      background: var(--paper-tint);
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid var(--rule);
    }

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
        <a href="/uses">Use cases</a>
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
            <h3 class="card__name">Codex CLI</h3>
            <span class="badge">TOML</span>
          </div>
          <div class="snippet">
            <pre>${escapeForHtml(CODEX_TOML)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(CODEX_TOML)}" type="button">Copy</button>
          </div>
        </article>

        <article class="card">
          <div class="card__head">
            <h3 class="card__name">opencode</h3>
            <span class="badge">JSON</span>
          </div>
          <div class="snippet">
            <pre>${escapeForHtml(OPENCODE_JSON)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(OPENCODE_JSON)}" type="button">Copy</button>
          </div>
        </article>

        <article class="card">
          <div class="card__head">
            <h3 class="card__name">Factory <em>droid</em></h3>
            <span class="badge">JSON</span>
          </div>
          <div class="snippet">
            <pre>${escapeForHtml(FACTORY_DROID_JSON)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(FACTORY_DROID_JSON)}" type="button">Copy</button>
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
      </div>

      <article class="universal">
        <div class="universal__head">
          <h3 class="universal__name">Any other MCP-compatible tool</h3>
          <span class="badge">Universal JSON</span>
        </div>
        <p class="universal__list">
          ${OTHER_MCP_TOOLS.map((t) => `<span>${escapeHtml(t)}</span>`).join(" · ")}
          — and any other MCP client. Drop this snippet into the client's <code>mcpServers</code> map.
        </p>
        <div class="snippet">
          <pre>${escapeForHtml(UNIVERSAL_JSON)}</pre>
          <button class="snippet__btn" data-copy="${escapeForAttr(UNIVERSAL_JSON)}" type="button">Copy</button>
        </div>
      </article>
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

// =====================================================================
// USE CASES PAGE — /uses
// 42 ready-to-copy prompts across 9 categories. Every prompt says
// "supacanvas" explicitly so AI agents call our MCP, not a competitor's
// built-in canvas feature.
// =====================================================================

interface UseCase { title: string; prompt: string; }
interface UseCaseCategory { id: string; name: string; blurb: string; cases: UseCase[]; }

const USE_CASES: UseCaseCategory[] = [
  {
    id: "dashboards",
    name: "Dashboards & status",
    blurb: "For PMs, EMs, leadership reviews, ops.",
    cases: [
      { title: "Quarterly revenue dashboard", prompt: "Build a Q3 revenue dashboard in supacanvas with 4 KPI cards (Revenue, MRR, Churn, NPS), a 12-month trend line, and a regional breakdown bar chart. Use placeholder numbers." },
      { title: "Sprint status board", prompt: "Create a sprint status board in supacanvas with 5 columns (Backlog, To-Do, In Progress, Review, Done) and 3 sample tickets in each. Add team-member avatars and priority badges." },
      { title: "OKR tracker", prompt: "Build a Q4 OKR tracker in supacanvas: 3 objectives, 3 key results each, progress bars, and confidence indicators (R/Y/G)." },
      { title: "Service health board", prompt: "Mock up a service-health monitoring dashboard in supacanvas with 6 service tiles (status, P95 latency, error rate), a global incidents feed, and a 24-hour uptime sparkline." },
      { title: "Customer 360 view", prompt: "Make a customer 360 dashboard mockup in supacanvas: customer header, lifetime value, recent-orders timeline, support-ticket history, and renewal risk score." },
    ],
  },
  {
    id: "diagrams",
    name: "Diagrams & architecture",
    blurb: "For staff engineers, architects, design reviews.",
    cases: [
      { title: "Microservices architecture", prompt: "Sketch our microservices architecture in supacanvas: API gateway → 3 services (auth, payments, notifications) → Postgres + Redis. Boxes with labeled arrows." },
      { title: "Sequence diagram", prompt: "Create a sequence diagram in supacanvas for our checkout flow: user → frontend → API → Stripe → email service. Label every arrow with the call name." },
      { title: "ER diagram", prompt: "Draw an entity-relationship diagram in supacanvas for a forum schema: Users, Posts, Comments, Tags. Show primary keys, foreign keys, cardinalities." },
      { title: "Data pipeline map", prompt: "Map our data pipeline in supacanvas: Kafka → Spark Streaming → S3 (raw) → dbt → Snowflake → Looker. Add labels for each transform stage." },
      { title: "Decision tree", prompt: "Build a decision-tree visualization in supacanvas for 'should we hire this candidate?': yes/no branches at 4 levels, terminal outcomes at the leaves." },
    ],
  },
  {
    id: "mockups",
    name: "Mockups & UI",
    blurb: "For designers, PMs, anyone who needs a fast visual.",
    cases: [
      { title: "SaaS pricing page", prompt: "Mock up a SaaS pricing page in supacanvas: 3 tiers (Free, Pro at $19/mo, Team at $49/seat), feature checkmarks, FAQ section, two CTA buttons." },
      { title: "Auth screen", prompt: "Mock up a combined login + signup screen in supacanvas with email/password fields, social login buttons (Google, GitHub), forgot-password link, hero illustration placeholder." },
      { title: "Settings page", prompt: "Build a settings page mockup in supacanvas: sidebar nav with 6 sections, toggles, dropdowns, save button, danger zone at the bottom." },
      { title: "iOS home screen", prompt: "Mock up an iOS-style home screen in supacanvas: 4x6 app-icon grid, dock with 4 apps, status bar with time / battery / signal." },
      { title: "E-commerce product page", prompt: "Build a product detail page mockup in supacanvas: image gallery placeholder, title, price, variant picker, quantity, add-to-cart, reviews summary." },
      { title: "Onboarding flow", prompt: "Mock up a 4-step user-onboarding flow in supacanvas: welcome → profile → integrations → success. Show progress dots and skip links on each step." },
    ],
  },
  {
    id: "tools",
    name: "Interactive tools",
    blurb: "Working apps with real logic.",
    cases: [
      { title: "Mortgage calculator", prompt: "Build a working mortgage calculator in supacanvas: principal, rate, term inputs; live monthly payment + total interest output. Format numbers with commas." },
      { title: "Pomodoro timer", prompt: "Make a working Pomodoro timer in supacanvas: 25/5 minute cycles, sound when complete, session counter, start/pause/reset buttons." },
      { title: "Color picker", prompt: "Build a color picker tool in supacanvas: HSL/RGB/HEX inputs, live swatch preview, copy-to-clipboard, palette history (last 5 colors)." },
      { title: "Markdown live preview", prompt: "Create a Markdown live previewer in supacanvas: textarea on the left, rendered HTML on the right, syntax-highlighted code blocks, live update on type." },
      { title: "JSON formatter", prompt: "Make a JSON formatter / validator in supacanvas: paste JSON, get pretty-printed output, syntax highlighting, error messages with line numbers." },
      { title: "Analog clock", prompt: "Build a working analog clock in supacanvas that ticks every second. Add date display below, smooth second-hand animation, hover-to-pause." },
    ],
  },
  {
    id: "data",
    name: "Data visualizations",
    blurb: "For analysts, data scientists, anyone with a CSV.",
    cases: [
      { title: "CSV → bar chart", prompt: "Visualize this CSV data as a stacked bar chart in supacanvas: [paste CSV here]. Add legend, axis labels, hover tooltips." },
      { title: "US choropleth map", prompt: "Make a US choropleth map in supacanvas with placeholder state-level data (e.g., revenue by state). Sequential color scale, state labels on hover." },
      { title: "Sankey funnel", prompt: "Build a Sankey diagram in supacanvas for a user funnel: 1,000 visits → 200 signups → 80 trials → 20 paid. Width proportional to flow." },
      { title: "GitHub-style heatmap", prompt: "Visualize a GitHub-style commit heatmap in supacanvas: 52 weeks × 7 days grid, varying intensity, total contribution count, tooltips per cell." },
      { title: "Force-directed network", prompt: "Build a force-directed network graph in supacanvas with 15 nodes, 25 edges, draggable nodes, color-coded by group." },
    ],
  },
  {
    id: "slides",
    name: "Slides & decks",
    blurb: "Mini-presentations rendered in HTML.",
    cases: [
      { title: "5-slide pitch deck", prompt: "Build a 5-slide pitch deck in supacanvas: title, problem, solution, market, ask. Big italic typography, one core idea per slide, navigation arrows." },
      { title: "Workshop slides", prompt: "Create a workshop slide deck in supacanvas about 'Intro to MCP' — 8 slides with hero quotes, code examples, and demo placeholders." },
      { title: "Conference talk deck", prompt: "Make a conference talk deck in supacanvas about 'Local-first software': 10 slides — title, hook, why-now, how it works, demos, Q&A." },
      { title: "QBR deck", prompt: "Build a quarterly business review deck in supacanvas: 6 sections (wins, misses, metrics, learnings, next quarter, asks). Each fully laid out." },
    ],
  },
  {
    id: "docs",
    name: "Documents & reports",
    blurb: "Long-form content with structure and style.",
    cases: [
      { title: "Resume page", prompt: "Build my resume page in supacanvas: contact, 5 jobs (title / company / dates / bullets), skills grid, education. Two-column layout with mono accents." },
      { title: "Product changelog", prompt: "Create a product changelog in supacanvas: 5 versions (v1.0 → v1.4), each with Breaking / Added / Fixed sections, dates, semver headings." },
      { title: "RFC document", prompt: "Format this technical RFC as a beautiful document in supacanvas with TOC, headings, code blocks, callout boxes for warnings/notes: [paste RFC text]" },
      { title: "Recipe card", prompt: "Build a beautiful recipe card in supacanvas for [recipe name]: ingredients list, numbered steps, prep time, cook time, photo placeholder, tags." },
    ],
  },
  {
    id: "personal",
    name: "Personal",
    blurb: "For everyday life, not just work.",
    cases: [
      { title: "Weekly workout plan", prompt: "Create a weekly workout plan visualization in supacanvas: 7 days, exercises per day with sets/reps, rest days marked, total volume calculated." },
      { title: "30-day habit tracker", prompt: "Build a 30-day habit tracker in supacanvas: 5 habits (rows), 30 days (columns), checkable cells, streak counters per habit." },
      { title: "Learning roadmap", prompt: "Make a learning roadmap in supacanvas for becoming an iOS developer: 12 weeks broken into 4 phases, weekly milestones, resource links per week." },
      { title: "Travel itinerary", prompt: "Build a travel itinerary in supacanvas for a 7-day Tokyo trip: day-by-day schedule, restaurants, neighborhoods, estimated daily costs." },
    ],
  },
  {
    id: "fun",
    name: "Games & fun",
    blurb: "Quick, working browser games.",
    cases: [
      { title: "Tic-Tac-Toe", prompt: "Build a working Tic-Tac-Toe game in supacanvas with score tracking and a reset button. Two-player local mode, win detection." },
      { title: "Calculator app", prompt: "Create a calculator app in supacanvas: basic mode (+ − × ÷), keyboard support, history of the last 5 calculations, clear button." },
      { title: "Minesweeper", prompt: "Build a Minesweeper clone in supacanvas: 10x10 grid, 15 mines, flag mode, win/lose detection, timer that starts on first click." },
    ],
  },
];

export function renderUseCases(): string {
  const totalCount = USE_CASES.reduce((sum, cat) => sum + cat.cases.length, 0);

  const nav = USE_CASES.map((cat) =>
    `<a href="#${cat.id}">${escapeHtml(cat.name)} <span>${cat.cases.length}</span></a>`
  ).join("");

  const sections = USE_CASES.map((cat) => `
    <section class="cat" id="${escapeAttr(cat.id)}">
      <header class="cat__head">
        <h2 class="cat__name">${escapeHtml(cat.name)}</h2>
        <p class="cat__blurb">${escapeHtml(cat.blurb)}</p>
      </header>
      <div class="cat__grid">
        ${cat.cases.map((c) => `
          <article class="usecase">
            <h3 class="usecase__title">${escapeHtml(c.title)}</h3>
            <p class="usecase__prompt">${highlightSupacanvas(escapeHtml(c.prompt))}</p>
            <button class="usecase__copy" data-copy="${escapeForAttr(c.prompt)}" type="button">Copy prompt</button>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Supacanvas — use cases & prompt library</title>
  <meta name="description" content="${totalCount}+ ready-to-copy prompts for everything you can build with supacanvas. Dashboards, mockups, diagrams, data visualizations, interactive tools — paste into Claude / Cursor / any MCP client.">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Supacanvas — use cases">
  <meta property="og:description" content="${totalCount}+ prompts to make your AI build dashboards, mockups, diagrams, and tools.">
  <meta property="og:url" content="https://supacanvas.com/uses">

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
      --accent-soft: rgba(168, 53, 45, 0.06);
      --easing: cubic-bezier(0.2, 0.8, 0.2, 1);
      --display: 'Fraunces', 'Times New Roman', Georgia, serif;
      --sans: 'General Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    html { scroll-behavior: smooth; scroll-padding-top: 24px; }
    body {
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 16px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; text-decoration: none; }
    button { font-family: inherit; cursor: pointer; }

    .page {
      max-width: 980px;
      margin: 0 auto;
      padding: 32px 32px 64px;
    }

    /* ============================================================ TOP */
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 56px;
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
    .top__links a { color: var(--ink-faint); transition: color 160ms var(--easing); }
    .top__links a:hover { color: var(--accent); }
    .top__links a[aria-current="page"] { color: var(--accent); }

    /* ============================================================ HERO */
    .hero {
      padding: 24px 0 56px;
    }
    .hero__title {
      font-family: var(--display);
      font-weight: 300;
      font-size: clamp(48px, 7vw, 88px);
      line-height: 0.96;
      letter-spacing: -0.03em;
      margin: 0 0 20px;
      color: var(--ink);
    }
    .hero__title em { font-style: italic; color: var(--accent); font-weight: 400; }
    .hero__sub {
      font-family: var(--display);
      font-style: italic;
      font-size: 22px;
      line-height: 1.4;
      color: var(--ink-soft);
      margin: 0 0 12px;
      max-width: 50ch;
    }
    .hero__hint {
      font-size: 14px;
      color: var(--ink-faint);
      margin: 0;
      max-width: 60ch;
    }
    .hero__hint code {
      font-family: var(--mono);
      font-size: 12.5px;
      background: var(--paper-tint);
      padding: 1px 6px;
      border-radius: 3px;
      border: 1px solid var(--rule);
      color: var(--accent);
      font-weight: 500;
    }

    /* ============================================================ NAV CHIPS */
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 16px 0;
      margin-bottom: 32px;
      border-top: 1px solid var(--rule);
      border-bottom: 1px solid var(--rule);
    }
    .nav a {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      color: var(--ink-soft);
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid transparent;
      transition: all 160ms var(--easing);
    }
    .nav a:hover {
      background: var(--paper-tint);
      border-color: var(--rule);
      color: var(--accent);
    }
    .nav a span {
      font-size: 9px;
      color: var(--ink-faint);
      opacity: 0.7;
    }
    .nav a:hover span { color: var(--accent); }

    /* ============================================================ CATEGORY */
    .cat {
      padding-top: 24px;
      margin-bottom: 64px;
      scroll-margin-top: 16px;
    }
    .cat__head {
      margin-bottom: 24px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--rule);
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .cat__name {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: clamp(28px, 3.6vw, 36px);
      line-height: 1.05;
      letter-spacing: -0.015em;
      color: var(--ink);
      margin: 0;
    }
    .cat__blurb {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin: 0;
    }

    .cat__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    /* ============================================================ USECASE CARD */
    .usecase {
      background: var(--paper-tint);
      border: 1px solid var(--rule);
      border-radius: 8px;
      padding: 20px 22px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color 200ms var(--easing), transform 200ms var(--easing);
    }
    .usecase:hover {
      border-color: var(--rule-strong);
      transform: translateY(-1px);
    }
    .usecase__title {
      font-family: var(--display);
      font-weight: 400;
      font-size: 19px;
      line-height: 1.2;
      letter-spacing: -0.01em;
      color: var(--ink);
      margin: 0;
    }
    .usecase__prompt {
      font-size: 14px;
      line-height: 1.55;
      color: var(--ink-soft);
      margin: 0;
      flex: 1;
    }
    .usecase__prompt mark {
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 500;
      padding: 0 2px;
      border-radius: 2px;
    }
    .usecase__copy {
      align-self: flex-start;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-soft);
      background: var(--paper);
      border: 1px solid var(--rule-strong);
      border-radius: 4px;
      padding: 7px 13px;
      transition: all 160ms var(--easing);
    }
    .usecase__copy:hover {
      background: var(--ink);
      color: var(--paper);
      border-color: var(--ink);
    }
    .usecase__copy[data-copied="1"] {
      background: var(--accent);
      color: var(--paper);
      border-color: var(--accent);
    }
    .usecase__copy[data-copied="1"]::before { content: "✓ "; }

    /* ============================================================ FOOTER */
    .foot {
      margin-top: 64px;
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

    @media (max-width: 720px) {
      .page { padding: 22px 22px 48px; }
      .top { padding-bottom: 32px; }
      .cat__grid { grid-template-columns: 1fr; }
      .cat__head { flex-direction: column; align-items: flex-start; gap: 6px; }
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
      <a href="/" class="top__brand">Supacanvas <em>v0.8.0</em></a>
      <nav class="top__links">
        <a href="/uses" aria-current="page">Use cases</a>
        <a href="https://github.com/Bhaulik/supacanvas">GitHub</a>
        <a href="https://www.npmjs.com/package/supacanvas">npm</a>
      </nav>
    </header>

    <section class="hero">
      <h1 class="hero__title">Use <em>cases</em>.</h1>
      <p class="hero__sub">${totalCount} ready-to-copy prompts — paste one into your AI and watch the canvas appear.</p>
      <p class="hero__hint">Every prompt explicitly says <code>supacanvas</code> so your AI calls our MCP, not its own built-in canvas (Cursor, ChatGPT, etc. ship with native ones — we want yours to land in the supacanvas gallery you can browse, search, and export forever).</p>
    </section>

    <nav class="nav" aria-label="Categories">
      ${nav}
    </nav>

    ${sections}

    <footer class="foot">
      <a href="/">Home</a>
      <span class="foot__sep">·</span>
      <a href="https://github.com/Bhaulik/supacanvas">GitHub</a>
      <span class="foot__sep">·</span>
      <a href="https://www.npmjs.com/package/supacanvas">npm</a>
      <span class="foot__sep">·</span>
      <a href="https://github.com/Bhaulik/supacanvas#readme">Docs</a>
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
        btn.textContent = 'Copied prompt';
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

function highlightSupacanvas(escaped: string): string {
  // Escaped string already has HTML escapes applied. Wrap "supacanvas"
  // in <mark> so the brand stands out visually in every prompt.
  return escaped.replace(/\bsupacanvas\b/g, "<mark>supacanvas</mark>");
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
