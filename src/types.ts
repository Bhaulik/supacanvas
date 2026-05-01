export interface CanvasMeta {
  id: string;
  title: string;
  /**
   * One- or two-sentence plain-language summary of what this canvas is.
   * Surfaced in the gallery and to AI agents listing canvases — write it as
   * if briefing someone who's never seen this canvas before.
   */
  description: string;
  /**
   * Longer plain-language context for any future reader (human or agent).
   * What data does this canvas represent? Where did it come from?
   * What should the next agent know before editing it?
   */
  context: string;
  tags: string[];
  theme: string;
  /**
   * Free-form provenance string identifying the AI tool/model that last wrote
   * to this canvas. Recommended format: "tool:model" (e.g. "cursor:claude-opus-4",
   * "claude-desktop:claude-sonnet-4-6", "claude-code:claude-opus-4-7"). May be
   * empty for canvases authored manually or by tools that don't identify themselves.
   */
  source: string;
  /** Slash-separated folder path, "" for root. Logical (in meta.json), so moves are atomic. */
  folder: string;
  createdAt: string;
  updatedAt: string;
}

export interface Canvas {
  meta: CanvasMeta;
  html: string;
  css: string;
  js: string;
}

export interface CanvasSummary {
  id: string;
  title: string;
  description: string;
  tags: string[];
  theme: string;
  source: string;
  /** Slash-separated folder path, "" for root. Logical (in meta.json), so moves are atomic. */
  folder: string;
  updatedAt: string;
}

export interface SnapshotInfo {
  version: string;
  timestamp: string;
  /** Source captured in the snapshot's own meta.json — who wrote that revision. */
  source: string;
  /** Slash-separated folder path, "" for root. Logical (in meta.json), so moves are atomic. */
  folder: string;
}

export interface AppConfig {
  port: number;
  defaultTheme: string;
  maxVersions: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  port: 7777,
  defaultTheme: "default",
  maxVersions: 20,
};
