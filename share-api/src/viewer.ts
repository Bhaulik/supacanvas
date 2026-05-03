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
const SERVE_CMD = "supacanvas serve";
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
  const vscodeInsidersLink = buildVSCodeDeepLink(true);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Supacanvas — workspace for everything your AI tools build</title>
  <meta name="description" content="The workspace for every dashboard, mockup, and diagram your AI tools build. Captured, searchable, exportable, yours forever. Works with Claude, Cursor, and any AI tool that speaks MCP.">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Supacanvas">
  <meta property="og:description" content="The workspace for everything your AI tools build.">
  <meta property="og:url" content="https://supacanvas.com">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&family=General+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
  <style>
    :root {
      --paper: #f5f0e6;
      --paper-deep: #ebe2cf;
      --card: #fcf8f0;
      --ink: #1a1614;
      --ink-soft: #3b352d;
      --muted: #6a604c;
      --rule: #d8cdb6;
      --rule-strong: #b9aa86;
      --accent: #a8352d;
      --accent-soft: #c75a4f;
      --good: #5a7a4f;
      --display: 'Fraunces', 'Times New Roman', Georgia, serif;
      --sans: 'General Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }
    a { color: inherit; }

    .page { max-width: 920px; margin: 0 auto; padding: 64px 32px 96px; }

    /* ============================================================ HERO */
    .hero { text-align: center; margin-bottom: 80px; }
    .hero__num {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 28px;
    }
    .hero__title {
      font-family: var(--display);
      font-weight: 400;
      font-size: clamp(56px, 11vw, 120px);
      line-height: 0.92;
      letter-spacing: -0.03em;
      margin: 0 0 28px;
    }
    .hero__title em { font-style: italic; color: var(--accent); }
    .hero__lede {
      font-family: var(--display);
      font-style: italic;
      font-size: clamp(20px, 3vw, 26px);
      line-height: 1.35;
      color: var(--ink-soft);
      margin: 0 auto 16px;
      max-width: 32ch;
    }
    .hero__sub {
      font-size: 16px;
      line-height: 1.55;
      color: var(--muted);
      margin: 0 auto 32px;
      max-width: 56ch;
    }
    .hero__commits {
      display: inline-flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
      margin: 0 auto 36px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .hero__commits span { display: inline-flex; align-items: center; gap: 6px; }
    .hero__commits span::before { content: "✓"; color: var(--good); font-weight: 700; }

    /* ============================================================ COPY-CODE */
    .copybox {
      display: inline-flex;
      align-items: stretch;
      background: var(--ink);
      color: var(--paper);
      border-radius: 8px;
      overflow: hidden;
      max-width: 100%;
      font-family: var(--mono);
      font-size: 14px;
      box-shadow: 0 1px 0 rgba(26, 22, 20, 0.08), 0 8px 22px -10px rgba(26, 22, 20, 0.18);
    }
    .copybox__cmd {
      padding: 14px 18px 14px 22px;
      letter-spacing: 0.02em;
      white-space: pre;
      overflow-x: auto;
    }
    .copybox__cmd::before { content: "$ "; opacity: 0.5; }
    .copybox--noprompt .copybox__cmd::before { content: ""; }
    .copybox__btn {
      flex-shrink: 0;
      padding: 0 16px;
      background: rgba(245, 240, 230, 0.08);
      color: var(--paper);
      border: 0;
      border-left: 1px solid rgba(245, 240, 230, 0.12);
      cursor: pointer;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      transition: background 140ms ease;
    }
    .copybox__btn:hover { background: var(--accent); }
    .copybox__btn[data-copied="1"] { background: var(--good); }
    .copybox__btn[data-copied="1"]::before { content: "✓ "; }

    /* Block-level copybox for snippets that need to wrap */
    .copyblock {
      position: relative;
      background: var(--ink);
      color: var(--paper);
      border-radius: 6px;
      overflow: hidden;
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.55;
    }
    .copyblock pre {
      margin: 0;
      padding: 14px 76px 14px 16px;
      overflow-x: auto;
      white-space: pre;
    }
    .copyblock__btn {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 5px 11px;
      background: rgba(245, 240, 230, 0.08);
      color: var(--paper);
      border: 1px solid rgba(245, 240, 230, 0.18);
      border-radius: 999px;
      cursor: pointer;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      transition: background 140ms ease;
    }
    .copyblock__btn:hover { background: var(--accent); border-color: var(--accent); }
    .copyblock__btn[data-copied="1"] { background: var(--good); border-color: var(--good); }
    .copyblock__btn[data-copied="1"]::before { content: "✓ "; }

    /* ============================================================ HERO LINKS */
    .hero__links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 26px;
    }
    .hero__links a {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      color: var(--ink-soft);
      text-decoration: none;
      padding: 9px 16px;
      border: 1px solid var(--rule-strong);
      border-radius: 4px;
      transition: all 120ms ease;
    }
    .hero__links a:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }

    /* ============================================================ SECTIONS */
    .section { margin-bottom: 80px; }
    .section__title {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: clamp(32px, 5vw, 44px);
      letter-spacing: -0.02em;
      margin: 0 0 12px;
      color: var(--ink);
      text-align: center;
    }
    .section__sub {
      text-align: center;
      font-size: 15px;
      color: var(--muted);
      margin: 0 auto 36px;
      max-width: 56ch;
      line-height: 1.55;
    }

    /* ============================================================ HOW IT WORKS */
    .howit { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .step {
      background: var(--card);
      border: 1px solid var(--rule);
      border-radius: 8px;
      padding: 24px 22px 22px;
      position: relative;
    }
    .step__num {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      color: var(--accent);
      margin-bottom: 14px;
      font-weight: 500;
    }
    .step h3 {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 22px;
      margin: 0 0 8px;
      letter-spacing: -0.01em;
      color: var(--ink);
    }
    .step p {
      font-size: 13.5px;
      color: var(--ink-soft);
      margin: 0 0 12px;
      line-height: 1.5;
    }
    .step .copybox { font-size: 12px; width: 100%; }
    .step .copybox__cmd { padding: 10px 12px 10px 14px; }
    .step .copybox__btn { padding: 0 11px; font-size: 10px; }

    /* ============================================================ CONNECT */
    .clients { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .client {
      background: var(--card);
      border: 1px solid var(--rule);
      border-radius: 8px;
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .client--featured {
      background: linear-gradient(180deg, rgba(168, 53, 45, 0.04) 0%, var(--card) 80%);
      border-color: var(--rule-strong);
    }
    .client__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }
    .client__name {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 22px;
      margin: 0;
      color: var(--ink);
      letter-spacing: -0.01em;
    }
    .badge {
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid var(--rule-strong);
      color: var(--ink-soft);
      white-space: nowrap;
    }
    .badge--accent { background: var(--accent); color: var(--paper); border-color: var(--accent); }
    .badge--soon { background: var(--paper-deep); color: var(--muted); border-style: dashed; }
    .client__hint {
      font-size: 13px;
      line-height: 1.5;
      color: var(--ink-soft);
      margin: 0;
    }
    .client__hint code {
      font-family: var(--mono);
      font-size: 11.5px;
      background: var(--paper);
      padding: 1px 6px;
      border-radius: 3px;
      border: 1px solid var(--rule);
    }
    .cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: var(--mono);
      font-size: 13px;
      letter-spacing: 0.04em;
      font-weight: 500;
      background: var(--ink);
      color: var(--paper);
      padding: 12px 18px;
      border-radius: 6px;
      text-decoration: none;
      transition: background 160ms ease, transform 160ms ease;
      border: 1px solid var(--ink);
    }
    .cta:hover { background: var(--accent); border-color: var(--accent); transform: translateY(-1px); }
    .cta__arrow { transition: transform 200ms ease; }
    .cta:hover .cta__arrow { transform: translateX(3px); }
    .cta-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .cta-alt {
      display: inline-flex; align-items: center; justify-content: center;
      font-family: var(--mono); font-size: 11px;
      letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500;
      color: var(--ink-soft); padding: 9px 14px;
      border: 1px solid var(--rule-strong); border-radius: 6px;
      text-decoration: none; transition: all 120ms ease;
    }
    .cta-alt:hover { color: var(--accent); border-color: var(--accent); }

    /* ============================================================ FOOTER */
    .foot {
      text-align: center;
      padding-top: 56px;
      border-top: 1px solid var(--rule);
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .foot a { color: var(--ink-soft); margin: 0 8px; text-decoration: none; }
    .foot a:hover { color: var(--accent); }

    /* ============================================================ RESPONSIVE */
    @media (max-width: 760px) {
      .page { padding: 40px 20px 64px; }
      .hero { margin-bottom: 56px; }
      .howit { grid-template-columns: 1fr; }
      .clients { grid-template-columns: 1fr; }
      .section { margin-bottom: 56px; }
    }
  </style>
</head>
<body>
  <main class="page">

    <section class="hero">
      <div class="hero__num">№ 001 · LOCAL-FIRST MCP · MIT</div>
      <h1 class="hero__title">Supa<em>canvas</em></h1>
      <p class="hero__lede">The workspace for everything your AI tools build.</p>
      <p class="hero__sub">Every dashboard, mockup, and diagram your agents create — captured, searchable, exportable, yours forever. Works with Claude, Cursor, and any AI tool that speaks MCP.</p>

      <div class="copybox" role="group" aria-label="Install command">
        <span class="copybox__cmd">${INSTALL_CMD}</span>
        <button class="copybox__btn" data-copy="${INSTALL_CMD}" type="button">Copy</button>
      </div>

      <div class="hero__commits">
        <span>No accounts</span>
        <span>No telemetry</span>
        <span>Files on disk</span>
      </div>

      <div class="hero__links">
        <a href="https://github.com/Bhaulik/supacanvas">GitHub</a>
        <a href="https://www.npmjs.com/package/supacanvas">npm</a>
        <a href="https://github.com/Bhaulik/supacanvas#readme">Docs</a>
      </div>
    </section>

    <section class="section">
      <h2 class="section__title">How it works</h2>
      <p class="section__sub">Three steps. The first two take a minute. The third is everything else you'll ever do with it.</p>
      <div class="howit">
        <div class="step">
          <div class="step__num">№ 01 · INSTALL</div>
          <h3>Install the CLI</h3>
          <p>One command. Works on Node ≥ 18. The <code>supacanvas</code> binary lands on your PATH.</p>
          <div class="copybox copybox--block">
            <span class="copybox__cmd">${INSTALL_CMD}</span>
            <button class="copybox__btn" data-copy="${INSTALL_CMD}" type="button">Copy</button>
          </div>
        </div>

        <div class="step">
          <div class="step__num">№ 02 · CONNECT</div>
          <h3>Wire it into your AI tool</h3>
          <p>One click for Cursor or VS Code. One command for Claude Code. Pick the tool you use below — most people add two or three.</p>
          <a href="#connect" class="cta-alt" style="margin-top: auto;">Jump to connectors ↓</a>
        </div>

        <div class="step">
          <div class="step__num">№ 03 · USE IT</div>
          <h3>Run the viewer, ask your AI</h3>
          <p>In a separate terminal, run the gallery. Then tell your AI what to build.</p>
          <div class="copybox">
            <span class="copybox__cmd">${SERVE_CMD}</span>
            <button class="copybox__btn" data-copy="${SERVE_CMD}" type="button">Copy</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="connect">
      <h2 class="section__title">Connect to your AI tool</h2>
      <p class="section__sub">Supacanvas speaks the Model Context Protocol over stdio. Any MCP client can drive it. Below: one-click for the tools that have deep links, copy-paste snippets for the rest.</p>

      <div class="clients">

        <article class="client client--featured">
          <div class="client__head">
            <h3 class="client__name">Cursor</h3>
            <span class="badge badge--accent">One-click</span>
          </div>
          <a class="cta" href="${cursorLink}">+ Add to Cursor <span class="cta__arrow">→</span></a>
          <p class="client__hint">Opens Cursor and prompts you to confirm. Cursor handles the MCP config edit for you.</p>
        </article>

        <article class="client client--featured">
          <div class="client__head">
            <h3 class="client__name">VS Code</h3>
            <span class="badge badge--accent">One-click</span>
          </div>
          <div class="cta-row">
            <a class="cta" href="${vscodeLink}">+ Add to VS Code <span class="cta__arrow">→</span></a>
            <a class="cta-alt" href="${vscodeInsidersLink}">Insiders</a>
          </div>
          <p class="client__hint">Requires VS Code with MCP support enabled (Copilot Chat or compatible extension).</p>
        </article>

        <article class="client">
          <div class="client__head">
            <h3 class="client__name">Claude Code</h3>
            <span class="badge">One command</span>
          </div>
          <div class="copyblock">
            <pre>${escapeForHtml(CLAUDE_CODE_CMD)}</pre>
            <button class="copyblock__btn" data-copy="${escapeForAttr(CLAUDE_CODE_CMD)}" type="button">Copy</button>
          </div>
          <p class="client__hint">Run in your terminal. The Claude Code CLI registers supacanvas globally.</p>
        </article>

        <article class="client">
          <div class="client__head">
            <h3 class="client__name">Claude Desktop</h3>
            <span class="badge">Manual JSON</span>
          </div>
          <p class="client__hint">Edit <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) and merge:</p>
          <div class="copyblock">
            <pre>${escapeForHtml(CLAUDE_DESKTOP_JSON)}</pre>
            <button class="copyblock__btn" data-copy="${escapeForAttr(CLAUDE_DESKTOP_JSON)}" type="button">Copy</button>
          </div>
          <p class="client__hint">Restart Claude Desktop after saving.</p>
        </article>

        <article class="client">
          <div class="client__head">
            <h3 class="client__name">Continue (VS Code / JetBrains)</h3>
            <span class="badge">Manual YAML</span>
          </div>
          <p class="client__hint">Add to <code>~/.continue/config.yaml</code>:</p>
          <div class="copyblock">
            <pre>${escapeForHtml(CONTINUE_YAML)}</pre>
            <button class="copyblock__btn" data-copy="${escapeForAttr(CONTINUE_YAML)}" type="button">Copy</button>
          </div>
        </article>

        <article class="client">
          <div class="client__head">
            <h3 class="client__name">ChatGPT, Cline, Aider, anything else</h3>
            <span class="badge">Universal</span>
          </div>
          <p class="client__hint">Any client that supports MCP servers — drop this into its <code>mcpServers</code> map:</p>
          <div class="copyblock">
            <pre>${escapeForHtml(UNIVERSAL_JSON)}</pre>
            <button class="copyblock__btn" data-copy="${escapeForAttr(UNIVERSAL_JSON)}" type="button">Copy</button>
          </div>
          <p class="client__hint">ChatGPT desktop with MCP support is in early preview — when available, this snippet is what you'll paste.</p>
        </article>

      </div>
    </section>

    <section class="section" style="text-align: center;">
      <h2 class="section__title">Once you're set up</h2>
      <p class="section__sub" style="margin-bottom: 26px;">Ask your AI:</p>
      <div style="display: inline-block; max-width: 100%;">
        <div style="font-family: var(--display); font-style: italic; font-size: 22px; color: var(--ink-soft); padding: 18px 28px; border: 1px dashed var(--rule-strong); border-radius: 6px; background: var(--card); line-height: 1.4;">
          "create a canvas with a working analog clock and screenshot it back to me"
        </div>
      </div>
      <p class="section__sub" style="margin-top: 26px;">The AI calls <code style="font-family: var(--mono); font-size: 13px; background: var(--paper-deep); padding: 2px 6px; border-radius: 3px;">canvas_create</code> + <code style="font-family: var(--mono); font-size: 13px; background: var(--paper-deep); padding: 2px 6px; border-radius: 3px;">canvas_screenshot</code>. The PNG renders inline in chat. The canvas lives at <code style="font-family: var(--mono); font-size: 13px; background: var(--paper-deep); padding: 2px 6px; border-radius: 3px;">~/.supacanvas/canvases/</code> as plain files. Browse the gallery any time at <code style="font-family: var(--mono); font-size: 13px; background: var(--paper-deep); padding: 2px 6px; border-radius: 3px;">localhost:7777</code>.</p>
    </section>

    <footer class="foot">
      <p style="margin: 0 0 8px;">v0.8.0 · MIT · No telemetry · Files on your machine forever</p>
      <p style="margin: 0;">
        <a href="https://github.com/Bhaulik/supacanvas">GitHub</a> ·
        <a href="https://www.npmjs.com/package/supacanvas">npm</a> ·
        <a href="https://github.com/Bhaulik/supacanvas#readme">Docs</a> ·
        <a href="https://github.com/Bhaulik/supacanvas/blob/main/AGENTS.md">AGENTS.md</a>
      </p>
    </footer>

  </main>

  <script>
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-copy') || '';
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch {}
          document.body.removeChild(ta);
        }
        btn.dataset.copied = '1';
        const originalText = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => {
          delete btn.dataset.copied;
          btn.textContent = originalText;
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
