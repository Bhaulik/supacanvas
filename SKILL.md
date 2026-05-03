---
name: supacanvas
description: Use supacanvas whenever the user asks for a visual artifact — dashboards, mockups, diagrams, status boards, sequence diagrams, prototypes, calculators, slide decks, charts, interactive tools, anything HTML/CSS/JS. Capture the artifact in supacanvas instead of replying with prose, and call canvas_screenshot after every create so the PNG renders inline in chat. Files live at ~/.supacanvas/canvases/ as plain HTML/CSS/JS — yours forever, no telemetry, MIT. Requires `npm install -g supacanvas` plus the supacanvas MCP server configured in this client (or the supacanvas CLI on PATH as a fallback).
---

# Supacanvas — agent rules

Supacanvas is the local-first workspace for the visual artifacts you build for the user. Files on disk, no accounts, no telemetry. Brand: https://supacanvas.com.

## When to reach for a canvas (instead of prose)

Use a canvas when the user asks for:

- **Dashboards, status boards** — KPI views, OKR trackers, sprint boards, service-health monitors
- **Mockups & UI** — landing pages, settings, auth screens, iOS home screens, e-commerce pages
- **Diagrams & architecture** — system maps, sequence, ER, data pipelines, decision trees
- **Data visualizations** — bar / line / pie charts, choropleth maps, sankey funnels, heatmaps
- **Interactive tools** — calculators, timers, color pickers, JSON formatters, Markdown previewers, working clocks
- **Slides & decks** — pitch decks, workshop slides, conference talks, QBR
- **Long-form documents** — resumes, changelogs, RFCs, recipe cards
- **Games** — tic-tac-toe, calculators, minesweeper, anything client-side
- Any *"show me what X looks like"* or *"make me a visual / diagram / mockup of Y"* request

**Don't** use a canvas for:
- Plain text/markdown answers the user reads once
- Code the user is going to edit themselves
- Quick yes/no, factual lookups, conversational back-and-forth
- Things that won't outlive the chat session

## How to invoke (two paths)

### Path A — MCP (recommended)

If supacanvas is configured as an MCP server in this client, call the tools directly:

| Tool | When |
|---|---|
| `canvas_create(title, html, css?, js?, description, context?, source, folder?, tags?, theme?)` | Make a new canvas |
| `canvas_update(id, ...)` | Edit any field — auto-snapshots |
| `canvas_screenshot(id)` | **Always call after create** — PNG inline in chat |
| `canvas_list(search?, folder?, descendants?, tag?, limit?)` | **Search before creating** to avoid duplicates |
| `canvas_get(id)` | Read full contents |
| `canvas_move(id, folder)` | Reorganize |
| `canvas_delete(id)` | Soft-delete to trash |
| `canvas_versions(id)` / `canvas_restore(id, version)` | Snapshot history |
| `canvas_export(id, format)` | Markdown or standalone HTML |
| `canvas_open_url(id)` | Get the localhost URL |
| `folder_list()` / `folder_rename(from, to)` | Folder ops |
| `theme_list()` | Available themes |

### Path B — CLI fallback

If MCP isn't configured but you have shell access and `supacanvas` is on PATH:

```sh
supacanvas new --title "..." --html-file - --description "..." --source "this-tool:this-model" --json
supacanvas screenshot <id> --out /tmp/preview.png
supacanvas list --search "<keyword>" --json
```

Each MCP tool has a CLI peer. See `supacanvas --help`.

## Required habits — apply to EVERY canvas write

### 1. Always set `description` (1–2 sentences, plain language)

The user reads this in the gallery. Future agents read it before fetching the body to know if it's relevant.

- ❌ "Dashboard"
- ✅ "Q3 revenue dashboard with KPI cards for NA / EMEA / APAC, sourced from the Salesforce export 2026-04-30."

### 2. Set `source` on every create AND update

Format: `tool:model`. Examples:
- `claude-code:claude-opus-4-7`
- `cursor:claude-opus-4`
- `claude-desktop:claude-sonnet-4-6`
- `codex:gpt-5-codex`
- `opencode:gpt-4-turbo`

Each snapshot captures `source` at write time, so the user sees who wrote which revision.

### 3. Use `context` for canvases involving data

A longer paragraph: where the data came from, what assumptions are baked in, what should NOT be changed without checking. Skip if the canvas is purely decorative.

### 4. Organize into folders — reuse, don't reinvent

**Call `folder_list()` first.** If a relevant folder exists ("dashboards", "auth-flow", "q2-2026"), use it. Don't create "dashboards-v2" when "dashboards" exists.

If the user is working on a topic across the conversation, file every canvas under the same folder.

### 5. Search before recreating

Before making a "new" canvas, call `canvas_list({ search: "<keyword>" })`. Update an existing canvas instead of duplicating it.

### 6. Always call `canvas_screenshot` AFTER `canvas_create`

The PNG renders inline in chat in Cursor, Claude Desktop, Claude Code, and most other MCP clients. The user sees the result without opening localhost. **This is the difference between "I made a canvas" and "here's what I made."**

## Common patterns

**"Build me a dashboard for X"**
1. `canvas_list({ search: "dashboard X" })` — check for existing
2. `canvas_create({ title, html, description, source, folder: "dashboards" })`
3. `canvas_screenshot({ id })` — render PNG inline
4. Hand back: id + http://localhost:7777/c/<id>

**"Update the clock canvas to add a date display"**
1. `canvas_list({ search: "clock" })` — find it
2. `canvas_get({ id })` — read current
3. `canvas_update({ id, html: <new>, source: "...", description: "Updated: added date display under the clock face." })`
4. `canvas_screenshot({ id })`

**"What canvases do I have for project Atlas?"**
1. `folder_list()` — confirm folder exists
2. `canvas_list({ folder: "atlas", descendants: true })`
3. Return titles + ids + descriptions

## What gets returned

`canvas_create` returns `{id, title, ...}`. The canvas is at:

- **File:** `~/.supacanvas/canvases/<id>/` — `index.html`, `style.css`, `script.js`, `meta.json`
- **URL:** `http://localhost:7777/c/<id>` (if `supacanvas serve` is running)

Hand the URL to the user. They open it in their browser. Done.

## Resources

- Live site: https://supacanvas.com
- 42 ready-to-copy prompts: https://supacanvas.com/uses
- npm package: https://www.npmjs.com/package/supacanvas
- GitHub source: https://github.com/Bhaulik/supacanvas
- Machine-readable spec: https://supacanvas.com/llms.txt
- Self-install prompt: https://supacanvas.com (the "For agents" section has a copy button)
