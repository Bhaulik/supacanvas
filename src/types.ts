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
  updatedAt: string;
}

export interface SnapshotInfo {
  version: string;
  timestamp: string;
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
