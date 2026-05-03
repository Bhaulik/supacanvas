/// <reference types="@cloudflare/workers-types" />

export interface Bindings {
  SHARE_META: KVNamespace;
  SHARE_RATELIMIT: KVNamespace;
  SHARE_BUCKET: R2Bucket;
  PUBLIC_BASE_URL: string;
}

export interface ShareMeta {
  slug: string;
  title: string;
  description: string;
  source: string;
  ownerHash: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  htmlSize: number;
  hasScreenshot: boolean;
}

export const MAX_HTML_BYTES = 1_048_576; // 1 MB
export const MAX_OG_IMAGE_BYTES = 500_000;
export const RATE_LIMIT_PER_DAY = 50;
export const TOMBSTONE_TTL_SECONDS = 7 * 24 * 60 * 60;

// Slug alphabet — base32-ish, no ambiguous chars (no 0,O,1,l,i)
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SLUG_LENGTH = 8;

// Owner-token alphabet — base62-style, 32 chars = ~190 bits of entropy
const TOKEN_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TOKEN_LENGTH = 32;

export function generateSlug(): string {
  return generateRandom(SLUG_ALPHABET, SLUG_LENGTH);
}

export function generateToken(): string {
  return generateRandom(TOKEN_ALPHABET, TOKEN_LENGTH);
}

function generateRandom(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    const byte = bytes[i] ?? 0;
    out += alphabet.charAt(byte % alphabet.length);
  }
  return out;
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * KV-backed daily rate limiter keyed by IP.
 * Returns true if the request is within the limit (and consumes one slot).
 * Returns false if the limit is exceeded.
 *
 * Note: KV is eventually consistent. Two simultaneous requests at the boundary
 * could both succeed. That's acceptable for spam prevention; real DDoS is
 * absorbed by Cloudflare's edge before it reaches the Worker.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  max: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `ratelimit:${ip}:${day}`;
  const current = parseInt((await kv.get(key)) ?? "0", 10);
  if (current >= max) {
    return { allowed: false, remaining: 0 };
  }
  await kv.put(key, String(current + 1), { expirationTtl: 24 * 60 * 60 });
  return { allowed: true, remaining: max - (current + 1) };
}

export function decodeBase64(input: string): Uint8Array {
  // Workers runtime supports atob — decode and convert to bytes
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function jsonError(
  message: string,
  code: string,
  status: number,
): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
