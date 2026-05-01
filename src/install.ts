/**
 * Install page — one-click deep links for Cursor / VS Code, copy-paste snippets
 * for Claude Code / Claude Desktop / Continue. Served at /install by the local
 * HTTP server, and also exported as a standalone HTML so the same page can be
 * hosted on a future website without the server running.
 */

import { escapeHtml } from "./render.ts";

export interface InstallPageOptions {
  /** Show the curl|bash install one-liner at the top. Skip when running locally
   *  (the user already has supacanvas installed if they hit this URL). */
  includeInstallStep?: boolean;
  /** Repo for the curl|bash one-liner. */
  repo?: string;
}

const SERVER_NAME = "supacanvas";
const SERVER_COMMAND = "supacanvas";
const SERVER_ARGS = ["mcp"];
const CLAUDE_DESKTOP_PATH_MACOS = "~/Library/Application Support/Claude/claude_desktop_config.json";
const CONTINUE_PATH = "~/.continue/config.yaml";

function buildCursorDeepLink(): string {
  // Cursor's MCP one-click format:
  //   cursor://anysphere.cursor-deeplink/mcp/install?name=<NAME>&config=<BASE64_CONFIG>
  // Where config is the base64-encoded JSON of just the server entry.
  const config = JSON.stringify({ command: SERVER_COMMAND, args: SERVER_ARGS });
  const b64 = Buffer.from(config, "utf8").toString("base64");
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(SERVER_NAME)}&config=${encodeURIComponent(b64)}`;
}

function buildVSCodeDeepLink(): string {
  // VS Code's MCP install URI (Copilot Chat / GitHub Copilot):
  //   vscode:mcp/install?<URL_ENCODED_JSON>
  // The JSON includes name, command, and args.
  const config = JSON.stringify({ name: SERVER_NAME, command: SERVER_COMMAND, args: SERVER_ARGS });
  return `vscode:mcp/install?${encodeURIComponent(config)}`;
}

function buildVSCodeInsidersDeepLink(): string {
  const config = JSON.stringify({ name: SERVER_NAME, command: SERVER_COMMAND, args: SERVER_ARGS });
  return `vscode-insiders:mcp/install?${encodeURIComponent(config)}`;
}

function buildClaudeCodeCommand(): string {
  return `claude mcp add ${SERVER_NAME} ${SERVER_COMMAND} ${SERVER_ARGS.join(" ")}`;
}

function buildClaudeDesktopJson(): string {
  return JSON.stringify(
    { mcpServers: { [SERVER_NAME]: { command: SERVER_COMMAND, args: SERVER_ARGS } } },
    null,
    2,
  );
}

function buildContinueYaml(): string {
  return `mcpServers:
  - name: ${SERVER_NAME}
    command: ${SERVER_COMMAND}
    args:
      - mcp`;
}

export function renderInstallPage(opts: InstallPageOptions = {}): string {
  const includeInstall = opts.includeInstallStep ?? true;
  const repo = opts.repo ?? "bhaulik/supacanvas";

  const cursorLink = buildCursorDeepLink();
  const vscodeLink = buildVSCodeDeepLink();
  const vscodeInsidersLink = buildVSCodeInsidersDeepLink();
  const claudeCodeCmd = buildClaudeCodeCommand();
  const claudeDesktopJson = buildClaudeDesktopJson();
  const continueYaml = buildContinueYaml();
  const installOneLiner = `curl -fsSL https://raw.githubusercontent.com/${repo}/main/install.sh | bash`;

  const installSection = includeInstall ? `
  <section class="card">
    <header class="card-head">
      <span class="step-no">№ 01</span>
      <h2 class="card-title">Install <em>Supacanvas</em></h2>
    </header>
    <p class="card-body">Skip if you already ran this. Installs Bun if missing, then supacanvas as a global CLI.</p>
    <div class="codeblock">
      <pre><code>${escapeHtml(installOneLiner)}</code></pre>
      <button class="copy-btn" data-copy="${escapeHtml(installOneLiner)}" type="button">Copy</button>
    </div>
  </section>` : "";

  const stepClients = includeInstall ? "№ 02" : "№ 01";

  const body = `
<main class="install-page">
  <header class="masthead">
    <p class="eyebrow">SC ⁄ Install ⁄ Vol. I</p>
    <h1 class="masthead-title"><span>Install</span> <em>Supacanvas</em>.</h1>
    <p class="deck">One click for Cursor and VS Code. One command for the rest. Local-first MCP server for AI-generated canvases — yours on disk, exportable, screenshottable.</p>
  </header>

  ${installSection}

  <section class="card">
    <header class="card-head">
      <span class="step-no">${stepClients}</span>
      <h2 class="card-title">Wire it into your AI client</h2>
    </header>
    <p class="card-body">Pick whichever you use — most people grab two or three.</p>

    <div class="clients">
      <article class="client featured">
        <header class="client-head">
          <h3>Cursor</h3>
          <span class="badge accent">One-click</span>
        </header>
        <a class="cta" href="${cursorLink}">+ Add Supacanvas to Cursor</a>
        <p class="hint">Opens Cursor and prompts you to confirm. Cursor handles the rest.</p>
      </article>

      <article class="client featured">
        <header class="client-head">
          <h3>VS Code</h3>
          <span class="badge accent">One-click</span>
        </header>
        <a class="cta" href="${vscodeLink}">+ Add to VS Code</a>
        <a class="cta-alt" href="${vscodeInsidersLink}">+ Add to VS Code Insiders</a>
        <p class="hint">Requires a recent VS Code with MCP support enabled (Copilot Chat or compatible extension).</p>
      </article>

      <article class="client">
        <header class="client-head">
          <h3>Claude Code</h3>
          <span class="badge">One command</span>
        </header>
        <div class="codeblock">
          <pre><code>${escapeHtml(claudeCodeCmd)}</code></pre>
          <button class="copy-btn" data-copy="${escapeHtml(claudeCodeCmd)}" type="button">Copy</button>
        </div>
      </article>

      <article class="client">
        <header class="client-head">
          <h3>Claude Desktop</h3>
          <span class="badge">Manual</span>
        </header>
        <p class="hint">Edit <code>${escapeHtml(CLAUDE_DESKTOP_PATH_MACOS)}</code> (macOS) and merge:</p>
        <div class="codeblock">
          <pre><code>${escapeHtml(claudeDesktopJson)}</code></pre>
          <button class="copy-btn" data-copy="${escapeHtml(claudeDesktopJson)}" type="button">Copy snippet</button>
        </div>
        <p class="hint">Restart Claude Desktop after saving.</p>
      </article>

      <article class="client">
        <header class="client-head">
          <h3>Continue</h3>
          <span class="badge">Manual (YAML)</span>
        </header>
        <p class="hint">Add to <code>${escapeHtml(CONTINUE_PATH)}</code>:</p>
        <div class="codeblock">
          <pre><code>${escapeHtml(continueYaml)}</code></pre>
          <button class="copy-btn" data-copy="${escapeHtml(continueYaml)}" type="button">Copy snippet</button>
        </div>
      </article>

      <article class="client">
        <header class="client-head">
          <h3>Other (any MCP client)</h3>
          <span class="badge">JSON</span>
        </header>
        <p class="hint">Drop this into the client's <code>mcpServers</code> map:</p>
        <div class="codeblock">
          <pre><code>${escapeHtml(claudeDesktopJson)}</code></pre>
          <button class="copy-btn" data-copy="${escapeHtml(claudeDesktopJson)}" type="button">Copy</button>
        </div>
      </article>
    </div>
  </section>

  <section class="card whisper">
    <header class="card-head">
      <span class="step-no">${includeInstall ? "№ 03" : "№ 02"}</span>
      <h2 class="card-title">Run the viewer</h2>
    </header>
    <p class="card-body">In another terminal, so the URLs your AI hands you actually render:</p>
    <div class="codeblock">
      <pre><code>supacanvas serve</code></pre>
      <button class="copy-btn" data-copy="supacanvas serve" type="button">Copy</button>
    </div>
    <p class="hint">Then ask your AI: <em>"create a canvas with a working analog clock"</em> or <em>"take a screenshot of canvas X and show me."</em></p>
  </section>

  <footer class="footnote">
    <span class="eyebrow">— FIN —</span>
  </footer>
</main>

<style>
  /* This page is reachable both at /install on the local server (where it
     inherits SHARED_CSS) and as a standalone file served from a website.
     Inline its own styles so it works without external CSS too. */
  .install-page {
    max-width: 920px;
    margin: 0 auto;
    padding: 56px 40px 80px;
    display: grid;
    gap: 32px;
  }
  .install-page .eyebrow {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 500;
    margin: 0;
  }
  .install-page .masthead { padding-bottom: 8px; }
  .install-page .masthead-title {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(48px, 9vw, 96px);
    line-height: 0.95;
    letter-spacing: -0.025em;
    margin: 18px 0 18px;
    color: var(--ink);
  }
  .install-page .masthead-title em {
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
  }
  .install-page .deck {
    font-size: 18px;
    color: var(--ink-2);
    margin: 0;
    max-width: 60ch;
    line-height: 1.5;
  }

  .install-page .card {
    background: var(--card);
    border: 1px solid var(--rule-2);
    border-radius: 16px;
    padding: 28px 32px 30px;
  }
  .install-page .card.whisper { background: transparent; border-style: dashed; }
  .install-page .card-head {
    display: flex; align-items: baseline; gap: 14px;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 14px; margin-bottom: 16px;
  }
  .install-page .step-no {
    font-family: var(--mono); font-size: 12px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--muted); font-weight: 500;
  }
  .install-page .card-title {
    font-family: var(--serif); font-weight: 400; font-style: normal;
    font-size: 30px; line-height: 1.05; letter-spacing: -0.015em;
    margin: 0; color: var(--ink);
  }
  .install-page .card-title em { font-style: italic; color: var(--accent); }
  .install-page .card-body {
    color: var(--ink-2); font-size: 15px; margin: 0 0 14px; line-height: 1.55;
  }

  .install-page .codeblock {
    position: relative;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 14px 56px 14px 16px;
    margin: 0;
    overflow-x: auto;
  }
  .install-page .codeblock pre {
    margin: 0;
    font-family: var(--mono);
    font-size: 13px;
    color: var(--ink);
    line-height: 1.5;
    white-space: pre;
  }
  .install-page .codeblock code { font-family: inherit; background: none; border: 0; padding: 0; }
  .install-page .copy-btn {
    position: absolute;
    top: 8px; right: 8px;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
    background: var(--card);
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 4px 10px;
    cursor: pointer;
    font-weight: 500;
    transition: color 180ms var(--easing), border-color 180ms var(--easing), background 180ms var(--easing);
  }
  .install-page .copy-btn:hover { color: var(--accent); border-color: var(--accent); }
  .install-page .copy-btn[data-copied] {
    color: var(--card); background: var(--accent); border-color: var(--accent);
  }
  .install-page .copy-btn[data-copied]::before { content: "✓ "; }

  .install-page .clients { display: grid; gap: 16px; }
  .install-page .client {
    border: 1px solid var(--rule);
    border-radius: 12px;
    padding: 20px 22px;
    background: var(--paper);
  }
  .install-page .client.featured {
    border-color: var(--rule-2);
    background: var(--card);
  }
  .install-page .client-head {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 12px; margin-bottom: 12px;
  }
  .install-page .client-head h3 {
    font-family: var(--serif); font-weight: 400; font-style: italic;
    font-size: 22px; margin: 0; color: var(--ink); line-height: 1;
  }
  .install-page .badge {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--ink-2);
    background: var(--paper); border: 1px solid var(--rule); border-radius: 999px;
    padding: 3px 9px; font-weight: 500;
  }
  .install-page .badge.accent {
    background: var(--accent); color: var(--card); border-color: var(--accent);
  }
  .install-page .cta {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 8px;
    font-family: var(--mono); font-size: 14px;
    letter-spacing: 0.04em; font-weight: 500;
    background: var(--ink); color: var(--card);
    padding: 12px 22px;
    border-radius: 999px;
    text-decoration: none;
    border-bottom: 0;
    transition: background 180ms var(--easing), transform 180ms var(--easing);
  }
  .install-page .cta:hover {
    background: var(--accent); transform: translateY(-1px); border-bottom: 0;
  }
  .install-page .cta-alt {
    display: inline-flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-size: 11px;
    letter-spacing: 0.12em; text-transform: uppercase; font-weight: 500;
    background: transparent; color: var(--ink-2);
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid var(--rule-2);
    text-decoration: none;
    margin-left: 8px;
    transition: color 180ms var(--easing), border-color 180ms var(--easing);
  }
  .install-page .cta-alt:hover { color: var(--accent); border-color: var(--accent); border-bottom: 1px solid var(--accent); }
  .install-page .hint {
    color: var(--ink-2); font-size: 13.5px; line-height: 1.55;
    margin: 12px 0 0; max-width: 60ch;
  }
  .install-page .hint code {
    font-family: var(--mono); font-size: 12px;
    background: var(--paper); border: 1px solid var(--rule);
    padding: 1px 6px; border-radius: 4px;
  }
  .install-page .hint em { font-style: italic; }

  .install-page .footnote {
    text-align: center; padding-top: 24px; color: var(--muted);
  }

  @media (max-width: 700px) {
    .install-page { padding: 32px 20px 60px; }
    .install-page .card { padding: 20px 22px 22px; }
    .install-page .cta { width: 100%; }
    .install-page .cta-alt { margin: 8px 0 0; width: 100%; }
  }
</style>

<script>
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(text);
        btn.dataset.copied = "1";
        setTimeout(() => delete btn.dataset.copied, 1200);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch {}
        document.body.removeChild(ta);
        btn.dataset.copied = "1";
        setTimeout(() => delete btn.dataset.copied, 1200);
      }
    });
  });
</script>`;

  return body;
}
