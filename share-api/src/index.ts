/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  type Bindings,
  type ShareMeta,
  MAX_HTML_BYTES,
  MAX_OG_IMAGE_BYTES,
  RATE_LIMIT_PER_DAY,
  TOMBSTONE_TTL_SECONDS,
  generateSlug,
  generateToken,
  hashToken,
  checkRateLimit,
  decodeBase64,
  jsonError,
} from "./lib";
import {
  renderGone,
  renderLanding,
  renderNotFound,
  renderUseCases,
  renderViewer,
} from "./viewer";

const app = new Hono<{ Bindings: Bindings }>();

// Permissive CORS on /api/* — the local CLI doesn't need it (server-to-server)
// but the future Chrome extension might.
app.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "POST", "DELETE"] }));

// ============================================================ POST /api/share
app.post("/api/share", async (c) => {
  const ip =
    c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip") ?? "unknown";

  const rl = await checkRateLimit(c.env.SHARE_RATELIMIT, ip, RATE_LIMIT_PER_DAY);
  if (!rl.allowed) {
    return jsonError(
      `Rate limit hit: ${RATE_LIMIT_PER_DAY} shares per IP per 24 hours.`,
      "rate_limited",
      429,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Body must be valid JSON.", "invalid_json", 400);
  }

  const html = typeof body.html === "string" ? body.html : "";
  if (!html) {
    return jsonError("Field 'html' is required.", "missing_html", 400);
  }
  const htmlBytes = new TextEncoder().encode(html).byteLength;
  if (htmlBytes > MAX_HTML_BYTES) {
    return jsonError(
      `'html' must be <= ${MAX_HTML_BYTES} bytes (got ${htmlBytes}).`,
      "html_too_large",
      413,
    );
  }

  const slug = generateSlug();
  const token = generateToken();
  const ownerHash = await hashToken(token);
  const now = new Date().toISOString();

  let hasScreenshot = false;
  if (typeof body.ogImage === "string" && body.ogImage.length > 0) {
    if (body.ogImage.length > MAX_OG_IMAGE_BYTES * 1.4) {
      return jsonError(
        `'ogImage' (base64) must be <= ~${MAX_OG_IMAGE_BYTES} bytes when decoded.`,
        "og_image_too_large",
        413,
      );
    }
    try {
      const png = decodeBase64(body.ogImage);
      await c.env.SHARE_BUCKET.put(`share/${slug}/screenshot.png`, png, {
        httpMetadata: { contentType: "image/png" },
      });
      hasScreenshot = true;
    } catch {
      // Non-fatal — screenshot is optional
    }
  }

  const meta: ShareMeta = {
    slug,
    title: typeof body.title === "string" ? body.title.slice(0, 200) : "Untitled",
    description:
      typeof body.description === "string" ? body.description.slice(0, 500) : "",
    source: typeof body.source === "string" ? body.source.slice(0, 80) : "",
    ownerHash,
    createdAt: now,
    updatedAt: now,
    viewCount: 0,
    htmlSize: htmlBytes,
    hasScreenshot,
  };

  await c.env.SHARE_META.put(slug, JSON.stringify(meta));
  await c.env.SHARE_BUCKET.put(`share/${slug}/index.html`, html, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });

  return c.json(
    {
      slug,
      url: `${c.env.PUBLIC_BASE_URL}/c/${slug}`,
      ownerToken: token,
      createdAt: now,
    },
    201,
  );
});

// ============================================================ GET /api/share/:slug
app.get("/api/share/:slug", async (c) => {
  const slug = c.req.param("slug");
  const tombstone = await c.env.SHARE_META.get(`tombstone:${slug}`);
  if (tombstone) {
    return c.json({ exists: false, revoked: true }, 410);
  }
  const raw = await c.env.SHARE_META.get(slug);
  if (!raw) return c.json({ exists: false }, 404);
  const meta = JSON.parse(raw) as ShareMeta;
  return c.json({
    slug: meta.slug,
    title: meta.title,
    description: meta.description,
    source: meta.source,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    viewCount: meta.viewCount,
    hasScreenshot: meta.hasScreenshot,
    exists: true,
  });
});

// ============================================================ DELETE /api/share/:slug
app.delete("/api/share/:slug", async (c) => {
  const slug = c.req.param("slug");
  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return jsonError(
      "Missing 'Authorization: Bearer <ownerToken>' header.",
      "missing_token",
      401,
    );
  }

  const raw = await c.env.SHARE_META.get(slug);
  if (!raw) return jsonError("No share found at that slug.", "not_found", 404);
  const meta = JSON.parse(raw) as ShareMeta;

  const provided = await hashToken(token);
  if (provided !== meta.ownerHash) {
    return jsonError(
      "Owner token does not match. Cannot revoke.",
      "forbidden",
      403,
    );
  }

  // Tombstone for 7 days so the slug can't be immediately reused, then GC'd
  await c.env.SHARE_META.put(`tombstone:${slug}`, "1", {
    expirationTtl: TOMBSTONE_TTL_SECONDS,
  });
  await c.env.SHARE_META.delete(slug);
  await c.env.SHARE_BUCKET.delete(`share/${slug}/index.html`);
  if (meta.hasScreenshot) {
    await c.env.SHARE_BUCKET.delete(`share/${slug}/screenshot.png`);
  }

  return c.json({ ok: true, message: "Share revoked." });
});

// ============================================================ GET /c/:slug (and /c/:slug.png)
app.get("/c/:slug", async (c) => {
  let slug = c.req.param("slug");
  let asPng = false;
  if (slug.endsWith(".png")) {
    slug = slug.slice(0, -4);
    asPng = true;
  } else if (slug.endsWith(".html")) {
    slug = slug.slice(0, -5);
  }

  const tombstone = await c.env.SHARE_META.get(`tombstone:${slug}`);
  if (tombstone) {
    return new Response(renderGone(), {
      status: 410,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const rawMeta = await c.env.SHARE_META.get(slug);
  if (!rawMeta) {
    return new Response(renderNotFound(), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const meta = JSON.parse(rawMeta) as ShareMeta;

  if (asPng) {
    if (!meta.hasScreenshot) {
      // No screenshot uploaded — return 404 for now.
      // TODO: server-side OG image generation as fallback (use @vercel/og or hand-rolled SVG→PNG).
      return new Response("No screenshot for this share.", { status: 404 });
    }
    const obj = await c.env.SHARE_BUCKET.get(`share/${slug}/screenshot.png`);
    if (!obj) return new Response("Screenshot missing.", { status: 404 });
    return new Response(obj.body, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  }

  const obj = await c.env.SHARE_BUCKET.get(`share/${slug}/index.html`);
  if (!obj) {
    return new Response(renderNotFound(), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const html = await obj.text();

  // 10% sampled view counter — privacy-friendly fuzziness
  if (Math.random() < 0.1) {
    meta.viewCount = (meta.viewCount ?? 0) + 10;
    c.executionCtx.waitUntil(
      c.env.SHARE_META.put(slug, JSON.stringify(meta)),
    );
  }

  const page = renderViewer(meta, html, c.env.PUBLIC_BASE_URL);

  // CSP: lock the page down. Canvas HTML can include inline scripts/styles;
  // block top-frame nav and iframing by other sites.
  const csp = [
    "default-src 'self'",
    "script-src 'unsafe-inline' 'unsafe-eval' 'self' https:",
    "style-src 'unsafe-inline' 'self' https://fonts.googleapis.com https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": csp,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
});

// ============================================================ GET / (landing)
app.get("/", (c) => {
  return new Response(renderLanding(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
});

// ============================================================ GET /uses (use-case prompt library)
app.get("/uses", (c) => {
  return new Response(renderUseCases(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
});

// ============================================================ Healthcheck
app.get("/health", (c) =>
  c.json({ ok: true, service: "supacanvas-share-api", t: Date.now() }),
);

// ============================================================ 404
app.notFound((c) =>
  c.req.path.startsWith("/api/")
    ? jsonError("Endpoint not found.", "not_found", 404)
    : new Response(renderNotFound(), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
);

export default app;
