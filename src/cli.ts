#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import {
  supacanvasHome,
  ensureLayout,
  listCanvases,
  loadConfig,
  saveConfig,
  deleteCanvas,
  listThemes,
  listAllTags,
  listFolders,
  renameFolder,
  addTheme,
  createCanvas,
  updateCanvas,
  getCanvas,
  listVersions,
  restoreVersion,
} from "./storage.ts";
import { startServer } from "./http.ts";
import { startMcpServer } from "./mcp.ts";
import { toMarkdown, toStandaloneHtml } from "./export.ts";
import { screenshotCanvas } from "./screenshot.ts";
import { shareCanvas, revokeShare, listShares } from "./share.ts";

const HELP = `supacanvas — local-first MCP for AI-generated views

Usage:
  Server / agent surface
    supacanvas serve [--port N] [--no-open]
    supacanvas mcp                          run MCP server over stdio (for AI clients)
    supacanvas setup [--write]              show / write MCP config for installed AI clients

  CRUD
    supacanvas new --title "..." [content flags] [--json]
    supacanvas get <id> [--field html|css|js|meta] [--json]
    supacanvas update <id> [content flags] [--json]
    supacanvas list [--tag T] [--search Q] [--limit N] [--json]
    supacanvas rm <id>                      soft-delete (move to trash/)
    supacanvas open <id>                    open in browser

  Versions / export / screenshot
    supacanvas versions <id> [--json]
    supacanvas restore <id> --version <ts> [--json]
    supacanvas export <id> --format md|html [--out path]
    supacanvas screenshot <id> [--out path] [--w N] [--h N] [--dpr N] [--full]

  Public sharing (uploads to supacanvas.com — files stay local too)
    supacanvas share <id> [--json]              upload as public URL, save owner token
    supacanvas share --revoke <slug>            take down a previously shared canvas
    supacanvas share --list [--json]            list shares created from this machine

  Tags / themes / config
    supacanvas tags [--json]                tag corpus across all canvases
    supacanvas theme list
    supacanvas theme add <name> <path>
    supacanvas config get [key]
    supacanvas config set <key> <value>     keys: port | defaultTheme | maxVersions
    supacanvas where                        print storage directory

Content flags (for new + update):
  --html "..."        --html-file <path>     --html-stdin
  --css "..."         --css-file <path>      --css-stdin
  --js "..."          --js-file <path>       --js-stdin
  --description "..." --context "..."        --context-file <path>     --context-stdin
  --tags a,b,c        --theme name           --source "tool:model"

Examples (agent-friendly):
  ID=$(supacanvas new --title "Dashboard" --html-file out.html --description "Q2 numbers" \\
                  --source "shell-agent:gpt-5" --json | jq -r .id)
  supacanvas update "$ID" --css-stdin <<< 'body { font: 14px system-ui; }'
  supacanvas screenshot "$ID" --out /tmp/dashboard.png --dpr 2
  supacanvas export "$ID" --format md > dashboard.md
  supacanvas get "$ID" --field html > current.html
`;

function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Resolve a content field that can come from --foo "...", --foo-file <path>, or --foo-stdin.
 * Returns undefined if none of the three forms is present (so callers know to leave the field unchanged).
 */
async function readContent(flags: Record<string, string | true>, key: string): Promise<string | undefined> {
  if (typeof flags[key] === "string") return flags[key] as string;
  const fileFlag = flags[`${key}-file`];
  if (typeof fileFlag === "string") return await readFile(fileFlag, "utf8");
  if (flags[`${key}-stdin`] === true) return await readStdin();
  return undefined;
}

async function openInBrowser(url: string): Promise<void> {
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  try {
    const child = spawn(cmd, [url], { stdio: "ignore", detached: true });
    child.unref();
  } catch { /* ignore — print URL instead */ }
}

function emit(value: unknown, flags: Record<string, string | true>): void {
  if (flags.json === true || flags.json === "true") {
    console.log(JSON.stringify(value, null, 2));
  } else if (typeof value === "string") {
    console.log(value);
  } else if (value && typeof value === "object" && "id" in value) {
    // Default human-friendly form: just the id, so it's pipe-friendly.
    console.log((value as { id: string }).id);
  } else {
    console.log(JSON.stringify(value, null, 2));
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    console.log(HELP);
    return;
  }

  const { positional, flags } = parseFlags(argv.slice(1));

  switch (cmd) {
    case "serve": {
      const cfg = await loadConfig();
      const port = typeof flags.port === "string" ? Number(flags.port) : cfg.port;
      const { url } = await startServer(port);
      console.log(`supacanvas viewer running at ${url}`);
      console.log(`storage: ${supacanvasHome()}`);
      if (!flags["no-open"]) await openInBrowser(url);
      await new Promise(() => {});
      break;
    }

    case "mcp": {
      // Stdio MCP server. Don't write to stdout — that channel belongs to the protocol.
      await startMcpServer();
      break;
    }

    case "list": {
      const items = await listCanvases({
        tag: typeof flags.tag === "string" ? flags.tag : undefined,
        search: typeof flags.search === "string" ? flags.search : undefined,
        limit: typeof flags.limit === "string" ? Number(flags.limit) : undefined,
        folder: typeof flags.folder === "string" ? flags.folder : undefined,
        descendants: flags.descendants === true,
      });
      if (flags.json) { console.log(JSON.stringify(items, null, 2)); break; }
      if (items.length === 0) { console.log("(no canvases yet)"); break; }
      for (const c of items) {
        const tags = c.tags.length ? `  [${c.tags.join(", ")}]` : "";
        const folder = c.folder ? `  /${c.folder}` : "";
        console.log(`${c.id}\t${c.title}${folder}${tags}`);
      }
      break;
    }

    case "open": {
      const id = positional[0];
      if (!id) { console.error("usage: supacanvas open <id>"); process.exit(2); }
      const cfg = await loadConfig();
      const url = `http://localhost:${cfg.port}/c/${id}`;
      console.log(url);
      await openInBrowser(url);
      break;
    }

    case "get": {
      const id = positional[0];
      if (!id) { console.error("usage: supacanvas get <id> [--field html|css|js|meta] [--json]"); process.exit(2); }
      const canvas = await getCanvas(id);
      if (!canvas) { console.error(`canvas not found: ${id}`); process.exit(1); }
      const field = typeof flags.field === "string" ? flags.field : null;
      if (field === "html" || field === "css" || field === "js") {
        process.stdout.write(canvas[field]);
        if (process.stdout.isTTY) process.stdout.write("\n");
        break;
      }
      if (field === "meta") { console.log(JSON.stringify(canvas.meta, null, 2)); break; }
      if (flags.json) { console.log(JSON.stringify(canvas, null, 2)); break; }
      // Human-friendly default
      console.log(`# ${canvas.meta.title}    [${canvas.meta.id}]`);
      if (canvas.meta.description) console.log(canvas.meta.description);
      if (canvas.meta.tags.length) console.log(`tags: ${canvas.meta.tags.join(", ")}`);
      if (canvas.meta.source) console.log(`source: ${canvas.meta.source}`);
      console.log(`updated: ${canvas.meta.updatedAt}`);
      console.log(`html: ${canvas.html.length} bytes  css: ${canvas.css.length}  js: ${canvas.js.length}`);
      console.log("(use --field html|css|js|meta to read content; --json for full record)");
      break;
    }

    case "new": {
      const title = typeof flags.title === "string" ? flags.title : "Untitled";
      const html = (await readContent(flags, "html")) ?? "<main><h1>Hello</h1></main>";
      const css = await readContent(flags, "css");
      const js = await readContent(flags, "js");
      const description = typeof flags.description === "string" ? flags.description : undefined;
      const context = await readContent(flags, "context");
      const source = typeof flags.source === "string" ? flags.source : undefined;
      const theme = typeof flags.theme === "string" ? flags.theme : undefined;
      const tags = typeof flags.tags === "string"
        ? flags.tags.split(",").map(t => t.trim()).filter(Boolean)
        : undefined;
      const folder = typeof flags.folder === "string" ? flags.folder : undefined;
      const meta = await createCanvas({ title, html, css, js, description, context, source, theme, tags, folder });
      emit(meta, flags);
      break;
    }

    case "update": {
      const id = positional[0];
      if (!id) { console.error("usage: supacanvas update <id> [flags]"); process.exit(2); }
      const title = typeof flags.title === "string" ? flags.title : undefined;
      const html = await readContent(flags, "html");
      const css = await readContent(flags, "css");
      const js = await readContent(flags, "js");
      const description = typeof flags.description === "string" ? flags.description : undefined;
      const context = await readContent(flags, "context");
      const source = typeof flags.source === "string" ? flags.source : undefined;
      const theme = typeof flags.theme === "string" ? flags.theme : undefined;
      const tags = typeof flags.tags === "string"
        ? flags.tags.split(",").map(t => t.trim()).filter(Boolean)
        : undefined;
      const folder = typeof flags.folder === "string" ? flags.folder : undefined;
      const result = await updateCanvas(id, { title, html, css, js, description, context, source, theme, tags, folder });
      if (flags.json) { console.log(JSON.stringify(result, null, 2)); break; }
      console.log(`updated ${id} (snapshot ${result.version})`);
      break;
    }

    case "mv": {
      const id = positional[0];
      const folder = positional[1];
      if (!id || folder === undefined) { console.error("usage: supacanvas mv <id> <folder>  (use '' for root)"); process.exit(2); }
      const result = await updateCanvas(id, { folder });
      if (flags.json) { console.log(JSON.stringify(result, null, 2)); break; }
      console.log(`moved ${id} → "${result.meta.folder || "(root)"}"`);
      break;
    }

    case "folders": {
      const sub = positional[0];
      if (sub === "rename") {
        const from = positional[1];
        const to = positional[2];
        if (from === undefined || to === undefined) {
          console.error("usage: supacanvas folders rename <from> <to>"); process.exit(2);
        }
        const result = await renameFolder(from, to);
        if (flags.json) { console.log(JSON.stringify(result, null, 2)); break; }
        console.log(`renamed: ${result.moved.length} canvas(es) moved`);
        for (const id of result.moved) console.log(`  ${id}`);
        break;
      }
      const folders = await listFolders();
      if (flags.json) { console.log(JSON.stringify(folders, null, 2)); break; }
      if (folders.length === 0) { console.log("(no folders)"); break; }
      for (const f of folders) {
        const name = f.name || "(unfiled)";
        console.log(`${String(f.count).padStart(4)} ${name}`);
      }
      break;
    }

    case "rm": {
      const id = positional[0];
      if (!id) { console.error("usage: supacanvas rm <id>"); process.exit(2); }
      await deleteCanvas(id);
      console.log(`moved to trash: ${id}`);
      break;
    }

    case "versions": {
      const id = positional[0];
      if (!id) { console.error("usage: supacanvas versions <id> [--json]"); process.exit(2); }
      const versions = await listVersions(id);
      if (flags.json) { console.log(JSON.stringify(versions, null, 2)); break; }
      if (versions.length === 0) { console.log("(no revisions on file)"); break; }
      for (const v of versions) {
        const src = v.source ? `\t${v.source}` : "";
        console.log(`${v.version}${src}`);
      }
      break;
    }

    case "restore": {
      const id = positional[0];
      const version = typeof flags.version === "string" ? flags.version : null;
      if (!id || !version) { console.error("usage: supacanvas restore <id> --version <timestamp>"); process.exit(2); }
      const result = await restoreVersion(id, version);
      if (flags.json) { console.log(JSON.stringify(result, null, 2)); break; }
      console.log(`restored ${id} from ${result.restoredFrom}`);
      break;
    }

    case "export": {
      const id = positional[0];
      const format = typeof flags.format === "string" ? flags.format : null;
      if (!id || (format !== "md" && format !== "markdown" && format !== "html")) {
        console.error("usage: supacanvas export <id> --format md|html [--out path]");
        process.exit(2);
      }
      const canvas = await getCanvas(id);
      if (!canvas) { console.error(`canvas not found: ${id}`); process.exit(1); }
      const content = (format === "html") ? await toStandaloneHtml(canvas) : toMarkdown(canvas);
      if (typeof flags.out === "string") {
        await writeFile(flags.out, content);
        console.error(`wrote ${flags.out}`);
      } else {
        process.stdout.write(content);
        if (process.stdout.isTTY && !content.endsWith("\n")) process.stdout.write("\n");
      }
      break;
    }

    case "screenshot": {
      const id = positional[0];
      if (!id) { console.error("usage: supacanvas screenshot <id> [--out path] [--w N] [--h N] [--dpr N] [--full]"); process.exit(2); }
      const canvas = await getCanvas(id);
      if (!canvas) { console.error(`canvas not found: ${id}`); process.exit(1); }
      const png = await screenshotCanvas(canvas, {
        width: typeof flags.w === "string" ? Number(flags.w) : undefined,
        height: typeof flags.h === "string" ? Number(flags.h) : undefined,
        deviceScaleFactor: typeof flags.dpr === "string" ? Number(flags.dpr) : undefined,
        fullPage: flags.full === true,
      });
      if (typeof flags.out === "string") {
        await writeFile(flags.out, png);
        console.error(`wrote ${flags.out} (${png.length} bytes)`);
      } else {
        process.stdout.write(png);
      }
      break;
    }

    case "tags": {
      const tags = await listAllTags();
      if (flags.json) { console.log(JSON.stringify(tags, null, 2)); break; }
      if (tags.length === 0) { console.log("(no tags yet)"); break; }
      for (const t of tags) console.log(`${String(t.count).padStart(4)} ${t.name}`);
      break;
    }

    case "where": {
      console.log(supacanvasHome());
      break;
    }

    case "install": {
      const cfg = await loadConfig();
      const url = `http://localhost:${cfg.port}/install`;
      let alive = false;
      try { const r = await fetch(url, { signal: AbortSignal.timeout(500) }); alive = r.ok; } catch { /* none */ }
      if (!alive) { const { url: started } = await startServer(cfg.port); console.log(`started supacanvas viewer at ${started}`); }
      console.log(`opening ${url}`);
      await openInBrowser(url);
      await new Promise(r => setTimeout(r, 1500));
      break;
    }

    case "setup": {
      const home = homedir();
      const binName = "supacanvas";

      const snippet = {
        mcpServers: {
          supacanvas: { command: binName, args: ["mcp"] },
        },
      };

      // Each client uses the same MCP server config shape, but a different file.
      // YAML clients (Continue) need a hand-written snippet.
      interface ClientEntry { name: string; path: string; format: "json" | "yaml"; alt?: string }
      const clients: ClientEntry[] = [
        {
          name: "Claude Desktop",
          path: join(home, "Library/Application Support/Claude/claude_desktop_config.json"),
          format: "json",
        },
        {
          name: "Cursor",
          path: join(home, ".cursor/mcp.json"),
          format: "json",
        },
        {
          name: "Claude Code",
          path: join(home, ".claude/settings.json"),
          format: "json",
          alt: "claude mcp add supacanvas supacanvas mcp",
        },
        {
          name: "Continue",
          path: join(home, ".continue/config.yaml"),
          format: "yaml",
        },
      ];

      const installedDetected = clients.some(c => existsSync(c.path));
      const writeMode = flags.write === true;

      // Detect stale 'canvas' entries from versions before 0.7.4 that wrote
      // mcpServers.canvas with command 'canvas'. We only flag/remove an entry
      // if its signature exactly matches what the old buggy version wrote —
      // anyone with an unrelated MCP server they happened to name 'canvas'
      // is left alone.
      interface StaleEntry { client: string; path: string }
      const stale: StaleEntry[] = [];
      for (const c of clients) {
        if (c.format !== "json" || !existsSync(c.path)) continue;
        try {
          const raw = await readFile(c.path, "utf8");
          const cfg = JSON.parse(raw) as { mcpServers?: Record<string, { command?: string; args?: unknown[] }> };
          const old = cfg.mcpServers?.canvas;
          const looksLikeOurs =
            old !== undefined &&
            old.command === "canvas" &&
            Array.isArray(old.args) &&
            old.args[0] === "mcp";
          if (looksLikeOurs) stale.push({ client: c.name, path: c.path });
        } catch { /* ignore unreadable / unparseable */ }
      }

      console.log("");
      console.log("Supacanvas setup");
      console.log("────────────────");
      console.log("");
      console.log("Add this to your AI client's MCP config:");
      console.log("");
      console.log(JSON.stringify(snippet, null, 2).split("\n").map(l => "    " + l).join("\n"));
      console.log("");
      console.log("Detected AI clients on this machine:");
      for (const c of clients) {
        const present = existsSync(c.path);
        const marker = present ? " ✓" : "  ";
        console.log(`  ${marker} ${c.name.padEnd(16)} ${c.path}${present ? "" : "  (no config yet)"}`);
        if (c.alt) console.log(`     ${"".padEnd(16)} or: ${c.alt}`);
      }
      console.log("");

      if (!installedDetected) {
        console.log("(no MCP-aware clients detected — install Cursor / Claude Desktop / Claude Code first)");
        console.log("");
      }

      if (stale.length > 0) {
        console.log("⚠  Stale 'canvas' entry detected from a pre-0.7.4 install:");
        for (const s of stale) {
          console.log(`     ${s.client.padEnd(16)} ${s.path}`);
        }
        console.log("");
        console.log("   That entry was created when supacanvas was briefly named 'canvas'");
        console.log("   and points at a 'canvas' command that no longer exists.");
        if (writeMode) {
          console.log("   --write detected: removing it (and adding the correct 'supacanvas' entry).");
        } else {
          console.log("   Re-run with --write to remove it cleanly:");
          console.log("       supacanvas setup --write");
        }
        console.log("");
      }

      if (writeMode) {
        console.log("Writing config (--write)…");
        for (const c of clients) {
          if (c.format !== "json") continue;
          // Only touch JSON configs we know how to merge safely.
          await mkdir(dirname(c.path), { recursive: true });
          let existing: { mcpServers?: Record<string, { command?: string; args?: unknown[] }> } = {};
          if (existsSync(c.path)) {
            try { existing = JSON.parse(await readFile(c.path, "utf8")); } catch { /* keep empty */ }
          }
          const mergedServers = { ...(existing.mcpServers ?? {}) };
          // Drop a stale 'canvas' entry IF it has the buggy signature.
          const oldCanvas = mergedServers.canvas;
          const oldCanvasIsOurs =
            oldCanvas !== undefined &&
            oldCanvas.command === "canvas" &&
            Array.isArray(oldCanvas.args) &&
            oldCanvas.args[0] === "mcp";
          if (oldCanvasIsOurs) delete mergedServers.canvas;
          // Add (or refresh) the correct 'supacanvas' entry.
          mergedServers.supacanvas = snippet.mcpServers.supacanvas;
          const merged = { ...existing, mcpServers: mergedServers };
          await writeFile(c.path, JSON.stringify(merged, null, 2) + "\n");
          const action = oldCanvasIsOurs ? "wrote (replaced stale 'canvas')" : "wrote";
          console.log(`  ✓ ${action} ${c.path}`);
        }
        console.log("");
        console.log("Restart any clients you wrote to so they re-read the config.");
        console.log("");
      } else {
        console.log("Add the snippet manually, or re-run with --write to merge it into");
        console.log("every detected JSON-based config (Continue's YAML config you'll have");
        console.log("to edit by hand).");
        console.log("");
      }

      console.log("Then in another terminal:");
      console.log("  supacanvas serve");
      console.log("");
      console.log("Ask your AI: \"create a canvas with a working analog clock\"");
      console.log("");
      break;
    }

    case "theme": {
      const sub = positional[0];
      if (sub === "list") {
        for (const t of await listThemes()) console.log(t);
      } else if (sub === "add") {
        const name = positional[1]; const path = positional[2];
        if (!name || !path) { console.error("usage: supacanvas theme add <name> <path>"); process.exit(2); }
        const css = await readFile(path, "utf8");
        await addTheme(name, css);
        console.log(`installed theme: ${name}`);
      } else {
        console.error("usage: supacanvas theme list | canvas theme add <name> <path>");
        process.exit(2);
      }
      break;
    }

    case "config": {
      const sub = positional[0];
      const cfg = await loadConfig();
      if (sub === "get") {
        const key = positional[1];
        if (!key) { console.log(JSON.stringify(cfg, null, 2)); break; }
        console.log((cfg as unknown as Record<string, unknown>)[key]);
      } else if (sub === "set") {
        const key = positional[1]; const val = positional[2];
        if (!key || val === undefined) { console.error("usage: supacanvas config set <key> <value>"); process.exit(2); }
        const next = { ...cfg } as unknown as Record<string, unknown>;
        if (key === "port" || key === "maxVersions") next[key] = Number(val);
        else next[key] = val;
        await saveConfig(next as unknown as typeof cfg);
        console.log(JSON.stringify(next, null, 2));
      } else {
        console.error("usage: supacanvas config get [key] | canvas config set <key> <value>");
        process.exit(2);
      }
      break;
    }

    case "share": {
      // Three modes:
      //   supacanvas share <id>            create
      //   supacanvas share --revoke <slug> revoke
      //   supacanvas share --list          list owned shares
      if (flags.list === true) {
        const shares = await listShares();
        if (flags.json) { console.log(JSON.stringify(shares, null, 2)); break; }
        if (shares.length === 0) {
          console.log("(no shares yet — `supacanvas share <id>` to create one)");
          break;
        }
        for (const s of shares) {
          const status = s.exists ? "live" : "revoked";
          const views = s.viewCount === undefined ? "?" : String(s.viewCount);
          console.log(`${s.slug}\t${s.title}\t${status}\tviews~${views}\t${s.canonicalUrl}`);
        }
        break;
      }

      if (typeof flags.revoke === "string") {
        const slug = flags.revoke;
        try {
          await revokeShare(slug);
          if (flags.json) { console.log(JSON.stringify({ slug, revoked: true })); break; }
          console.log(`✓ revoked: ${slug}`);
        } catch (e) {
          console.error(`revoke failed: ${(e as Error).message}`);
          process.exit(1);
        }
        break;
      }

      const id = positional[0];
      if (!id) {
        console.error("usage:");
        console.error("  supacanvas share <id>             create a public URL");
        console.error("  supacanvas share --revoke <slug>  take it down");
        console.error("  supacanvas share --list           list shares from this machine");
        process.exit(2);
      }
      try {
        const result = await shareCanvas(id);
        if (flags.json) { console.log(JSON.stringify(result, null, 2)); break; }
        console.log(`✓ Shared! Slug: ${result.slug}`);
        console.log("");
        console.log(`  Public URL:  ${result.canonicalUrl}`);
        console.log("");
        console.log(`  ⚠ This URL is public — anyone with it can view the canvas.`);
        console.log(`  Owner token saved to ~/.supacanvas/share-tokens.json`);
        console.log(`  Revoke:      supacanvas share --revoke ${result.slug}`);
      } catch (e) {
        console.error(`share failed: ${(e as Error).message}`);
        process.exit(1);
      }
      break;
    }

    default: {
      console.error(`unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(2);
    }
  }
}

await ensureLayout();
await main();
