export const SERVER_URL = "http://localhost:7777";

export interface CanvasSummary {
  id: string;
  title: string;
  description: string;
  tags: string[];
  theme: string;
  source: string;
  folder: string;
  updatedAt: string;
}

export interface FolderEntry {
  name: string;
  count: number;
}

export interface CanvasMeta extends CanvasSummary {
  context: string;
  createdAt: string;
}

export interface CreateCanvasInput {
  title: string;
  html: string;
  css?: string;
  js?: string;
  description?: string;
  context?: string;
  source?: string;
  folder?: string;
  tags?: string[];
  theme?: string;
}

interface ApiRequest {
  type: "api";
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
}

interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function call<T>(req: ApiRequest): Promise<T> {
  const res = (await chrome.runtime.sendMessage(req)) as ApiResponse<T> | undefined;
  if (!res) throw new Error("No response from background worker");
  if (!res.ok) throw new Error(res.error ?? `Request failed (${res.status})`);
  return res.data as T;
}

export interface ListOptions {
  search?: string;
  folder?: string;
  descendants?: boolean;
  tag?: string;
  limit?: number;
}

export async function listCanvases(opts: ListOptions = {}): Promise<CanvasSummary[]> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.folder !== undefined) params.set("folder", opts.folder);
  if (opts.descendants) params.set("descendants", "1");
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return call<CanvasSummary[]>({
    type: "api",
    method: "GET",
    path: `/api/canvases${qs ? `?${qs}` : ""}`,
  });
}

export async function listFolders(): Promise<FolderEntry[]> {
  return call<FolderEntry[]>({ type: "api", method: "GET", path: "/api/folders" });
}

export async function createCanvas(input: CreateCanvasInput): Promise<CanvasMeta> {
  return call<CanvasMeta>({
    type: "api",
    method: "POST",
    path: "/api/canvases",
    body: input,
  });
}

export function canvasViewerUrl(id: string): string {
  return `${SERVER_URL}/c/${id}`;
}

export function canvasThumbnailUrl(id: string, w = 320, h = 200): string {
  return `${SERVER_URL}/c/${id}/screenshot.png?w=${w}&h=${h}&dpr=1`;
}

export function galleryUrl(folder?: string): string {
  if (folder) return `${SERVER_URL}/?folder=${encodeURIComponent(folder)}`;
  return `${SERVER_URL}/`;
}
