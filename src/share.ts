import { promises as fs } from "node:fs";
import { join } from "node:path";
import { supacanvasHome, getCanvas } from "./storage.ts";
import { toStandaloneHtml } from "./export.ts";

/**
 * Where to send share API calls. Defaults to the production workers.dev
 * URL until supacanvas.com is wired up. Override via SUPACANVAS_SHARE_API
 * to point at a local `wrangler dev` instance, a staging worker, etc.
 */
const SHARE_API_DEFAULT = "https://supacanvas-share-api.bhaulikpatel966.workers.dev";

export function shareApiUrl(): string {
  return process.env.SUPACANVAS_SHARE_API || SHARE_API_DEFAULT;
}

/** Canonical viewer host (where `url` returned by the API ultimately resolves). */
const CANONICAL_HOST = "https://supacanvas.com";

interface OwnerTokenEntry {
  token: string;
  canvasId: string;
  title: string;
  createdAt: string;
}

interface OwnerTokenStore {
  [slug: string]: OwnerTokenEntry;
}

function tokenStorePath(): string {
  return join(supacanvasHome(), "share-tokens.json");
}

async function readTokenStore(): Promise<OwnerTokenStore> {
  try {
    const raw = await fs.readFile(tokenStorePath(), "utf8");
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object" ? parsed : {}) as OwnerTokenStore;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

async function writeTokenStore(store: OwnerTokenStore): Promise<void> {
  await fs.writeFile(tokenStorePath(), JSON.stringify(store, null, 2), {
    mode: 0o600,
  });
}

interface ShareApiResponse {
  slug: string;
  url: string;
  ownerToken: string;
  createdAt: string;
}

export interface ShareResult {
  slug: string;
  /** Canonical (supacanvas.com) URL — what's printed in OG tags etc. */
  canonicalUrl: string;
  /** URL that's reachable today (workers.dev fallback when domain isn't wired up yet). */
  liveUrl: string;
}

/**
 * Upload a canvas as a public share. Returns the slug + URLs and persists
 * the owner token under ~/.supacanvas/share-tokens.json so the user can
 * later revoke it.
 */
export async function shareCanvas(canvasId: string): Promise<ShareResult> {
  const canvas = await getCanvas(canvasId);
  if (!canvas) {
    throw new Error(`No canvas found with id "${canvasId}".`);
  }

  const standaloneHtml = await toStandaloneHtml(canvas);

  const response = await fetch(`${shareApiUrl()}/api/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: canvas.meta.title,
      description: canvas.meta.description,
      source: canvas.meta.source,
      html: standaloneHtml,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(humanShareError(response.status, errBody));
  }

  const data = (await response.json()) as ShareApiResponse;

  const store = await readTokenStore();
  store[data.slug] = {
    token: data.ownerToken,
    canvasId,
    title: canvas.meta.title,
    createdAt: data.createdAt,
  };
  await writeTokenStore(store);

  return {
    slug: data.slug,
    canonicalUrl: `${CANONICAL_HOST}/c/${data.slug}`,
    liveUrl: `${shareApiUrl()}/c/${data.slug}`,
  };
}

/**
 * Revoke a previously-created share. Requires the owner token (from the
 * local token store written at create time). If the token is missing
 * locally — which happens if the share was created from another machine —
 * the call fails with a helpful message.
 */
export async function revokeShare(slug: string): Promise<void> {
  const store = await readTokenStore();
  const entry = store[slug];
  if (!entry) {
    throw new Error(
      `No local owner token for slug "${slug}". You can only revoke shares created on this machine. (Tokens live in ~/.supacanvas/share-tokens.json.)`,
    );
  }

  const response = await fetch(`${shareApiUrl()}/api/share/${slug}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${entry.token}` },
  });

  // 404 means the share was already gone server-side — clean up locally and treat as success.
  if (!response.ok && response.status !== 404) {
    const errBody = await response.text().catch(() => "");
    throw new Error(humanShareError(response.status, errBody));
  }

  delete store[slug];
  await writeTokenStore(store);
}

export interface ListedShare {
  slug: string;
  title: string;
  canvasId: string;
  createdAt: string;
  /** Live view count from the server. undefined if the API is unreachable. */
  viewCount?: number;
  /** Whether the share still exists server-side (false if revoked or GC'd). */
  exists: boolean;
  canonicalUrl: string;
  liveUrl: string;
}

/**
 * List shares the user has created from this machine. Looks up live
 * status + view counts from the API in parallel; tolerates network
 * failures by returning undefined viewCount.
 */
export async function listShares(): Promise<ListedShare[]> {
  const store = await readTokenStore();
  const slugs = Object.keys(store);
  if (slugs.length === 0) return [];

  const api = shareApiUrl();
  const results = await Promise.all(
    slugs.map(async (slug): Promise<ListedShare> => {
      const local = store[slug]!;
      const base: ListedShare = {
        slug,
        title: local.title,
        canvasId: local.canvasId,
        createdAt: local.createdAt,
        exists: true,
        canonicalUrl: `${CANONICAL_HOST}/c/${slug}`,
        liveUrl: `${api}/c/${slug}`,
      };
      try {
        const r = await fetch(`${api}/api/share/${slug}`);
        if (r.status === 404 || r.status === 410) {
          return { ...base, exists: false };
        }
        if (r.ok) {
          const j = (await r.json()) as { viewCount?: number };
          return { ...base, viewCount: j.viewCount };
        }
      } catch {
        // network down; leave viewCount undefined
      }
      return base;
    }),
  );

  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results;
}

function humanShareError(status: number, body: string): string {
  let message = `Share API returned HTTP ${status}.`;
  if (status === 0) message = "Could not reach the share API. Are you online?";
  if (status === 401) message = "Authorization rejected. Token may be wrong.";
  if (status === 403) message = "Forbidden. Your token doesn't match this share's owner.";
  if (status === 413) message = "Canvas too large (> 1 MB after standalone HTML inlining).";
  if (status === 429) message = "Rate limited (50 shares per IP per day). Try again tomorrow.";
  if (body) {
    try {
      const j = JSON.parse(body);
      if (j.message) message += ` ${j.message}`;
    } catch {
      message += ` ${body.slice(0, 200)}`;
    }
  }
  return message;
}
