#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import {
  plateHome,
  ensureLayout,
  listPlates,
  loadConfig,
  saveConfig,
  deletePlate,
  listThemes,
  listAllTags,
  addTheme,
  createPlate,
  updatePlate,
  getPlate,
  listVersions,
  restoreVersion,
} from "./storage.ts";
import { startServer } from "./http.ts";
import { startMcpServer } from "./mcp.ts";
import { toMarkdown, toStandaloneHtml } from "./export.ts";
import { screenshotPlate } from "./screenshot.ts";

const HELP = `plate — local-first MCP for AI-generated views

Usage:
  Server / agent surface
    plate serve [--port N] [--no-open]
    plate mcp                          run MCP server over stdio (for AI clients)

  CRUD
    plate new --title "..." [content flags] [--json]
    plate get <id> [--field html|css|js|meta] [--json]
    plate update <id> [content flags] [--json]
    plate list [--tag T] [--search Q] [--limit N] [--json]
    plate rm <id>                      soft-delete (move to trash/)
    plate open <id>                    open in browser

  Versions / export / screenshot
    plate versions <id> [--json]
    plate restore <id> --version <ts> [--json]
    plate export <id> --format md|html [--out path]
    plate screenshot <id> [--out path] [--w N] [--h N] [--dpr N] [--full]

  Tags / themes / config
    plate tags [--json]                tag corpus across all plates
    plate theme list
    plate theme add <name> <path>
    plate config get [key]
    plate config set <key> <value>     keys: port | defaultTheme | maxVersions
    plate where                        print storage directory

Content flags (for new + update):
  --html "..."        --html-file <path>     --html-stdin
  --css "..."         --css-file <path>      --css-stdin
  --js "..."          --js-file <path>       --js-stdin
  --description "..." --context "..."        --context-file <path>     --context-stdin
  --tags a,b,c        --theme name           --source "tool:model"

Examples (agent-friendly):
  ID=$(plate new --title "Dashboard" --html-file out.html --description "Q2 numbers" \\
                  --source "shell-agent:gpt-5" --json | jq -r .id)
  plate update "$ID" --css-stdin <<< 'body { font: 14px system-ui; }'
  plate screenshot "$ID" --out /tmp/dashboard.png --dpr 2
  plate export "$ID" --format md > dashboard.md
  plate get "$ID" --field html > current.html
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
    Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" });
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
      console.log(`plate viewer running at ${url}`);
      console.log(`storage: ${plateHome()}`);
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
      const items = await listPlates({
        tag: typeof flags.tag === "string" ? flags.tag : undefined,
        search: typeof flags.search === "string" ? flags.search : undefined,
        limit: typeof flags.limit === "string" ? Number(flags.limit) : undefined,
      });
      if (flags.json) { console.log(JSON.stringify(items, null, 2)); break; }
      if (items.length === 0) { console.log("(no plates yet)"); break; }
      for (const c of items) {
        const tags = c.tags.length ? `  [${c.tags.join(", ")}]` : "";
        console.log(`${c.id}\t${c.title}${tags}`);
      }
      break;
    }

    case "open": {
      const id = positional[0];
      if (!id) { console.error("usage: plate open <id>"); process.exit(2); }
      const cfg = await loadConfig();
      const url = `http://localhost:${cfg.port}/p/${id}`;
      console.log(url);
      await openInBrowser(url);
      break;
    }

    case "get": {
      const id = positional[0];
      if (!id) { console.error("usage: plate get <id> [--field html|css|js|meta] [--json]"); process.exit(2); }
      const plate = await getPlate(id);
      if (!plate) { console.error(`plate not found: ${id}`); process.exit(1); }
      const field = typeof flags.field === "string" ? flags.field : null;
      if (field === "html" || field === "css" || field === "js") {
        process.stdout.write(plate[field]);
        if (process.stdout.isTTY) process.stdout.write("\n");
        break;
      }
      if (field === "meta") { console.log(JSON.stringify(plate.meta, null, 2)); break; }
      if (flags.json) { console.log(JSON.stringify(plate, null, 2)); break; }
      // Human-friendly default
      console.log(`# ${plate.meta.title}    [${plate.meta.id}]`);
      if (plate.meta.description) console.log(plate.meta.description);
      if (plate.meta.tags.length) console.log(`tags: ${plate.meta.tags.join(", ")}`);
      if (plate.meta.source) console.log(`source: ${plate.meta.source}`);
      console.log(`updated: ${plate.meta.updatedAt}`);
      console.log(`html: ${plate.html.length} bytes  css: ${plate.css.length}  js: ${plate.js.length}`);
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
      const meta = await createPlate({ title, html, css, js, description, context, source, theme, tags });
      emit(meta, flags);
      break;
    }

    case "update": {
      const id = positional[0];
      if (!id) { console.error("usage: plate update <id> [flags]"); process.exit(2); }
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
      const result = await updatePlate(id, { title, html, css, js, description, context, source, theme, tags });
      if (flags.json) { console.log(JSON.stringify(result, null, 2)); break; }
      console.log(`updated ${id} (snapshot ${result.version})`);
      break;
    }

    case "rm": {
      const id = positional[0];
      if (!id) { console.error("usage: plate rm <id>"); process.exit(2); }
      await deletePlate(id);
      console.log(`moved to trash: ${id}`);
      break;
    }

    case "versions": {
      const id = positional[0];
      if (!id) { console.error("usage: plate versions <id> [--json]"); process.exit(2); }
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
      if (!id || !version) { console.error("usage: plate restore <id> --version <timestamp>"); process.exit(2); }
      const result = await restoreVersion(id, version);
      if (flags.json) { console.log(JSON.stringify(result, null, 2)); break; }
      console.log(`restored ${id} from ${result.restoredFrom}`);
      break;
    }

    case "export": {
      const id = positional[0];
      const format = typeof flags.format === "string" ? flags.format : null;
      if (!id || (format !== "md" && format !== "markdown" && format !== "html")) {
        console.error("usage: plate export <id> --format md|html [--out path]");
        process.exit(2);
      }
      const plate = await getPlate(id);
      if (!plate) { console.error(`plate not found: ${id}`); process.exit(1); }
      const content = (format === "html") ? await toStandaloneHtml(plate) : toMarkdown(plate);
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
      if (!id) { console.error("usage: plate screenshot <id> [--out path] [--w N] [--h N] [--dpr N] [--full]"); process.exit(2); }
      const plate = await getPlate(id);
      if (!plate) { console.error(`plate not found: ${id}`); process.exit(1); }
      const png = await screenshotPlate(plate, {
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
      console.log(plateHome());
      break;
    }

    case "theme": {
      const sub = positional[0];
      if (sub === "list") {
        for (const t of await listThemes()) console.log(t);
      } else if (sub === "add") {
        const name = positional[1]; const path = positional[2];
        if (!name || !path) { console.error("usage: plate theme add <name> <path>"); process.exit(2); }
        const css = await readFile(path, "utf8");
        await addTheme(name, css);
        console.log(`installed theme: ${name}`);
      } else {
        console.error("usage: plate theme list | plate theme add <name> <path>");
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
        if (!key || val === undefined) { console.error("usage: plate config set <key> <value>"); process.exit(2); }
        const next = { ...cfg } as unknown as Record<string, unknown>;
        if (key === "port" || key === "maxVersions") next[key] = Number(val);
        else next[key] = val;
        await saveConfig(next as unknown as typeof cfg);
        console.log(JSON.stringify(next, null, 2));
      } else {
        console.error("usage: plate config get [key] | plate config set <key> <value>");
        process.exit(2);
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
