# Plate

> A local-first MCP server + browser viewer for AI-generated HTML/CSS/JS plates. **Yours on disk. Plug into any AI tool. Export anywhere.**

Think Claude Artifacts, but:

- **AI-agnostic** — speaks the [Model Context Protocol](https://modelcontextprotocol.io) over stdio, so any MCP client (Claude Desktop, Claude Code, Cursor, ChatGPT desktop, Continue, etc.) can drive it.
- **Files on disk** — every plate is a folder under `~/.plate/` containing `index.html`, `style.css`, `script.js`, `meta.json`. Open them in any editor, back them up, copy them around.
- **Themable, no limits** — drop a CSS file into `~/.plate/themes/` and any plate can opt into it.
- **Versioned** — every AI edit auto-snapshots the previous state. Restore from the viewer drawer or the CLI.
- **Exportable** — single-click Markdown, standalone HTML (theme inlined), or PDF (via the browser's print dialog).
- **Searchable by intent** — each plate carries a plain-language `description` and an agent-oriented `context` field. Future AIs reading the plate pick up where you left off.
- **Provenance-aware** — each plate (and each revision snapshot) records `source` so you can see which AI tool/model authored or last edited it.
- **Sandboxed** — AI-generated JS runs inside `<iframe sandbox="allow-scripts">` (no same-origin, no parent access).

---

## Install

Requires [Bun](https://bun.sh) ≥ 1.1.

```sh
git clone https://github.com/bhaulik/plate.git
cd plate
bun install
bun link              # makes the `plate` command available globally
```

Storage lives at `~/.plate/` by default. Override with `PLATE_HOME=/some/other/path`.

> Migrating from the pre-rename `canvas` version? Existing data at `~/.canvas/canvases/` is auto-detected and the inner directory is renamed to `~/.canvas/plates/` on first run. Setting `CANVAS_HOME` is also still honored as a fallback.

## Run the viewer

```sh
plate serve          # opens http://localhost:7777 in your browser
```

The viewer is the gallery of plates your AI has created. It's separate from the MCP server — you can run them independently or together.

## Wire it into an AI client

The MCP server speaks JSON-RPC over stdio. Add it to whatever client you use:

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent on Windows/Linux:

```json
{
  "mcpServers": {
    "plate": {
      "command": "plate",
      "args": ["mcp"]
    }
  }
}
```

If `plate` isn't on PATH (Claude Desktop doesn't always inherit your shell's PATH), use absolute paths:

```json
{
  "mcpServers": {
    "plate": {
      "command": "/Users/you/.bun/bin/bun",
      "args": ["run", "/absolute/path/to/plate/src/cli.ts", "mcp"]
    }
  }
}
```

### Cursor

Save as `~/.cursor/mcp.json` (global) or `<project>/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "plate": {
      "command": "plate",
      "args": ["mcp"]
    }
  }
}
```

In Cursor: `Cmd+Shift+J` → **MCP** → toggle `plate` on.

### Claude Code

```sh
claude mcp add plate plate mcp
```

Or add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "plate": { "command": "plate", "args": ["mcp"] }
  }
}
```

### Then

Run `plate serve` in a terminal so the URLs the AI hands you actually render. Ask the AI things like:

- *"Make me a plate with a working analog clock."*
- *"Update the clock plate to use the `midnight` theme."*
- *"List my plates tagged `prototype`."*
- *"Show me the description of every plate about the auth flow."*

---

## MCP tools the AI can call

| Tool | Purpose |
|---|---|
| `plate_create` | Create a new plate (`title`, `html`, `css?`, `js?`, `tags?`, `theme?`, `description?`, `context?`, `source?`) |
| `plate_update` | Update any subset of fields. Auto-snapshots before write. |
| `plate_get` | Read full contents (html, css, js, meta) |
| `plate_list` | List plates (filter by tag, full-text search across title/description/context/tags/source) |
| `plate_delete` | Soft-delete (moves to `trash/`, recoverable) |
| `plate_versions` | List saved snapshots (each carries the source captured at write time) |
| `plate_restore` | Restore a previous snapshot |
| `plate_export` | Serialize as `markdown` or standalone `html` |
| `theme_list` | List installed CSS themes |
| `plate_open_url` | Get the localhost URL for a plate |

The tool schemas tell the AI to write good `description` (1–2 sentence summary), `context` (longer agent-oriented background), and `source` (e.g. `cursor:claude-opus-4`) on every write — so the next agent reading a plate understands it without re-deriving anything, and you can trace authorship over time.

## CLI

```
plate serve [--port N] [--no-open]
plate mcp
plate list [--tag T] [--search Q]
plate open <id>
plate new --title "..."
plate rm <id>
plate where
plate theme list
plate theme add <name> <path>
plate config get [key]
plate config set <key> <value>
```

## Browser viewer

Run `plate serve` and open `http://localhost:7777`.

- **Gallery** — every plate as a numbered specimen plate. Live thumbnail, italic-serif title, plain-language description, tag chips, catalog №, source badge.
- **Viewer** — full-screen iframe with a sidebar drawer for editing description, context, theme, subjects (tag chips with autocomplete from your global tag corpus), revisions (one-click restore, source per version), and source.
- **Fullscreen** — click the `⤢` button in the iframe corner, or press `F`. `Esc` exits.
- **Export** — Markdown / standalone HTML / PDF (print sheet) directly from the drawer.

## HTTP / JSON API

Anything an MCP client can do, you can do via HTTP. Useful for scripting:

```
GET    /api/plates                    list
POST   /api/plates                    create
GET    /api/plates/:id                get
PATCH  /api/plates/:id                update (partial)
DELETE /api/plates/:id                soft-delete
GET    /api/plates/:id/versions       list snapshots (with source per version)
POST   /api/plates/:id/restore        { version } → restore
GET    /api/themes                    list themes
GET    /api/tags                      [{name, count}] aggregated across all plates
GET    /p/:id/export.md               markdown download
GET    /p/:id/export.html             standalone HTML download (theme inlined)
GET    /p/:id/print                   auto-print page → "Save as PDF" in the browser
```

## Storage layout

```
~/.plate/
  config.json                    # {port, defaultTheme, maxVersions}
  plates/<id>/
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
  "source": "cursor:claude-opus-4",
  "createdAt": "2026-05-01T16:12:51.814Z",
  "updatedAt": "2026-05-01T16:34:39.071Z"
}
```

## Themes

A theme is just a CSS file. Drop one into `~/.plate/themes/yours.css` and set it on any plate (via the viewer drawer, the CLI, or the `theme` field on `plate_create` / `plate_update`).

Themes target generic semantics — `body`, `h1`, `button`, `.card`, etc. — so AI-generated plates that use plain HTML inherit the theme automatically. The bundled `default.css` is a starting point.

## Roadmap

- **v0.3** — in-browser CodeMirror editor at `/p/:id/edit`, theme manager UI, trash recovery UI
- **v0.4** — asset uploads (`<id>/assets/`), cross-plate linking
- **v0.5** — `plate publish <id>` → static site folder ready for Netlify/GH Pages
- **future** — hosted multi-user version

## License

MIT — see [LICENSE](./LICENSE).
