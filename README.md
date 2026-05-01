# Universal Canvas

> A local-first MCP server + browser viewer for AI-generated HTML/CSS/JS canvases. **Yours on disk. Plug into any AI tool. Export anywhere.**

Think Claude Artifacts, but:

- **AI-agnostic** — speaks the [Model Context Protocol](https://modelcontextprotocol.io) over stdio, so any MCP client (Claude Desktop, Claude Code, Cursor, ChatGPT desktop, Continue, etc.) can drive it.
- **Files on disk** — every canvas is a folder under `~/.canvas/` containing `index.html`, `style.css`, `script.js`, `meta.json`. Open them in any editor, back them up, copy them around.
- **Themable, no limits** — drop a CSS file into `~/.canvas/themes/` and any canvas can opt into it.
- **Versioned** — every AI edit auto-snapshots the previous state. Restore from the viewer drawer or the CLI.
- **Exportable** — single-click Markdown, standalone HTML (theme inlined), or PDF (via the browser's print dialog).
- **Searchable by intent** — each canvas carries a plain-language `description` and an agent-oriented `context` field. Future AIs reading the canvas pick up where you left off.
- **Sandboxed** — AI-generated JS runs inside `<iframe sandbox="allow-scripts">` (no same-origin, no parent access).

---

## Install

Requires [Bun](https://bun.sh) ≥ 1.1.

```sh
git clone https://github.com/yabemando/universal-canvas.git
cd universal-canvas
bun install
bun link              # makes the `canvas` command available globally
```

Storage lives at `~/.canvas/` by default. Override with `CANVAS_HOME=/some/other/path`.

## Run the viewer

```sh
canvas serve          # opens http://localhost:7777 in your browser
```

The viewer is the gallery of canvases your AI has created. It's separate from the MCP server — you can run them independently or together.

## Wire it into an AI client

The MCP server speaks JSON-RPC over stdio. Add it to whatever client you use:

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent on Windows/Linux:

```json
{
  "mcpServers": {
    "canvas": {
      "command": "canvas",
      "args": ["mcp"]
    }
  }
}
```

If `canvas` isn't on PATH (Claude Desktop doesn't always inherit your shell's PATH), use absolute paths:

```json
{
  "mcpServers": {
    "canvas": {
      "command": "/Users/you/.bun/bin/bun",
      "args": ["run", "/absolute/path/to/universal-canvas/src/cli.ts", "mcp"]
    }
  }
}
```

### Cursor

Save as `~/.cursor/mcp.json` (global) or `<project>/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "canvas": {
      "command": "canvas",
      "args": ["mcp"]
    }
  }
}
```

In Cursor: `Cmd+Shift+J` → **MCP** → toggle `canvas` on.

### Claude Code

```sh
claude mcp add canvas canvas mcp
```

Or add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "canvas": { "command": "canvas", "args": ["mcp"] }
  }
}
```

### Then

Run `canvas serve` in a terminal so the URLs the AI hands you actually render. Ask the AI things like:

- *"Make me a canvas with a working analog clock."*
- *"Update the clock canvas to use the `midnight` theme."*
- *"List my canvases tagged `prototype`."*
- *"Show me the description of every canvas about the auth flow."*

---

## MCP tools the AI can call

| Tool | Purpose |
|---|---|
| `canvas_create` | Create a new canvas (`title`, `html`, `css?`, `js?`, `tags?`, `theme?`, `description?`, `context?`) |
| `canvas_update` | Update any subset of fields. Auto-snapshots before write. |
| `canvas_get` | Read full contents (html, css, js, meta) of a canvas |
| `canvas_list` | List canvases (filter by tag, full-text search across title/description/context/tags) |
| `canvas_delete` | Soft-delete (moves to `trash/`, recoverable) |
| `canvas_versions` | List saved snapshots |
| `canvas_restore` | Restore a previous snapshot |
| `canvas_export` | Serialize as `markdown` or standalone `html` |
| `theme_list` | List installed CSS themes |
| `canvas_open_url` | Get the localhost URL for a canvas |

The tool schemas tell the AI to write good `description` (1–2 sentence summary) and `context` (longer agent-oriented background) fields so the next agent reading a canvas understands it without re-deriving anything.

## CLI

```
canvas serve [--port N] [--no-open]
canvas mcp
canvas list [--tag T] [--search Q]
canvas open <id>
canvas new --title "..."
canvas rm <id>
canvas where
canvas theme list
canvas theme add <name> <path>
canvas config get [key]
canvas config set <key> <value>
```

## Browser viewer

Run `canvas serve` and open `http://localhost:7777`.

- **Gallery** — every canvas as a numbered specimen plate. Live thumbnail, italic-serif title, plain-language description, tag chips, catalog №. Search across all metadata.
- **Viewer** — full-screen iframe with a sidebar drawer for editing description, context, theme, subjects (tag chips with autocomplete from your global tag corpus), and revisions (one-click restore).
- **Fullscreen** — click the `⤢` button in the iframe corner, or press `F`. `Esc` exits.
- **Export** — Markdown / standalone HTML / PDF (print sheet) directly from the drawer.

## HTTP / JSON API

Anything an MCP client can do, you can do via HTTP. Useful for scripting:

```
GET    /api/canvases                  list
POST   /api/canvases                  create
GET    /api/canvases/:id              get
PATCH  /api/canvases/:id              update (partial)
DELETE /api/canvases/:id              soft-delete
GET    /api/canvases/:id/versions     list snapshots
POST   /api/canvases/:id/restore      { version } → restore
GET    /api/themes                    list themes
GET    /api/tags                      [{name, count}] aggregated across all canvases
GET    /c/:id/export.md               markdown download
GET    /c/:id/export.html             standalone HTML download (theme inlined)
GET    /c/:id/print                   auto-print page → "Save as PDF" in the browser
```

## Storage layout

```
~/.canvas/
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
  "context": "Source: PR #4940 review thread. Numbers below come from convertProcessingChecklistToASingleHtml. Don't change the export path without checking that task.usedDocuments still renders.",
  "tags": ["processing-checklist", "step3", "code-review"],
  "theme": "default",
  "createdAt": "2026-05-01T16:12:51.814Z",
  "updatedAt": "2026-05-01T16:34:39.071Z"
}
```

## Themes

A theme is just a CSS file. Drop one into `~/.canvas/themes/yours.css` and set it on any canvas (via the viewer drawer, the CLI, or the `theme` field on `canvas_create` / `canvas_update`).

Themes target generic semantics — `body`, `h1`, `button`, `.card`, etc. — so AI-generated canvases that use plain HTML inherit the theme automatically. The bundled `default.css` is a starting point.

## Roadmap

- **v0.2** — in-browser CodeMirror editor at `/c/:id/edit`, theme manager UI, trash recovery UI
- **v0.3** — asset uploads (`<id>/assets/`), cross-canvas linking
- **v0.4** — `canvas publish <id>` → static site folder ready for Netlify/GH Pages
- **future** — hosted multi-user version

## License

MIT — see [LICENSE](./LICENSE).
