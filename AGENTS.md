# Supacanvas — instructions for AI agents

> Drop this file (or its contents) into your AI tool's rules / system-prompt slot to make the agent fluent at using Supacanvas. Tool-specific paths are at the bottom.

---

## What Supacanvas is

A local MCP server that gives you a workspace for visual artifacts. You can create HTML/CSS/JS canvases, snapshot them, organize them into folders, and screenshot them back to chat for the user to see — all via tool calls, no browser context-switching for the human.

Each canvas is a folder of plain files on the user's disk under `~/.supacanvas/canvases/<id>/`. Files persist across sessions. Other agents can read/write the same canvases.

## Habits — what to actually do

**1. Reach for canvases when the answer is visual.**
Charts, dashboards, status boards, mockups, slide-style decks, comparison tables, "show me what this looks like" — those become canvases. Plain prose answers stay in chat.

**2. After creating a canvas, screenshot it.**
Call `canvas_screenshot({ id })` immediately after `canvas_create`. The MCP response includes inline PNG content; most clients (Cursor, Claude Desktop, etc.) render images directly in chat, so the user sees the result without opening localhost.

**3. Always write `description`.**
One or two sentences, plain language. The user reads this in the gallery; future agents (you, three weeks from now) read it before fetching the body. Bad: `"Dashboard"`. Good: `"Q2 revenue dashboard with bars for NA / EMEA / APAC, sourced from Salesforce export 2026-04-30."`

**4. Set `source` on every write.**
Format: `tool:model`. Examples: `cursor:claude-opus-4`, `claude-desktop:claude-sonnet-4-6`, `claude-code:claude-opus-4-7`. Each snapshot captures the source at write-time, so the user can see who wrote which revision.

**5. Use `context` when data is involved.**
Multi-paragraph background: where the data came from, what assumptions are baked in, what shouldn't be changed without checking. Skip if the canvas is purely decorative.

**6. Organize into folders.**
Call `folder_list` first to see existing folders. Reuse rather than invent. If the user is working on a topic (`"auth flow"`, `"q2 metrics"`, `"client-acme"`), file every canvas you make in that conversation under the same folder. The user can move things later if they want.

**7. Search before recreating.**
Before making a "new" canvas, call `canvas_list({ search: "<keyword>" })` — the user might already have one you can update instead of duplicating. Search hits title, description, context, tags, source, and folder.

## Tool reference

```
canvas_create       title, html, css?, js?, description, context?, source, folder?, tags?, theme?
canvas_update       id, + any of the above
canvas_move         id, folder
canvas_get          id
canvas_list         search?, folder?, descendants?, tag?, limit?
canvas_delete       id        (soft-delete to trash/)
canvas_versions     id        (returns snapshots with source per revision)
canvas_restore      id, version
canvas_export       id, format: "markdown" | "html"
canvas_screenshot   id, width?, height?, fullPage?, deviceScaleFactor?
canvas_open_url     id        (returns localhost URL the user can open)
folder_list
folder_rename       from, to  (also moves descendants)
theme_list
```

## When NOT to use Supacanvas

- Plain text or markdown answers the user just reads once
- Code the user is going to edit themselves
- Quick yes/no, factual lookups, or back-and-forth conversation
- Things that won't outlive the chat session

If you're unsure, ask the user. "Want me to drop this into a canvas you can come back to later?" is a good prompt.

---

## Tool-specific setup

### Claude Code

Save these instructions to `~/.claude/CLAUDE.md` (user-level) or `<project>/CLAUDE.md` (project-level). Claude Code reads both and injects them into every conversation in that scope.

```sh
mkdir -p ~/.claude
curl -fsSL https://raw.githubusercontent.com/bhaulik/supacanvas/main/AGENTS.md > ~/.claude/CLAUDE.md
```

Or to scope to one repo:

```sh
curl -fsSL https://raw.githubusercontent.com/bhaulik/supacanvas/main/AGENTS.md > CLAUDE.md
```

Restart Claude Code (or start a fresh session) to pick up the rules.

### Cursor

Cursor uses `.cursor/rules/*.mdc` files in your project, or a global rules file in settings.

```sh
mkdir -p .cursor/rules
curl -fsSL https://raw.githubusercontent.com/bhaulik/supacanvas/main/AGENTS.md > .cursor/rules/supacanvas.mdc
```

Or paste the contents into **Cursor → Settings → Rules → User Rules** for global effect across all projects.

### Claude Desktop

Claude Desktop doesn't have a rules file system, but it does respect Project Instructions. Create a project, paste the contents above into the project's instructions field, and use that project for any conversation where you want Supacanvas-fluent behavior.

### Continue

Drop the contents into `.continue/system.md` at your repo root, or paste into the system prompt field in Continue's settings.

### Aider / others

Most agent tools support a system-prompt or rules slot. Paste the contents there. The instructions are tool-agnostic — they describe Supacanvas, not Claude or any specific model.

---

## One-line "did this work?" smoke test

Once installed and rules are in place, ask the agent:

> *"Make a canvas with a working analog clock and show it to me."*

A correctly-set-up agent will:
1. Call `canvas_create` with `title`, body HTML for the clock, `description: "An analog clock that updates every second."`, `source: "<your-tool>:<model>"`, and a folder if relevant
2. Immediately call `canvas_screenshot({ id })` so the PNG renders in chat
3. Hand you the localhost URL

If any of those steps are missing, the agent didn't pick up the rules — re-check the path.
