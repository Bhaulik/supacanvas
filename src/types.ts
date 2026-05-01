export interface PlateMeta {
  id: string;
  title: string;
  /**
   * One- or two-sentence plain-language summary of what this plate is.
   * Surfaced in the gallery and to AI agents listing plates — write it as
   * if briefing someone who's never seen this plate before.
   */
  description: string;
  /**
   * Longer plain-language context for any future reader (human or agent).
   * What data does this plate represent? Where did it come from?
   * What should the next agent know before editing it?
   */
  context: string;
  tags: string[];
  theme: string;
  /**
   * Free-form provenance string identifying the AI tool/model that last wrote
   * to this plate. Recommended format: "tool:model" (e.g. "cursor:claude-opus-4",
   * "claude-desktop:claude-sonnet-4-6", "claude-code:claude-opus-4-7"). May be
   * empty for plates authored manually or by tools that don't identify themselves.
   */
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface Plate {
  meta: PlateMeta;
  html: string;
  css: string;
  js: string;
}

export interface PlateSummary {
  id: string;
  title: string;
  description: string;
  tags: string[];
  theme: string;
  source: string;
  updatedAt: string;
}

export interface SnapshotInfo {
  version: string;
  timestamp: string;
  /** Source captured in the snapshot's own meta.json — who wrote that revision. */
  source: string;
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
