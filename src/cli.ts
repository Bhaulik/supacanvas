#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import {
  plateHome,
  ensureLayout,
  listPlates,
  loadConfig,
  saveConfig,
  deletePlate,
  listThemes,
  addTheme,
  createPlate,
} from "./storage.ts";
import { startServer } from "./http.ts";
import { startMcpServer } from "./mcp.ts";

const HELP = `plate — local-first MCP for AI-generated views

Usage:
  plate serve [--port N]           start local viewer (default port from config)
  plate mcp                        run MCP server over stdio (for AI clients)
  plate list [--tag T] [--search Q]
  plate open <id>                  open a plate in the default browser
  plate new --title "..." [--html ...] [--theme ...]
  plate rm <id>                    soft-delete (move to trash/)
  plate where                      print storage directory
  plate theme list
  plate theme add <name> <path>    install a CSS file as a theme
  plate config get <key>
  plate config set <key> <value>   keys: port | defaultTheme | maxVersions

Examples:
  plate serve
  PLATE_HOME=~/work/plates plate serve --port 8080
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

async function openInBrowser(url: string): Promise<void> {
  // macOS — primary target. Fall back to xdg-open for linux dev users.
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  try {
    Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" });
  } catch { /* ignore — print URL instead */ }
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
      // Keep the process alive — Bun.serve doesn't block on its own.
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
      });
      if (items.length === 0) {
        console.log("(no plates yet)");
        break;
      }
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

    case "new": {
      const title = typeof flags.title === "string" ? flags.title : "Untitled";
      const html = typeof flags.html === "string" ? flags.html : "<main><h1>Hello</h1></main>";
      const theme = typeof flags.theme === "string" ? flags.theme : undefined;
      const meta = await createPlate({ title, html, theme });
      console.log(meta.id);
      break;
    }

    case "rm": {
      const id = positional[0];
      if (!id) { console.error("usage: plate rm <id>"); process.exit(2); }
      await deletePlate(id);
      console.log(`moved to trash: ${id}`);
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
        console.log((cfg as any)[key]);
      } else if (sub === "set") {
        const key = positional[1]; const val = positional[2];
        if (!key || val === undefined) { console.error("usage: plate config set <key> <value>"); process.exit(2); }
        const next: any = { ...cfg };
        if (key === "port" || key === "maxVersions") next[key] = Number(val);
        else next[key] = val;
        await saveConfig(next);
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
