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

export function supacanvasHome(): string {
  if (process.env.SUPACANVAS_HOME) return resolve(process.env.SUPACANVAS_HOME);
  if (process.env.PLATE_HOME)      return resolve(process.env.PLATE_HOME);
  if (process.env.CANVAS_HOME)     return resolve(process.env.CANVAS_HOME);
  // Prefer ~/.supacanvas. Fall back to legacy locations only if they exist
  // and the new one doesn't, so users carrying data from earlier names keep working.
  const newHome      = join(homedir(), ".supacanvas");
  const legacyPlate  = join(homedir(), ".plate");
  const legacyCanvas = join(homedir(), ".canvas");
  if (!existsSync(newHome) && existsSync(legacyPlate))  return legacyPlate;
  if (!existsSync(newHome) && existsSync(legacyCanvas)) return legacyCanvas;
  return newHome;
}

const FILES = {
  html: "index.html",
  css: "style.css",
  js: "script.js",
  meta: "meta.json",
} as const;

function canvasesDir() { return join(supacanvasHome(), "canvases"); }
function themesDir() { return join(supacanvasHome(), "themes"); }
function trashDir() { return join(supacanvasHome(), "trash"); }
function configPath() { return join(supacanvasHome(), "config.json"); }
function canvasDir(id: string) { return join(canvasesDir(), id); }
function versionsDir(id: string) { return join(canvasDir(id), ".versions"); }

export async function ensureLayout(): Promise<void> {
  const home = supacanvasHome();
  await mkdir(home, { recursive: true });

  // One-time rename of the inner subdir.
  // Earlier versions stored items under ~/<home>/canvases/ (canvas era) or
  // ~/<home>/plates/ (plate era). We're back to "canvases/" as the canonical
  // name — if a legacy "plates/" subdir is the only one present, rename it
  // in place. Same volume, cheap, idempotent.
  const platesInner   = join(home, "plates");
  const canvasesInner = join(home, "canvases");
  if (existsSync(platesInner) && !existsSync(canvasesInner)) {
    await rename(platesInner, canvasesInner);
    console.error(`[supacanvas] migrated ${platesInner} → ${canvasesInner}`);
  }

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

/**
 * Strip wrappers that AI agents sometimes leak into html/css/js fields.
 * Most common offender: <![CDATA[ ... ]]> blocks (XML, not HTML — the CSS parser
 * chokes on the opening token and silently drops styling). Also strips
 * markdown code-fence pairs like ```html ... ``` if an agent wrapped its
 * payload that way before passing it to the MCP tool.
 */
export function sanitizeContent(input: string): string {
  if (!input) return input;
  let s = input;
  // CDATA wrapper — leading
  s = s.replace(/^\s*<!\[CDATA\[\s*\n?/i, "");
  // CDATA wrapper — trailing
  s = s.replace(/\s*\]\]>\s*$/i, "");
  // Markdown fence wrapping the whole payload (```lang\n ... \n```)
  s = s.replace(/^\s*```[a-z0-9_-]*\s*\n?/i, "");
  s = s.replace(/\s*```\s*$/i, "");
  return s;
}

/**
 * Sanitize a folder path. Lowercase, slash-separated, no leading/trailing
 * slashes, no '..', no empty segments. Returns "" for root / unfiled.
 * Throws on invalid characters or excessive depth.
 */
export function normalizeFolder(input: string | null | undefined): string {
  if (!input || !input.trim()) return "";
  let path = input.trim().toLowerCase();
  path = path.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
  if (!path) return "";
  const segments = path.split("/");
  if (segments.length > 6) throw new Error("folder path too deeply nested (max 6 levels)");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new Error(`invalid folder segment: "${seg}"`);
    }
    if (seg.length > 40) throw new Error(`folder segment too long: "${seg}" (max 40)`);
    if (!/^[a-z0-9_-]+$/.test(seg)) {
      throw new Error(`invalid folder segment: "${seg}" (allowed: a-z 0-9 - _)`);
    }
  }
  return segments.join("/");
}

async function readMeta(id: string): Promise<CanvasMeta | null> {
  try {
    const raw = await readFile(join(canvasDir(id), FILES.meta), "utf8");
    const parsed = JSON.parse(raw) as Partial<CanvasMeta>;
    // Normalize: older canvases on disk predate description/context/folder.
    return {
      id: parsed.id ?? id,
      title: parsed.title ?? "Untitled",
      description: parsed.description ?? "",
      context: parsed.context ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      theme: parsed.theme ?? "default",
      source: parsed.source ?? "",
      folder: parsed.folder ?? "",
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
  folder?: string;
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
    folder: normalizeFolder(input.folder),
    createdAt: now,
    updatedAt: now,
  };
  await writeCanvasFiles(id, {
    meta,
    html: sanitizeContent(input.html),
    css: sanitizeContent(input.css ?? ""),
    js: sanitizeContent(input.js ?? ""),
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
  folder?: string;
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
    folder: input.folder !== undefined ? normalizeFolder(input.folder) : existing.meta.folder,
    updatedAt: new Date().toISOString(),
  };
  const next: Canvas = {
    meta,
    html: input.html !== undefined ? sanitizeContent(input.html) : existing.html,
    css: input.css !== undefined ? sanitizeContent(input.css) : existing.css,
    js: input.js !== undefined ? sanitizeContent(input.js) : existing.js,
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

export interface ListOptions {
  tag?: string;
  search?: string;
  limit?: number;
  /** Match canvases with exactly this folder. Combine with descendants:true to also include subfolders. */
  folder?: string;
  /** When folder is set, also include canvases in any descendant folder. */
  descendants?: boolean;
}

export async function listCanvases(opts: ListOptions = {}): Promise<CanvasSummary[]> {
  await ensureLayout();
  let entries: string[];
  try { entries = await readdir(canvasesDir()); } catch { return []; }
  const folderFilter = opts.folder !== undefined ? normalizeFolder(opts.folder) : undefined;
  const out: CanvasSummary[] = [];
  for (const id of entries) {
    if (id.startsWith(".")) continue;
    const meta = await readMeta(id);
    if (!meta) continue;
    if (opts.tag && !meta.tags.includes(opts.tag)) continue;
    if (folderFilter !== undefined) {
      if (opts.descendants) {
        if (folderFilter !== "" && meta.folder !== folderFilter && !meta.folder.startsWith(folderFilter + "/")) continue;
      } else {
        if (meta.folder !== folderFilter) continue;
      }
    }
    if (opts.search) {
      const q = opts.search.toLowerCase();
      const haystack = [
        meta.title,
        meta.description,
        meta.context,
        meta.tags.join(" "),
        meta.source,
        meta.folder,
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
      folder: meta.folder,
      updatedAt: meta.updatedAt,
    });
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/**
 * Aggregate folder usage across all canvases. Returns flat list of distinct
 * folder paths with the count of direct (non-recursive) member canvases.
 */
export async function listFolders(): Promise<{ name: string; count: number }[]> {
  await ensureLayout();
  const counts = new Map<string, number>();
  let entries: string[];
  try { entries = await readdir(canvasesDir()); } catch { return []; }
  for (const id of entries) {
    if (id.startsWith(".")) continue;
    const meta = await readMeta(id);
    if (!meta) continue;
    counts.set(meta.folder, (counts.get(meta.folder) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Bulk-rename a folder. Updates every canvas where folder === from OR
 * starts with `from + "/"` (so renaming "work" also moves "work/q2", etc.).
 * Each affected canvas is snapshotted before the move.
 */
export async function renameFolder(from: string, to: string): Promise<{ moved: string[] }> {
  const fromN = normalizeFolder(from);
  const toN = normalizeFolder(to);
  if (fromN === toN) return { moved: [] };
  const moved: string[] = [];
  const all = await listCanvases({ folder: fromN, descendants: true });
  for (const summary of all) {
    const existing = await readMeta(summary.id);
    if (!existing) continue;
    let nextFolder: string;
    if (existing.folder === fromN) {
      nextFolder = toN;
    } else if (fromN === "" ? false : existing.folder.startsWith(fromN + "/")) {
      // Replace the prefix; preserve the rest of the path.
      const tail = existing.folder.slice(fromN.length);
      nextFolder = (toN + tail).replace(/^\/+/, "");
    } else {
      continue;
    }
    await updateCanvas(summary.id, { folder: nextFolder });
    moved.push(summary.id);
  }
  return { moved };
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
    let folder = "";
    try {
      const raw = await readFile(join(dir, version, FILES.meta), "utf8");
      const m = JSON.parse(raw) as Partial<CanvasMeta>;
      source = m.source ?? "";
      folder = m.folder ?? "";
    } catch { /* snapshot missing meta — leave fields blank */ }
    out.push({ version, timestamp: version, source, folder });
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
