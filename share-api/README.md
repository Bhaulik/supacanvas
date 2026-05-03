# supacanvas-share-api

Cloudflare Worker that hosts `supacanvas.com` — public canvas sharing for the supacanvas CLI.

> See `../docs/SHARE_ARCHITECTURE.md` for the full design rationale, data model, security model, and trigger criteria.

## Stack

- **Cloudflare Workers** (free tier) — edge runtime
- **Hono** — same HTTP framework as the local supacanvas server
- **KV** (`SHARE_META`, `SHARE_RATELIMIT`) — slug → metadata + per-IP daily counter
- **R2** (`supacanvas-share`) — canvas HTML blobs and optional OG screenshots

Cost: $0/month at <100 active sharers. ~$1 even if a single share goes viral and gets 1M views in a day.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/share` | Upload a canvas → returns `{slug, url, ownerToken}` |
| `GET` | `/api/share/:slug` | Metadata only (no HTML body) |
| `DELETE` | `/api/share/:slug` | Revoke (requires `Authorization: Bearer <ownerToken>`) |
| `GET` | `/c/:slug` | Render the public viewer page (with OG meta, footer chrome) |
| `GET` | `/c/:slug.png` | Cached screenshot if one was uploaded |
| `GET` | `/` | Marketing landing page |
| `GET` | `/health` | JSON healthcheck |

## Deployment — first time

Prereq: a Cloudflare account, `wrangler login` already run, `bun install` (or `npm install`) in this directory.

```sh
cd share-api
bun install                                          # or: npm install

# 1. Create the KV namespaces — wrangler prints the IDs
wrangler kv namespace create SHARE_META
wrangler kv namespace create SHARE_RATELIMIT

# 2. Paste the printed IDs into wrangler.toml
#    Replace REPLACE_WITH_SHARE_META_ID and REPLACE_WITH_SHARE_RATELIMIT_ID

# 3. Create the R2 bucket
wrangler r2 bucket create supacanvas-share

# 4. First deploy — lands on workers.dev (no custom domain yet)
wrangler deploy

# 5. Smoke test (use the workers.dev URL wrangler prints)
curl -X POST https://supacanvas-share-api.<your-handle>.workers.dev/api/share \
  -H "Content-Type: application/json" \
  -d '{"title":"Smoke test","html":"<h1>hello world</h1>"}'

# Expected: {"slug":"...","url":"https://supacanvas.com/c/...","ownerToken":"...","createdAt":"..."}

# 6. Add the supacanvas.com domain to Cloudflare (Dashboard → Add Site)
#    Once DNS is delegated to CF, uncomment the `routes` block in wrangler.toml
#    and re-run `wrangler deploy`.
```

## Local development

```sh
wrangler dev --port 8787
# Worker available at http://localhost:8787 with KV + R2 emulated locally
```

Test the routes against the local emulator:
```sh
curl -X POST http://localhost:8787/api/share \
  -H "Content-Type: application/json" \
  -d '{"title":"local test","html":"<h1>local</h1>"}'

curl http://localhost:8787/c/<the-slug-it-printed>
```

## Tail logs in production

```sh
wrangler tail
```

## Rate limits, security, privacy

See `../docs/SHARE_ARCHITECTURE.md` §7 (security) and §8 (privacy).

Quick summary:
- 50 shares per IP per 24h (KV-backed counter)
- HTML payload capped at 1 MB
- Owner token sha256-hashed in KV (lose the token, lose revoke ability)
- No PII collected, no IP retention beyond 24h rate-limit window
- 10% sampled view counter (intentionally fuzzy)

## What's NOT in this Worker (yet)

- **Server-side OG image generation** — for shares without uploaded screenshots, currently returns 404 on `/c/:slug.png`. Add `@vercel/og` or hand-rolled SVG→PNG when needed.
- **`supacanvas share` CLI command** — lives in `../src/share.ts` (separate task), this Worker only handles the HTTP side.
- **Admin stats endpoint** — `/admin/stats?token=<bhaulik-only>`, see architecture doc §12.
