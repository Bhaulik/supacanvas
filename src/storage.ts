import { mkdir, readdir, readFile, writeFile, rm, stat, rename, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AppConfig,
  type Canvas,
  type CanvasMeta,
  type CanvasSummary,
  type SnapshotInfo,
  DEFAULT_CONFIG,
} from "./types.ts";
import { generateId, isValidId } from "./ids.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLED_THEMES_DIR = join(HERE, "themes");

export function canvasHome(): string {
  return process.env.CANVAS_HOME
    ? resolve(process.env.CANVAS_HOME)
    : join(homedir(), ".canvas");
}

const FILES = {
  html: "index.html",
  css: "style.css",
  js: "script.js",
  meta: "meta.json",
} as const;

function canvasesDir() { return join(canvasHome(), "canvases"); }
function themesDir() { return join(canvasHome(), "themes"); }
function trashDir() { return join(canvasHome(), "trash"); }
function configPath() { return join(canvasHome(), "config.json"); }
function canvasDir(id: string) { return join(canvasesDir(), id); }
function versionsDir(id: string) { return join(canvasDir(id), ".versions"); }

export async function ensureLayout(): Promise<void> {
  const home = canvasHome();
  await mkdir(home, { recursive: true });
  await mkdir(canvasesDir(), { recursive: true });
  await mkdir(themesDir(), { recursive: true });
  await mkdir(trashDir(), { recursive: true });

  if (!existsSync(configPath())) {
    await writeFile(configPath(), JSON.stringify(DEFAULT_CONFIG, null, 2));
  }

  // Seed bundled themes on first run (don't overwrite if user has customized).
  if (existsSync(BUNDLED_THEMES_DIR)) {
    for (const file of await readdir(BUNDLED_THEMES_DIR)) {
      if (!file.endsWith(".css")) continue;
      const target = join(themesDir(), file);
      if (!existsSync(target)) {
        await copyFile(join(BUNDLED_THEMES_DIR, file), target);
      }
    }
  }
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(configPath(), "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  await writeFile(configPath(), JSON.stringify(cfg, null, 2));
}

async function readMeta(id: string): Promise<CanvasMeta | null> {
  try {
    const raw = await readFile(join(canvasDir(id), FILES.meta), "utf8");
    const parsed = JSON.parse(raw) as Partial<CanvasMeta>;
    // Normalize: older canvases on disk predate description/context.
    return {
      id: parsed.id ?? id,
      title: parsed.title ?? "Untitled",
      description: parsed.description ?? "",
      context: parsed.context ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      theme: parsed.theme ?? "default",
      source: parsed.source ?? "",
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      updatedAt: parsed.updatedAt ?? parsed.createdAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function writeCanvasFiles(id: string, c: Canvas): Promise<void> {
  const dir = canvasDir(id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, FILES.html), c.html);
  await writeFile(join(dir, FILES.css), c.css);
  await writeFile(join(dir, FILES.js), c.js);
  await writeFile(join(dir, FILES.meta), JSON.stringify(c.meta, null, 2));
}

export interface CreateInput {
  title: string;
  html: string;
  css?: string;
  js?: string;
  tags?: string[];
  theme?: string;
  description?: string;
  context?: string;
  source?: string;
}

export async function createCanvas(input: CreateInput): Promise<CanvasMeta> {
  await ensureLayout();
  const cfg = await loadConfig();
  const now = new Date().toISOString();
  // Try a few times in the unlikely case of an id collision.
  let id = generateId();
  for (let i = 0; i < 5 && existsSync(canvasDir(id)); i++) id = generateId();
  const meta: CanvasMeta = {
    id,
    title: input.title.trim() || "Untitled",
    description: (input.description ?? "").trim(),
    context: (input.context ?? "").trim(),
    tags: input.tags ?? [],
    theme: input.theme ?? cfg.defaultTheme,
    source: (input.source ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
  await writeCanvasFiles(id, {
    meta,
    html: input.html,
    css: input.css ?? "",
    js: input.js ?? "",
  });
  return meta;
}

export interface UpdateInput {
  title?: string;
  html?: string;
  css?: string;
  js?: string;
  tags?: string[];
  theme?: string;
  description?: string;
  context?: string;
  source?: string;
}

export async function updateCanvas(id: string, input: UpdateInput): Promise<{ meta: CanvasMeta; version: string }> {
  if (!isValidId(id)) throw new Error(`invalid canvas id: ${id}`);
  const existing = await getCanvas(id);
  if (!existing) throw new Error(`canvas not found: ${id}`);
  const version = await snapshot(id);
  const meta: CanvasMeta = {
    ...existing.meta,
    title: input.title ?? existing.meta.title,
    description: input.description ?? existing.meta.description,
    context: input.context ?? existing.meta.context,
    tags: input.tags ?? existing.meta.tags,
    theme: input.theme ?? existing.meta.theme,
    source: input.source ?? existing.meta.source,
    updatedAt: new Date().toISOString(),
  };
  const next: Canvas = {
    meta,
    html: input.html ?? existing.html,
    css: input.css ?? existing.css,
    js: input.js ?? existing.js,
  };
  await writeCanvasFiles(id, next);
  await pruneVersions(id);
  return { meta, version };
}

export async function getCanvas(id: string): Promise<Canvas | null> {
  if (!isValidId(id)) return null;
  const dir = canvasDir(id);
  if (!existsSync(dir)) return null;
  const meta = await readMeta(id);
  if (!meta) return null;
  const [html, css, js] = await Promise.all([
    readFile(join(dir, FILES.html), "utf8").catch(() => ""),
    readFile(join(dir, FILES.css), "utf8").catch(() => ""),
    readFile(join(dir, FILES.js), "utf8").catch(() => ""),
  ]);
  return { meta, html, css, js };
}

export async function listCanvases(opts: { tag?: string; search?: string; limit?: number } = {}): Promise<CanvasSummary[]> {
  await ensureLayout();
  let entries: string[];
  try { entries = await readdir(canvasesDir()); } catch { return []; }
  const out: CanvasSummary[] = [];
  for (const id of entries) {
    if (id.startsWith(".")) continue;
    const meta = await readMeta(id);
    if (!meta) continue;
    if (opts.tag && !meta.tags.includes(opts.tag)) continue;
    if (opts.search) {
      const q = opts.search.toLowerCase();
      const haystack = [
        meta.title,
        meta.description,
        meta.context,
        meta.tags.join(" "),
        meta.source,
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    out.push({
      id: meta.id,
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      theme: meta.theme,
      source: meta.source,
      updatedAt: meta.updatedAt,
    });
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export async function deleteCanvas(id: string): Promise<void> {
  if (!isValidId(id)) throw new Error(`invalid canvas id: ${id}`);
  const src = canvasDir(id);
  if (!existsSync(src)) throw new Error(`canvas not found: ${id}`);
  await mkdir(trashDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = join(trashDir(), `${id}__${stamp}`);
  await rename(src, dest);
}

async function snapshot(id: string): Promise<string> {
  const dir = canvasDir(id);
  if (!existsSync(dir)) throw new Error(`canvas not found: ${id}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(versionsDir(id), stamp);
  await mkdir(target, { recursive: true });
  for (const f of Object.values(FILES)) {
    const src = join(dir, f);
    if (existsSync(src)) await copyFile(src, join(target, f));
  }
  return stamp;
}

async function pruneVersions(id: string): Promise<void> {
  const cfg = await loadConfig();
  const dir = versionsDir(id);
  if (!existsSync(dir)) return;
  const entries = (await readdir(dir)).sort(); // ISO timestamps sort lexicographically
  const excess = entries.length - cfg.maxVersions;
  if (excess <= 0) return;
  for (let i = 0; i < excess; i++) {
    await rm(join(dir, entries[i]!), { recursive: true, force: true });
  }
}

export async function listVersions(id: string): Promise<SnapshotInfo[]> {
  const dir = versionsDir(id);
  if (!existsSync(dir)) return [];
  const entries = (await readdir(dir)).filter(e => !e.startsWith(".")).sort().reverse();
  const out: SnapshotInfo[] = [];
  for (const version of entries) {
    let source = "";
    try {
      const raw = await readFile(join(dir, version, FILES.meta), "utf8");
      const m = JSON.parse(raw) as Partial<CanvasMeta>;
      source = m.source ?? "";
    } catch { /* snapshot missing meta — leave source blank */ }
    out.push({ version, timestamp: version, source });
  }
  return out;
}

export async function restoreVersion(id: string, version: string): Promise<{ restoredFrom: string }> {
  const vDir = join(versionsDir(id), version);
  if (!existsSync(vDir)) throw new Error(`version not found: ${version}`);
  // Snapshot current state first so the restore is itself reversible.
  await snapshot(id);
  const dir = canvasDir(id);
  for (const f of Object.values(FILES)) {
    const src = join(vDir, f);
    if (existsSync(src)) await copyFile(src, join(dir, f));
  }
  // Bump updatedAt so the canvas re-sorts to the top.
  const meta = await readMeta(id);
  if (meta) {
    meta.updatedAt = new Date().toISOString();
    await writeFile(join(dir, FILES.meta), JSON.stringify(meta, null, 2));
  }
  return { restoredFrom: version };
}

export async function listAllTags(): Promise<{ name: string; count: number }[]> {
  await ensureLayout();
  const counts = new Map<string, number>();
  let entries: string[];
  try { entries = await readdir(canvasesDir()); } catch { return []; }
  for (const id of entries) {
    if (id.startsWith(".")) continue;
    const meta = await readMeta(id);
    if (!meta) continue;
    for (const t of meta.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function listThemes(): Promise<string[]> {
  await ensureLayout();
  try {
    const entries = await readdir(themesDir());
    return entries.filter(e => e.endsWith(".css")).map(e => e.replace(/\.css$/, "")).sort();
  } catch {
    return [];
  }
}

export async function getThemeCSS(name: string): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return "";
  const path = join(themesDir(), `${name}.css`);
  try { return await readFile(path, "utf8"); } catch { return ""; }
}

export async function addTheme(name: string, css: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error(`invalid theme name: ${name}`);
  await ensureLayout();
  await writeFile(join(themesDir(), `${name}.css`), css);
}
