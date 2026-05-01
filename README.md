# Supacanvas

> A local-first MCP server + browser viewer for AI-generated HTML/CSS/JS canvases. **Yours on disk. Plug into any AI tool. Export anywhere.**

Think Claude Artifacts, but:

- **AI-agnostic** — speaks the [Model Context Protocol](https://modelcontextprotocol.io) over stdio, so any MCP client (Claude Desktop, Claude Code, Cursor, ChatGPT desktop, Continue, etc.) can drive it.
- **Files on disk** — every canvas is a folder under `~/.supacanvas/` containing `index.html`, `style.css`, `script.js`, `meta.json`. Open them in any editor, back them up, copy them around.
- **Themable, no limits** — drop a CSS file into `~/.supacanvas/themes/` and any canvas can opt into it.
- **Versioned** — every AI edit auto-snapshots the previous state. Restore from the viewer drawer or the CLI.
- **Exportable** — single-click Markdown, standalone HTML (theme inlined), PNG screenshot, or PDF (via the browser's print dialog).
- **Searchable by intent** — each canvas carries a plain-language `description` and an agent-oriented `context` field. Future AIs reading the canvas pick up where you left off.
- **Provenance-aware** — each canvas (and each revision snapshot) records `source` so you can see which AI tool/model authored or last edited it.
- **Sandboxed** — AI-generated JS runs inside `<iframe sandbox="allow-scripts">` (no same-origin, no parent access).

---

## Install

**One-liner** (installs Bun if missing, then supacanvas globally):

```sh
curl -fsSL https://raw.githubusercontent.com/bhaulik/supacanvas/main/install.sh | bash
```

**Manual**:

```sh
# 1. Bun (https://bun.sh) — required runtime
curl -fsSL https://bun.sh/install | bash

# 2. Supacanvas
bun install -g github:bhaulik/supacanvas
```

**From source** (for hacking on it):

```sh
git clone https://github.com/bhaulik/supacanvas.git
cd supacanvas && bun install && bun link
```

Storage lives at `~/.supacanvas/` by default. Override with `SUPACANVAS_HOME=/some/other/path`.

> **Carrying data from earlier names?** `~/.plate/` and `~/.canvas/` are auto-detected as fallbacks if `~/.supacanvas/` doesn't exist yet, and a legacy `plates/` subdir is renamed to `canvases/` on first run. `PLATE_HOME` and `CANVAS_HOME` env vars still resolve correctly.

## Quick start

```sh
supacanvas setup     # prints MCP config + detects which AI clients you have
supacanvas serve     # starts the viewer at http://localhost:7777
```

`supacanvas setup --write` will merge the MCP config into every detected JSON-based client config (Claude Desktop, Cursor, Claude Code) so you don't have to copy-paste.

There's also a short alias — `supa` — wherever you'd type `supacanvas`.

## Wire it into an AI client

The MCP server speaks JSON-RPC over stdio. Add it to whatever client you use:

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "supacanvas": {
      "command": "supacanvas",
      "args": ["mcp"]
    }
  }
}
```

If `supacanvas` isn't on PATH (Claude Desktop doesn't always inherit your shell's PATH), use absolute paths:

```json
{
  "mcpServers": {
    "supacanvas": {
      "command": "/Users/you/.bun/bin/bun",
      "args": ["run", "/absolute/path/to/supacanvas/src/cli.ts", "mcp"]
    }
  }
}
```

### Cursor

Save as `~/.cursor/mcp.json` (global) or `<project>/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "supacanvas": {
      "command": "supacanvas",
      "args": ["mcp"]
    }
  }
}
```

In Cursor: `Cmd+Shift+J` → **MCP** → toggle `supacanvas` on.

### Claude Code

```sh
claude mcp add supacanvas supacanvas mcp
```

### Then

Run `supacanvas serve` in a terminal so URLs the AI hands you render. Ask:

- *"Make me a canvas with a working analog clock."*
- *"Update the clock canvas to use the `midnight` theme."*
- *"Take a screenshot of canvas `fair-lily-tm8` and show me."*
- *"List my canvases tagged `prototype`."*
- *"Show me the description of every canvas about the auth flow."*

---

## MCP tools the AI can call

| Tool | Purpose |
|---|---|
| `canvas_create` | Create a new canvas (`title`, `html`, `css?`, `js?`, `tags?`, `theme?`, `description?`, `context?`, `source?`) |
| `canvas_update` | Update any subset of fields. Auto-snapshots before write. |
| `canvas_get` | Read full contents (html, css, js, meta) |
| `canvas_list` | List canvases (filter by tag, full-text search across title/description/context/tags/source) |
| `canvas_delete` | Soft-delete (moves to `trash/`, recoverable) |
| `canvas_versions` | List saved snapshots (each carries the source captured at write time) |
| `canvas_restore` | Restore a previous snapshot |
| `canvas_export` | Serialize as `markdown` or standalone `html` |
| `canvas_screenshot` | Render to PNG and return it as inline image content (so the AI client renders it in chat) |
| `theme_list` | List installed CSS themes |
| `canvas_open_url` | Get the localhost URL for a canvas |

The tool schemas tell the AI to write good `description` (1–2 sentence summary), `context` (longer agent-oriented background), and `source` (e.g. `cursor:claude-opus-4`) on every write — so the next agent reading a canvas understands it without re-deriving anything, and you can trace authorship over time.

## CLI (mirrors the MCP toolset for non-MCP agents)

```
supacanvas serve [--port N] [--no-open]
supacanvas mcp
supacanvas setup [--write]

supacanvas new --title "..." [content flags] [--json]
supacanvas get <id> [--field html|css|js|meta] [--json]
supacanvas update <id> [content flags] [--json]
supacanvas list [--tag T] [--search Q] [--limit N] [--json]
supacanvas rm <id>
supacanvas open <id>

supacanvas versions <id> [--json]
supacanvas restore <id> --version <ts>
supacanvas export <id> --format md|html [--out path]
supacanvas screenshot <id> [--out path] [--w N] [--h N] [--dpr N] [--full]

supacanvas tags [--json]
supacanvas theme list
supacanvas theme add <name> <path>
supacanvas config get [key]
supacanvas config set <key> <value>
supacanvas where
```

Content flags accept inline (`--html "..."`), file (`--html-file path`), or stdin (`--html-stdin`) variants for `html`, `css`, `js`, and `context`. With `--json`, structured commands print full JSON; without it, just the id (so `ID=$(supacanvas new ...)` works in shell pipelines).

Agent-friendly example:

```sh
ID=$(echo "<h1>Hello</h1>" | supacanvas new \
       --title "Demo" \
       --html-stdin \
       --description "A throwaway demo." \
       --tags "demo,test" \
       --source "shell-agent:gpt-5" \
       --json | jq -r .id)

supacanvas screenshot "$ID" --out /tmp/demo.png --dpr 2
supacanvas export "$ID" --format md > demo.md
```

## Browser viewer

Run `supacanvas serve` and open `http://localhost:7777`.

- **Gallery** — every canvas as a numbered specimen plate. Live thumbnail, italic-serif title, plain-language description, tag chips, catalog №, source badge.
- **Viewer** — full-screen iframe with a sidebar drawer for editing description, context, theme, subjects (tag chips with autocomplete from your global tag corpus), revisions (one-click restore, source per version), and source.
- **Fullscreen** — click the `⤢` button in the iframe corner, or press `F`. `Esc` exits.
- **Export** — Markdown / standalone HTML / PNG / PDF (print sheet) directly from the drawer.

## HTTP / JSON API

Anything an MCP client can do, you can do via HTTP. Useful for scripting:

```
GET    /api/canvases                    list
POST   /api/canvases                    create
GET    /api/canvases/:id                get
PATCH  /api/canvases/:id                update (partial)
DELETE /api/canvases/:id                soft-delete
GET    /api/canvases/:id/versions       list snapshots (with source per version)
POST   /api/canvases/:id/restore        { version } → restore
GET    /api/themes                      list themes
GET    /api/tags                        [{name, count}] aggregated across all canvases
GET    /c/:id/export.md                 markdown download
GET    /c/:id/export.html               standalone HTML download (theme inlined)
GET    /c/:id/screenshot.png            PNG via headless Chrome (?w / ?h / ?dpr / ?full)
GET    /c/:id/print                     auto-print page → "Save as PDF" in the browser
```

## Storage layout

```
~/.supacanvas/
  config.json                    # {port, defaultTheme, maxVersions}
  canvases/<id>/
    index.html  style.css  script.js  meta.json
    .versions/<ISO-timestamp>/   # last 20 by default
  themes/*.css
  trash/<id>__<timestamp>/
```

`meta.json` shape:

```json
{
  "id": "fair-lily-tm8",
  "title": "Step 3 Source Docs vs Exports",
  "description": "Visual explanation of why the Step 3 prompt fix helps the web UI but creates a DOCX/PDF export regression.",
  "context": "Source: PR #4940 review thread. Don't change the export path without checking that task.usedDocuments still renders.",
  "tags": ["processing-checklist", "step3", "code-review"],
  "theme": "default",
  "source": "cursor:claude-opus-4",
  "createdAt": "2026-05-01T16:12:51.814Z",
  "updatedAt": "2026-05-01T16:34:39.071Z"
}
```

## Themes

A theme is just a CSS file. Drop one into `~/.supacanvas/themes/yours.css` and set it on any canvas (via the viewer drawer, the CLI, or the `theme` field on `canvas_create` / `canvas_update`).

Themes target generic semantics — `body`, `h1`, `button`, `.card`, etc. — so AI-generated canvases that use plain HTML inherit the theme automatically. The bundled `default.css` is a starting point.

## Screenshots

`canvas_screenshot` (MCP), `supacanvas screenshot` (CLI), and `GET /c/:id/screenshot.png` (HTTP) all render the canvas to PNG via the user's installed Chrome / Chromium / Brave / Edge / Arc. **No bundled browser** — keeps the package small (~5 MB). Override the binary with `SUPACANVAS_CHROME_PATH=/path/to/chrome` if needed.

The MCP variant returns the PNG as inline `image/png` content, so vision-capable AI clients (Cursor, Claude Desktop, etc.) display it directly in chat.

## Roadmap

- **v0.5** — in-browser CodeMirror editor at `/c/:id/edit`, theme manager UI, trash recovery UI
- **v0.6** — asset uploads (`<id>/assets/`), cross-canvas linking
- **v0.7** — `supacanvas publish <id>` → static site folder ready for Netlify/GH Pages
- **future** — hosted Supacanvas Cloud (sync, sharing, team workspaces)

## License

MIT — see [LICENSE](./LICENSE).
