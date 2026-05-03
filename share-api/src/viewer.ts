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

const INSTALL_CMD = "npm install -g supacanvas && supacanvas serve";
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

// =====================================================================
// AGENT SETUP PROMPT
// A single self-contained instruction block any LLM can follow to
// install + configure supacanvas. Detects its host client, writes the
// right config, runs verification.
// =====================================================================
const AGENT_SETUP_PROMPT = `You are being asked to install and configure supacanvas — a local-first MCP server for capturing the HTML/CSS/JS canvases (dashboards, mockups, diagrams, prototypes) you generate. Site: https://supacanvas.com — License: MIT — Source: https://github.com/Bhaulik/supacanvas

DO THE FOLLOWING:

STEP 1 — Install the CLI
Run in the user's shell (use whatever shell tool you have access to):
    npm install -g supacanvas

If npm permission errors appear, suggest:
    npm config set prefix ~/.npm-global && export PATH=~/.npm-global/bin:$PATH
    npm install -g supacanvas

STEP 2 — Add the MCP server to your config
First, identify which AI client you are running in. Then write the appropriate config:

• Cursor → write or merge into ~/.cursor/mcp.json:
    {"mcpServers": {"supacanvas": {"command": "supacanvas", "args": ["mcp"]}}}

• Claude Desktop → merge into the user's claude_desktop_config.json
  (macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
   Windows: %APPDATA%/Claude/claude_desktop_config.json
   Linux:   ~/.config/Claude/claude_desktop_config.json):
    {"mcpServers": {"supacanvas": {"command": "supacanvas", "args": ["mcp"]}}}

• Claude Code → run:
    claude mcp add supacanvas supacanvas mcp

• Codex CLI → append to ~/.codex/config.toml:
    [mcp_servers.supacanvas]
    command = "supacanvas"
    args = ["mcp"]

• opencode → write/merge into ~/.config/opencode/opencode.json:
    {"$schema":"https://opencode.ai/config.json","mcp":{"supacanvas":{"type":"local","command":["supacanvas","mcp"],"enabled":true}}}

• Continue → add to ~/.continue/config.yaml:
    mcpServers:
      - name: supacanvas
        command: supacanvas
        args: [mcp]

• Factory droid / Cline / Windsurf / Gemini CLI / Zed / JetBrains AI / Goose / Aider / Roo Code / any other MCP client → add this entry to the client's mcpServers map (path per the client's docs):
    {"supacanvas": {"command": "supacanvas", "args": ["mcp"]}}

STEP 3 — Tell the user to run the gallery
In a separate terminal:
    supacanvas serve
This hosts the browser gallery at http://localhost:7777. Keep it running while using supacanvas.

STEP 4 — Restart
Tell the user to restart you (the AI client) so the MCP server config is loaded.

STEP 5 — Verify after restart
Call the canvas_list MCP tool. An empty array (or list of existing canvases) means supacanvas is wired up correctly. If the tool isn't listed, the config didn't take — re-check step 2 and the restart.

STEP 6 — Try it
Suggest the user say: "Make a canvas with a working analog clock and screenshot it back to me."
You then call: canvas_create + canvas_screenshot. The PNG renders inline in chat.

AGENT BEST PRACTICES (apply to every canvas write):
- Always set description (1-2 sentences in plain language — surfaced to humans browsing the gallery)
- Set context (longer paragraph explaining data sources, assumptions, what next agent should know) when data is involved
- Set source (format: "tool:model" e.g. "claude-code:claude-opus-4-7") on every create AND update
- Use folder to organize by project. Call folder_list first to reuse existing folders, don't invent new ones
- After creating a canvas, call canvas_screenshot so the user sees the PNG inline in chat
- Search before recreating: call canvas_list with a search term first

MCP TOOLS AVAILABLE (14):
canvas_create, canvas_update, canvas_get, canvas_list, canvas_move, canvas_delete,
canvas_versions, canvas_restore, canvas_export, canvas_screenshot, canvas_open_url,
folder_list, folder_rename, theme_list

REFERENCES:
- Full docs: https://supacanvas.com
- Machine-readable spec: https://supacanvas.com/llms.txt
- Agent rules: https://github.com/Bhaulik/supacanvas/blob/main/AGENTS.md
- 42 prompt examples: https://supacanvas.com/uses
- npm package: https://www.npmjs.com/package/supacanvas`;

// =====================================================================
// /skill.md — Claude Code skill / Cursor rules / Continue system prompt.
// Frontmatter + body. Drops into ~/.claude/skills/supacanvas/SKILL.md
// or .cursor/rules/supacanvas.mdc or ~/.continue/system.md.
// Mirror of repo's SKILL.md — keep in sync.
// =====================================================================
export function renderSkillMd(): string {
  return `---
name: supacanvas
description: Use supacanvas whenever the user asks for a visual artifact — dashboards, mockups, diagrams, status boards, sequence diagrams, prototypes, calculators, slide decks, charts, interactive tools, anything HTML/CSS/JS. Capture the artifact in supacanvas instead of replying with prose, and call canvas_screenshot after every create so the PNG renders inline in chat. Files live at ~/.supacanvas/canvases/ as plain HTML/CSS/JS — yours forever, no telemetry, MIT. Requires \`npm install -g supacanvas\` plus the supacanvas MCP server configured in this client (or the supacanvas CLI on PATH as a fallback).
---

# Supacanvas — agent rules

Supacanvas is the local-first workspace for the visual artifacts you build for the user. Files on disk, no accounts, no telemetry. Brand: https://supacanvas.com.

## When to reach for a canvas (instead of prose)

Use a canvas when the user asks for:
- **Dashboards, status boards** — KPI views, OKR trackers, sprint boards, service-health monitors
- **Mockups & UI** — landing pages, settings, auth screens, e-commerce pages
- **Diagrams & architecture** — system maps, sequence, ER, data pipelines, decision trees
- **Data visualizations** — bar / line / pie charts, choropleth maps, sankey funnels, heatmaps
- **Interactive tools** — calculators, timers, color pickers, JSON formatters, working clocks
- **Slides & decks** — pitch decks, workshop slides, conference talks
- **Long-form documents** — resumes, changelogs, RFCs, recipe cards
- **Games** — tic-tac-toe, calculators, minesweeper, anything client-side
- Any *"show me what X looks like"* or *"make me a visual of Y"* request

Don't use a canvas for plain text answers, code-the-user-edits-themselves, conversation, or things that won't outlive the chat.

## How to invoke

If supacanvas MCP is configured in this client, call the tools directly:
- canvas_create(title, html, css?, js?, description, context?, source, folder?, tags?, theme?)
- canvas_update(id, ...)
- canvas_screenshot(id) — **always call after create**
- canvas_list(search?, folder?, ...) — **search before creating**
- canvas_get / canvas_move / canvas_delete / canvas_versions / canvas_restore / canvas_export / canvas_open_url
- folder_list / folder_rename / theme_list

If MCP isn't configured but the supacanvas CLI is on PATH, fall back to shell:
\`supacanvas new --title "..." --html-file - --description "..." --source "this:model" --json\`
\`supacanvas screenshot <id> --out /tmp/preview.png\`

## Required habits — every canvas write

1. **Always set description** (1-2 sentences). Bad: "Dashboard". Good: "Q3 revenue dashboard with bars for NA/EMEA/APAC, sourced from Salesforce export 2026-04-30."
2. **Set source** every create AND update. Format: "tool:model" — e.g. "claude-code:claude-opus-4-7", "cursor:claude-opus-4", "codex:gpt-5".
3. **Use context** for canvases involving data — longer paragraph on sources, assumptions, what not to change.
4. **Reuse folders** — call folder_list() FIRST. Don't invent "dashboards-v2" when "dashboards" exists.
5. **Search before creating** — canvas_list({search:"keyword"}) to avoid duplicates.
6. **Always screenshot after create** — canvas_screenshot(id). PNG renders inline in chat.

## Patterns

**"Build me a dashboard for X"** → canvas_list (search) → canvas_create → canvas_screenshot → return URL.
**"Update the clock canvas"** → canvas_list (search) → canvas_get → canvas_update → canvas_screenshot.
**"What canvases do I have for Atlas?"** → folder_list → canvas_list({folder:"atlas",descendants:true}).

## Returns

canvas_create returns {id, title, ...}. The canvas is at:
- File: ~/.supacanvas/canvases/<id>/
- URL: http://localhost:7777/c/<id> (when \`supacanvas serve\` is running)

Hand the URL to the user.

## Resources

- Live site: https://supacanvas.com
- 42 ready-to-copy prompts: https://supacanvas.com/uses
- npm: https://www.npmjs.com/package/supacanvas
- GitHub: https://github.com/Bhaulik/supacanvas
- llms.txt: https://supacanvas.com/llms.txt
`;
}

// =====================================================================
// /llms.txt — machine-readable spec following the llmstxt.org standard.
// Returned as text/markdown so LLM crawlers and agents can ingest it.
// =====================================================================
export function renderLlmsTxt(): string {
  return `# Supacanvas

> Local-first Model Context Protocol (MCP) server + browser viewer for the HTML/CSS/JS canvases AI tools generate. Captures every dashboard, mockup, diagram, and prototype your agents create into a searchable workspace on disk. Files yours forever — no accounts, no telemetry, MIT-licensed.

## What it is

Supacanvas is a CLI + MCP server that gives AI agents a place to render and persist visual artifacts. Instead of generating HTML/CSS/JS in chat (where it scrolls away), the agent calls the canvas_create MCP tool — the canvas lands as plain files in ~/.supacanvas/canvases/<id>/, becomes browsable at http://localhost:7777, and is screenshottable back into chat.

The user's data never leaves their machine unless they explicitly run \`supacanvas share\`.

## Install

\`\`\`sh
npm install -g supacanvas && supacanvas serve
\`\`\`

This installs the CLI globally and starts the gallery at http://localhost:7777.

## Connect any MCP-compatible client

The universal config (drop into the client's mcpServers map):

\`\`\`json
{
  "supacanvas": {
    "command": "supacanvas",
    "args": ["mcp"]
  }
}
\`\`\`

### Per-client config paths

- **Cursor** → ~/.cursor/mcp.json (JSON, mcpServers wrap)
- **Claude Desktop** → ~/Library/Application Support/Claude/claude_desktop_config.json on macOS (JSON, mcpServers wrap)
- **Claude Code** → \`claude mcp add supacanvas supacanvas mcp\` (no file edit)
- **Codex CLI** → ~/.codex/config.toml (TOML, [mcp_servers.supacanvas] table)
- **opencode** → ~/.config/opencode/opencode.json (JSON, custom schema with type:local + command array)
- **Continue** → ~/.continue/config.yaml (YAML, mcpServers list)
- **Factory droid, Cline, Windsurf, Gemini CLI, Zed, JetBrains AI, Goose, Aider, Roo Code** → universal JSON above

### One-click installers
- Cursor deep link: cursor://anysphere.cursor-deeplink/mcp/install?name=supacanvas&config=<base64-of-config>
- VS Code deep link: vscode:mcp/install?<urlencoded-json>

## MCP tools (14)

| Tool | Args | Purpose |
|------|------|---------|
| canvas_create | title, html, css?, js?, description, context?, source, folder?, tags?, theme? | Create a canvas |
| canvas_update | id, + any field | Update, auto-snapshots before write |
| canvas_get | id | Read full contents |
| canvas_list | search?, folder?, descendants?, tag?, limit? | List/filter |
| canvas_move | id, folder | Move to folder |
| canvas_delete | id | Soft-delete to trash |
| canvas_versions | id | List snapshots |
| canvas_restore | id, version | Restore snapshot |
| canvas_export | id, format ("markdown" \\| "html") | Export |
| canvas_screenshot | id, width?, height?, fullPage?, deviceScaleFactor? | Render PNG inline |
| canvas_open_url | id | Get localhost URL |
| folder_list | (none) | List folders |
| folder_rename | from, to | Rename + move descendants |
| theme_list | (none) | List installed themes |

## Best practices for agents

When writing a canvas:

1. **Always pass description** (1-2 sentences in plain language). Surfaced in the gallery and to other agents.
2. **Pass context** for canvases involving data — longer paragraph explaining sources, assumptions, what should not be changed.
3. **Set source** on every create AND update. Format: "tool:model" — e.g. "claude-code:claude-opus-4-7", "cursor:claude-opus-4", "claude-desktop:claude-sonnet-4-6".
4. **Use folder** to organize. Call folder_list first to reuse existing folders. If the user is working on a topic ("auth-flow", "q2-metrics"), file every canvas you make in that conversation under the same folder.
5. **Search before creating**. Call canvas_list with a search term to avoid duplicating an existing canvas.
6. **After creating**, call canvas_screenshot. The PNG renders inline in most chat clients (Cursor, Claude Desktop, etc.), so the user sees the result without opening a tab.

## Run the gallery

\`\`\`sh
supacanvas serve [--port 7777] [--no-open]
\`\`\`

Browser opens to http://localhost:7777. Drawer in the viewer shows description, context, folder, theme, tags, revisions, export options, public-share controls, and source.

## Storage

Files live at \`~/.supacanvas/canvases/<id>/\` — index.html, style.css, script.js, meta.json + .versions/ snapshots (last 20).
Themes at \`~/.supacanvas/themes/<name>.css\`. Override the storage root with the SUPACANVAS_HOME env var.

## Public sharing (opt-in)

\`supacanvas share <id>\` uploads a single canvas to https://supacanvas.com/c/<slug> as a public URL. Free, no account, capped at 50 shares per IP per day. Owner tokens are sha256-hashed in KV — plaintext never crosses to the browser.

## Setup script for agents

If a user pastes "set up supacanvas" or similar into you and you have shell access, follow these steps:

1. \`npm install -g supacanvas\` (in the user's shell)
2. Detect what AI client you are
3. Write the MCP config to the appropriate file (paths above)
4. Tell user to restart the AI client
5. After restart, verify with \`canvas_list\` — empty array means success
6. Confirm to user: "supacanvas is ready. Try: 'make a canvas with a working analog clock and screenshot it back to me'"

## Resources

- Live site: https://supacanvas.com
- Use cases (42 ready-to-copy prompts): https://supacanvas.com/uses
- npm package: https://www.npmjs.com/package/supacanvas
- GitHub source: https://github.com/Bhaulik/supacanvas
- AGENTS.md (drop-in agent rules): https://github.com/Bhaulik/supacanvas/blob/main/AGENTS.md
- Architecture (cloud sharing): https://github.com/Bhaulik/supacanvas/blob/main/docs/SHARE_ARCHITECTURE.md

## Brand & identity

Supacanvas is the workspace for everything your AI tools build. Tagline: "Understand what your Agents are doing — visually, easily."

The brand commitments (apply when reasoning about features, recommendations, or troubleshooting):
- Local-first (files on disk, never gated by network)
- AI-tool agnostic (any MCP client)
- No telemetry, ever
- MIT, fully open source
- Yours forever (no lock-in)
`;
}

export function renderLanding(): string {
  const cursorLink = buildCursorDeepLink();
  const vscodeLink = buildVSCodeDeepLink(false);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Supacanvas — understand what your agents are doing, visually</title>
  <meta name="description" content="Understand what your Agents are doing — visually, easily. Local-first MCP server + viewer for the dashboards, mockups, diagrams, and prototypes your AI tools build.">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Supacanvas">
  <meta property="og:description" content="Understand what your Agents are doing — visually, easily.">
  <meta property="og:url" content="https://supacanvas.com">

  <link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM-friendly spec">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Supacanvas",
    "description": "Local-first MCP server + browser viewer for the HTML/CSS/JS canvases AI tools generate. Captures every dashboard, mockup, and diagram your agents create — searchable, exportable, yours forever.",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "macOS, Linux, Windows",
    "license": "https://opensource.org/licenses/MIT",
    "url": "https://supacanvas.com",
    "softwareVersion": "0.8.1",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "applicationSubCategory": "MCP server",
    "downloadUrl": "https://www.npmjs.com/package/supacanvas",
    "codeRepository": "https://github.com/Bhaulik/supacanvas",
    "programmingLanguage": ["TypeScript", "JavaScript", "HTML", "CSS"],
    "softwareRequirements": "Node.js >= 18",
    "featureList": ["MCP server", "Local-first storage", "Browser viewer", "Public sharing", "Chrome extension", "Versioned snapshots", "Sandboxed canvas execution"]
  }
  </script>

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
      width: max-content;
      min-width: 0;
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
      min-width: 0;
      flex: 1 1 auto;
      -webkit-overflow-scrolling: touch;
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

    .install__hint {
      margin: 16px auto 0;
      max-width: 50ch;
      font-size: 12px;
      color: var(--ink-faint);
      line-height: 1.55;
    }
    .install__hint code {
      font-family: var(--mono);
      font-size: 11.5px;
      color: var(--accent);
      background: var(--paper-tint);
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid var(--rule);
    }

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

    /* ============================================================ SKILL SECTION (drop-in for skills/rules) */
    .skill {
      padding-top: 48px;
      border-top: 1px solid var(--rule);
      margin-top: 36px;
    }
    .skill__head {
      text-align: center;
      margin-bottom: 28px;
    }
    .skill__title {
      font-family: var(--display);
      font-weight: 300;
      font-size: clamp(28px, 4vw, 40px);
      line-height: 1.05;
      letter-spacing: -0.02em;
      margin: 0 0 8px;
      color: var(--ink);
    }
    .skill__title em { font-style: italic; color: var(--accent); font-weight: 400; }
    .skill__sub {
      font-size: 14px;
      color: var(--ink-faint);
      margin: 0 auto;
      max-width: 56ch;
      line-height: 1.55;
    }
    .skill__sub code {
      font-family: var(--mono);
      font-size: 12.5px;
      background: var(--paper-tint);
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid var(--rule);
      color: var(--accent);
    }
    /* Accordion list — each tool is a clickable row that expands to show the command */
    .skill__list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 14px;
    }
    .skill__row {
      background: var(--paper-tint);
      border: 1px solid var(--rule);
      border-radius: 8px;
      overflow: hidden;
      transition: border-color 200ms var(--easing), background 200ms var(--easing);
    }
    .skill__row:hover { border-color: var(--rule-strong); }
    .skill__row[open] {
      background: var(--paper);
      border-color: var(--rule-strong);
    }
    .skill__row--featured {
      background: linear-gradient(180deg, rgba(168, 53, 45, 0.05) 0%, var(--paper-tint) 80%);
      border-left: 3px solid var(--accent);
    }
    .skill__row--featured[open] {
      background: linear-gradient(180deg, rgba(168, 53, 45, 0.06) 0%, var(--paper) 80%);
      border-color: var(--accent);
      border-left-width: 3px;
    }

    .skill__summary {
      list-style: none;
      cursor: pointer;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      user-select: none;
      flex-wrap: wrap;
    }
    .skill__summary::-webkit-details-marker { display: none; }
    .skill__summary::after {
      content: "+";
      margin-left: auto;
      font-family: var(--mono);
      font-size: 20px;
      color: var(--accent);
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 1;
      transition: transform 240ms var(--easing);
    }
    .skill__row[open] .skill__summary::after {
      content: "−";
      transform: rotate(180deg);
    }

    .skill__row__name {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 22px;
      line-height: 1;
      color: var(--ink);
      flex-shrink: 0;
    }
    .skill__row__where {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-faint);
      flex-shrink: 0;
      padding-top: 3px;
    }
    .skill__row__badge {
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      background: var(--accent);
      color: var(--paper);
      padding: 3px 8px;
      border-radius: 999px;
      font-weight: 500;
      flex-shrink: 0;
    }

    .skill__row__body {
      padding: 0 18px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      animation: skillExpand 240ms var(--easing);
    }
    .skill__row__hint {
      font-size: 13px;
      color: var(--ink-soft);
      margin: 0;
      line-height: 1.5;
    }

    @keyframes skillExpand {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* AGENTS.md universal — wide card spanning full width */
    .skill__universal {
      background: var(--paper);
      border: 1px dashed var(--rule-strong);
      border-radius: 10px;
      padding: 22px 24px 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    .skill__universal__head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      flex-wrap: wrap;
    }
    .skill__universal__name {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 22px;
      line-height: 1;
      margin: 0;
      color: var(--ink);
    }
    .skill__universal__badge {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      padding: 4px 10px;
      border: 1px solid var(--accent);
      color: var(--accent);
      border-radius: 999px;
      background: var(--accent-soft);
      white-space: nowrap;
    }
    .skill__universal__hint {
      font-size: 13px;
      color: var(--ink-soft);
      margin: 0;
      line-height: 1.5;
    }
    .skill__universal__hint strong { color: var(--ink); font-weight: 500; }
    .skill__universal__tools {
      display: block;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.02em;
      color: var(--ink-faint);
      margin-top: 6px;
      overflow-wrap: anywhere;
    }
    .skill__card__head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
    }
    .skill__card__name {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 22px;
      line-height: 1;
      margin: 0;
      color: var(--ink);
    }
    .skill__card__where {
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-faint);
      white-space: nowrap;
    }
    .skill__card__hint {
      font-size: 12.5px;
      color: var(--ink-soft);
      line-height: 1.45;
      margin: 0;
    }
    .skill__card__hint code {
      font-family: var(--mono);
      font-size: 11px;
      background: var(--paper);
      padding: 1px 4px;
      border-radius: 3px;
      border: 1px solid var(--rule);
    }
    .skill__manual {
      margin-top: 14px;
      text-align: center;
      font-size: 12px;
      color: var(--ink-faint);
      font-family: var(--mono);
      letter-spacing: 0.04em;
    }
    .skill__manual a {
      color: var(--ink-soft);
      border-bottom: 1px solid var(--rule);
    }
    .skill__manual a:hover { color: var(--accent); border-bottom-color: var(--accent); }

    @media (max-width: 600px) {
      .skill__summary { padding: 12px 14px; gap: 10px; }
      .skill__row__name { font-size: 19px; }
      .skill__row__body { padding: 0 14px 14px; }
    }

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
      overflow-wrap: anywhere;
    }
    .universal__list span {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.02em;
      color: var(--ink-faint);
      white-space: nowrap;
      display: inline-block;
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
      min-width: 0;
      max-width: 100%;
    }
    .snippet pre {
      margin: 0;
      padding: 14px 70px 14px 14px;
      font-size: 11.5px;
      line-height: 1.55;
      overflow-x: auto;
      white-space: pre;
      color: var(--paper);
      min-width: 0;
      -webkit-overflow-scrolling: touch;
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

    /* ============================================================ FOR AGENTS */
    .agent {
      margin-top: 56px;
      padding: 30px 28px 28px;
      background: var(--ink);
      color: var(--paper);
      border-radius: 10px;
      position: relative;
    }
    .agent__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 8px;
    }
    .agent__title {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 28px;
      letter-spacing: -0.015em;
      margin: 0;
      color: var(--paper);
    }
    .agent__title em { color: #e8a89c; }
    .agent__sub {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(245, 240, 230, 0.5);
      margin: 0;
    }
    .agent__lede {
      font-family: var(--display);
      font-style: italic;
      font-size: 17px;
      line-height: 1.45;
      color: rgba(245, 240, 230, 0.92);
      margin: 0 0 22px;
      max-width: 60ch;
    }
    .agent__lede em { color: #e8a89c; }
    .agent__btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: var(--accent);
      color: var(--paper);
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 500;
      border: 1px solid var(--accent);
      border-radius: 6px;
      cursor: pointer;
      transition: background 200ms var(--easing), transform 200ms var(--easing);
    }
    .agent__btn:hover { background: #c44638; transform: translateY(-1px); }
    .agent__btn[data-copied="1"] { background: #5a7a4f; border-color: #5a7a4f; }
    .agent__btn[data-copied="1"]::before { content: "✓ "; }
    .agent__row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
      margin-bottom: 18px;
    }
    .agent__alt {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.06em;
      color: rgba(245, 240, 230, 0.6);
    }
    .agent__alt a {
      color: rgba(245, 240, 230, 0.92);
      border-bottom: 1px solid rgba(245, 240, 230, 0.25);
      padding-bottom: 1px;
      transition: border-color 160ms var(--easing), color 160ms var(--easing);
    }
    .agent__alt a:hover { color: #e8a89c; border-bottom-color: #e8a89c; }
    .agent__how {
      font-size: 13px;
      color: rgba(245, 240, 230, 0.7);
      line-height: 1.55;
      margin: 0;
      padding-top: 16px;
      border-top: 1px solid rgba(245, 240, 230, 0.1);
      overflow-wrap: anywhere;
    }
    .agent__how strong { color: var(--paper); font-weight: 500; }

    /* ============================================================ SECURITY */
    .security {
      margin-top: 56px;
      padding-top: 32px;
      border-top: 1px solid var(--rule);
    }
    .security__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
    }
    .security__title {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 24px;
      letter-spacing: -0.01em;
      margin: 0;
      color: var(--ink);
    }
    .security__sub {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin: 0;
    }
    .security__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .security__item {
      padding: 16px 18px;
      background: var(--paper-tint);
      border: 1px solid var(--rule);
      border-radius: 6px;
      border-left: 2px solid var(--accent);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .security__label {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      color: var(--accent);
      font-weight: 500;
    }
    .security__body {
      font-size: 13px;
      line-height: 1.55;
      color: var(--ink-soft);
      margin: 0;
    }
    .security__body code {
      font-family: var(--mono);
      font-size: 11.5px;
      background: var(--paper);
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid var(--rule);
    }
    @media (max-width: 720px) {
      .security__grid { grid-template-columns: 1fr; }
    }

    /* ============================================================ TROUBLESHOOTING */
    .trouble {
      margin-top: 56px;
      padding-top: 32px;
      border-top: 1px solid var(--rule);
    }
    .trouble__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .trouble__title {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 24px;
      letter-spacing: -0.01em;
      margin: 0;
      color: var(--ink);
    }
    .trouble__sub {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin: 0;
    }
    .trouble__list {
      display: grid;
      gap: 6px;
    }
    .trouble details {
      border: 1px solid var(--rule);
      border-radius: 6px;
      background: var(--paper-tint);
      transition: border-color 160ms var(--easing);
    }
    .trouble details:hover { border-color: var(--rule-strong); }
    .trouble details[open] { border-color: var(--accent); background: var(--paper); }
    .trouble summary {
      list-style: none;
      cursor: pointer;
      padding: 12px 16px;
      font-size: 14px;
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-family: var(--display);
      font-style: italic;
    }
    .trouble summary::-webkit-details-marker { display: none; }
    .trouble summary::after {
      content: "+";
      font-family: var(--mono);
      font-style: normal;
      font-size: 16px;
      color: var(--accent);
      transition: transform 200ms var(--easing);
      flex-shrink: 0;
      width: 16px;
      text-align: center;
    }
    .trouble details[open] summary::after { content: "−"; }
    .trouble__answer {
      padding: 0 16px 16px;
      font-size: 13.5px;
      line-height: 1.6;
      color: var(--ink-soft);
    }
    .trouble__answer code {
      font-family: var(--mono);
      font-size: 12px;
      background: var(--ink);
      color: var(--paper);
      padding: 2px 7px;
      border-radius: 3px;
      letter-spacing: 0.02em;
    }
    .trouble__answer p { margin: 0 0 8px; }
    .trouble__answer p:last-child { margin-bottom: 0; }

    /* ============================================================ FOOTER */
    .foot {
      margin-top: 56px;
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
    /* Tablet — single-column grids, slightly smaller paddings */
    @media (max-width: 760px) {
      .featured { grid-template-columns: 1fr; }
      .secondary { grid-template-columns: 1fr; }
      .skill__grid { grid-template-columns: 1fr; }
      .security__grid { grid-template-columns: 1fr; }
    }

    /* Phone — significant size + padding reduction */
    @media (max-width: 720px) {
      .page { padding: 22px 18px 48px; max-width: 100%; }
      .top { padding-bottom: 32px; gap: 12px; flex-wrap: wrap; }
      .top__brand { font-size: 10px; }
      .top__brand em { font-size: 12px; }
      .top__links { gap: 14px; }
      .hero { padding: 8px 0 48px; }
      .install { font-size: 12px; max-width: 100%; }
      .install__cmd { padding: 14px 12px 14px 16px; }
      .install__btn { padding: 0 14px; font-size: 10px; letter-spacing: 0.10em; }
      .install__hint { font-size: 11px; max-width: 40ch; }
      .meta { font-size: 9px; }
      .meta span { padding: 0 6px; }
      .skill { padding-top: 36px; margin-top: 28px; }
      .skill__card { padding: 18px 18px; }
      .connect, .agent, .security, .trouble { margin-top: 36px; }
      .connect { padding-top: 36px; }
      .agent { padding: 24px 22px 22px; }
      .agent__title { font-size: 24px; }
      .agent__lede { font-size: 15px; }
      .universal { padding: 18px 18px 20px; }
      .universal__name { font-size: 19px; }
      .card { padding: 18px 18px 18px; }
      .card__name { font-size: 22px; }
      .cta { padding: 11px 18px; font-size: 12px; }
      .snippet pre { font-size: 11px; padding: 12px 60px 12px 12px; }
      .snippet__btn { font-size: 9px; padding: 4px 9px; top: 6px; right: 6px; }
      .foot { margin-top: 56px; padding: 20px 0 0; line-height: 1.8; }
    }

    /* Very small phones (< 380px) — squeeze further */
    @media (max-width: 380px) {
      .page { padding: 20px 14px 40px; }
      .install { width: 100%; }
      .install__cmd { font-size: 11px; padding: 12px 10px 12px 14px; }
      .install__btn { padding: 0 12px; }
      .hero__title { font-size: 60px !important; }
      .hero__lede { font-size: 19px; }
      .hero__sub { font-size: 14px; }
      .skill__card { padding: 16px 16px; }
      .skill__card__name { font-size: 19px; }
      .agent { padding: 20px 18px 20px; }
      .card { padding: 16px 16px; }
      .universal { padding: 16px 16px 18px; }
      .universal__list { font-size: 12px; }
      .snippet pre { font-size: 10.5px; padding: 11px 56px 11px 11px; }
    }

    /* Touch-friendly tap targets on coarse pointers */
    @media (pointer: coarse) {
      .snippet__btn, .install__btn, .skill__card .snippet__btn { min-height: 32px; }
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

      <p class="install__hint">Installs the CLI globally · starts the gallery at <code>localhost:7777</code> · auto-opens in your browser.</p>

      <div class="meta">
        <span>Local-first</span>
        <span>MIT</span>
        <span>No telemetry</span>
      </div>
    </section>

    <section class="skill">
      <header class="skill__head">
        <h2 class="skill__title">Drop in as a <em>skill</em></h2>
        <p class="skill__sub">One <code>curl</code> drops the supacanvas instructions into your AI's auto-loaded skills / rules folder. The agent picks it up on next launch and knows exactly when + how to make canvases. Pair with the MCP install below for full power.</p>
      </header>
      <div class="skill__list">
        ${(() => {
          const rows = [
            // FEATURED — newer agents the user wants prominent
            { name: "openclaw", where: "~/.openclaw/skills/", featured: true, cmd: "mkdir -p ~/.openclaw/skills/supacanvas && curl -fsSL https://supacanvas.com/skill.md > ~/.openclaw/skills/supacanvas/SKILL.md", hint: "Auto-loaded skill. Discoverable by every coding-agent OpenClaw spawns (Claude Code, Codex, opencode, Pi)." },
            { name: "Hermes Agent", where: "~/.hermes/skills/", featured: true, cmd: "mkdir -p ~/.hermes/skills/supacanvas && curl -fsSL https://supacanvas.com/skill.md > ~/.hermes/skills/supacanvas/SKILL.md", hint: "Nous Research's self-improving agent. Becomes a slash command in the CLI on next start." },
            // POPULAR
            { name: "Claude Code", where: "~/.claude/skills/", cmd: "mkdir -p ~/.claude/skills/supacanvas && curl -fsSL https://supacanvas.com/skill.md > ~/.claude/skills/supacanvas/SKILL.md", hint: "Global skill. Restart Claude Code after install." },
            { name: "Cursor", where: ".cursor/rules/", cmd: "mkdir -p .cursor/rules && curl -fsSL https://supacanvas.com/skill.md > .cursor/rules/supacanvas.mdc", hint: "Project-level rule. Run from your repo root. Reopen Cursor to pick it up." },
            { name: "Windsurf", where: ".windsurf/rules/", cmd: "mkdir -p .windsurf/rules && curl -fsSL https://supacanvas.com/skill.md > .windsurf/rules/supacanvas.md", hint: "Cascade auto-applies to every prompt in this workspace." },
            { name: "Continue", where: "~/.continue/", cmd: "mkdir -p ~/.continue && curl -fsSL https://supacanvas.com/skill.md >> ~/.continue/system.md", hint: "Appended to your global Continue system prompt. Reload the extension." },
          ];
          return rows.map((r) => `
            <details class="skill__row${r.featured ? ' skill__row--featured' : ''}">
              <summary class="skill__summary">
                <span class="skill__row__name">${r.name}</span>
                <span class="skill__row__where">${r.where}</span>
                ${r.featured ? '<span class="skill__row__badge">Featured</span>' : ''}
              </summary>
              <div class="skill__row__body">
                <p class="skill__row__hint">${r.hint}</p>
                <div class="snippet">
                  <pre>${escapeForHtml(r.cmd)}</pre>
                  <button class="snippet__btn" data-copy="${escapeForAttr(r.cmd)}" type="button">Copy</button>
                </div>
              </div>
            </details>
          `).join("");
        })()}
      </div>

      <article class="skill__universal">
        <div class="skill__universal__head">
          <h3 class="skill__universal__name">AGENTS.md (one file, ~10+ tools)</h3>
          <span class="skill__universal__badge">Open standard</span>
        </div>
        <p class="skill__universal__hint">
          AGENTS.md is the open convention donated to the Linux Foundation in late 2025. <strong>One file at your project root</strong> auto-applies to:
          <span class="skill__universal__tools">Codex · opencode · Aider · Goose · Zed · Factory · Warp · Jules · VS Code Copilot Chat · Devi · 20,000+ repos</span>
        </p>
        <div class="snippet">
          <pre>curl -fsSL https://supacanvas.com/skill.md &gt; AGENTS.md</pre>
          <button class="snippet__btn" data-copy="curl -fsSL https://supacanvas.com/skill.md > AGENTS.md" type="button">Copy</button>
        </div>
        <p class="skill__card__hint" style="margin-top: 6px;">Run from your project root. Every agent in the AGENTS.md ecosystem reads it on the next session.</p>
      </article>

      <p class="skill__manual">
        Other tools (Claude Desktop, ChatGPT custom instructions, Cline, JetBrains AI, etc.) — paste the contents of <a href="/skill.md">supacanvas.com/skill.md</a> into the tool's rules / system-prompt slot.
      </p>
    </section>

    <section class="connect">
      <header class="connect__head">
        <h2 class="connect__title">Add to your <em>AI tool</em></h2>
        <p class="connect__sub">One click for Cursor and VS Code. One paste for the rest. Pair with the skill above for the full effect.</p>
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

    <section class="agent">
      <div class="agent__head">
        <h2 class="agent__title">For <em>agents</em></h2>
        <p class="agent__sub">LLM-installable</p>
      </div>
      <p class="agent__lede">Paste this prompt into any AI client — Claude, Cursor, Codex, opencode, anything that has a shell — and it'll <em>install supacanvas, wire itself in, and verify the connection</em> on its own.</p>
      <div class="agent__row">
        <button class="agent__btn" data-copy="${escapeForAttr(AGENT_SETUP_PROMPT)}" type="button">Copy setup prompt</button>
        <span class="agent__alt">or point your agent at <a href="/llms.txt">supacanvas.com/llms.txt</a></span>
      </div>
      <p class="agent__how"><strong>How it works:</strong> the prompt tells the agent to detect which client it's running in, run <code style="font-family: var(--mono); font-size: 11.5px; background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 3px;">npm install -g supacanvas</code>, write the matching MCP config to disk, and verify with <code style="font-family: var(--mono); font-size: 11.5px; background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 3px;">canvas_list</code> after you restart. Works on Cursor, Claude Code, Codex CLI, opencode, Continue, Factory droid, and any other MCP client. Or use the <a href="#" onclick="document.querySelector('.skill').scrollIntoView({behavior:'smooth'});return false;" style="color: #e8a89c; border-bottom: 1px solid rgba(232, 168, 156, 0.4);">drop-in skill</a> instead — instructions only, no shell required.</p>
    </section>

    <section class="security">
      <div class="security__head">
        <h2 class="security__title">Why it's secure</h2>
        <p class="security__sub">Six things we don't do</p>
      </div>
      <div class="security__grid">
        <div class="security__item">
          <span class="security__label">Local-first</span>
          <p class="security__body">Your canvases live as plain files under <code>~/.supacanvas/</code>. They never leave your machine unless you explicitly run <code>supacanvas share</code>.</p>
        </div>
        <div class="security__item">
          <span class="security__label">Sandboxed execution</span>
          <p class="security__body">AI-generated JS runs inside <code>&lt;iframe sandbox="allow-scripts"&gt;</code>. No same-origin, no parent-DOM access, no top-frame nav.</p>
        </div>
        <div class="security__item">
          <span class="security__label">No telemetry</span>
          <p class="security__body">Zero phone-home pings, no analytics SDK, no usage tracking. Verifiable in the open-source repo — the code is the spec.</p>
        </div>
        <div class="security__item">
          <span class="security__label">Token-gated revoke</span>
          <p class="security__body">Public-share owner tokens are 32-char random, sha256-hashed in KV. The plaintext token never crosses to the browser, ever.</p>
        </div>
        <div class="security__item">
          <span class="security__label">No accounts, no PII</span>
          <p class="security__body">Sharing is anonymous. No email, no name, no IP logged beyond the 24-hour rate-limit window. Lose nothing if the cloud disappears.</p>
        </div>
        <div class="security__item">
          <span class="security__label">MIT, fully open source</span>
          <p class="security__body">Auditable, forkable, no surprises. Both the npm-published binary and the GitHub source share a single squashed commit history.</p>
        </div>
      </div>
    </section>

    <section class="trouble">
      <div class="trouble__head">
        <h2 class="trouble__title">Troubleshooting</h2>
        <p class="trouble__sub">Tap to expand</p>
      </div>
      <div class="trouble__list">
        <details>
          <summary>command not found: supacanvas</summary>
          <div class="trouble__answer">
            <p>Your global npm bin isn't on <code>PATH</code>. Run <code>npm config get prefix</code> and make sure <code>&lt;prefix&gt;/bin</code> is in your shell's <code>PATH</code>.</p>
            <p>Or skip the global install and run on demand: <code>npx supacanvas serve</code> · <code>bunx supacanvas serve</code>.</p>
          </div>
        </details>
        <details>
          <summary>EACCES permission denied during install</summary>
          <div class="trouble__answer">
            <p>Don't use <code>sudo</code> — it creates files only root can edit. Instead, point npm at a user-owned prefix:</p>
            <p><code>npm config set prefix ~/.npm-global</code></p>
            <p>Then add <code>~/.npm-global/bin</code> to your <code>PATH</code> in <code>~/.zshrc</code> or <code>~/.bashrc</code> and re-run the install.</p>
          </div>
        </details>
        <details>
          <summary>Port 7777 already in use</summary>
          <div class="trouble__answer">
            <p>Kill whatever is on it: <code>lsof -ti :7777 | xargs kill -9</code></p>
            <p>Or pick a different port: <code>supacanvas serve --port 8080</code></p>
          </div>
        </details>
        <details>
          <summary>My AI tool doesn't see supacanvas's MCP tools</summary>
          <div class="trouble__answer">
            <p>Restart the AI client after adding the config — Cursor, Claude Desktop, VS Code, and Claude Code all need a fresh start to pick up new MCP servers.</p>
            <p>Test the binary: <code>supacanvas mcp</code> should hang waiting for stdio JSON-RPC (that's correct — kill it with Ctrl-C).</p>
            <p>Confirm you used <code>-g</code> on the install. Without <code>-g</code>, <code>supacanvas</code> isn't on <code>PATH</code> and the AI client can't spawn it.</p>
          </div>
        </details>
        <details>
          <summary>Gallery says "no canvases yet"</summary>
          <div class="trouble__answer">
            <p>Working as designed — you haven't created any. Ask your AI: <em>"Make a canvas with a working analog clock"</em> or <em>"Build me a Q3 revenue dashboard in supacanvas"</em>. It calls <code>canvas_create</code> and the gallery picks it up on refresh.</p>
            <p>Need ideas? See <a href="/uses" style="color: var(--accent); border-bottom: 1px solid var(--rule);">42 ready-to-copy prompts</a>.</p>
          </div>
        </details>
        <details>
          <summary>Share button: "Server isn't running"</summary>
          <div class="trouble__answer">
            <p>The local viewer needs the supacanvas server running to handle share requests. Open a terminal and run <code>supacanvas serve</code>. Keep it open while you use the gallery.</p>
          </div>
        </details>
        <details>
          <summary>PNG screenshot fails or returns 503</summary>
          <div class="trouble__answer">
            <p>Screenshots use headless Chrome. Install Chrome, Brave, Edge, Arc, or Chromium — supacanvas auto-detects all of them on macOS / Linux / Windows.</p>
            <p>If detection fails, point at it explicitly: <code>SUPACANVAS_CHROME_PATH=/path/to/chrome supacanvas serve</code></p>
          </div>
        </details>
        <details>
          <summary>My canvases disappeared</summary>
          <div class="trouble__answer">
            <p>Files live under <code>~/.supacanvas/canvases/&lt;id&gt;/</code>. If that directory is empty, check <code>~/.canvas/</code> or <code>~/.plate/</code> — supacanvas auto-detects these legacy paths from earlier names.</p>
            <p>To force a specific location: <code>SUPACANVAS_HOME=/some/path supacanvas serve</code></p>
          </div>
        </details>
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
