# `supacanvas share` — Architecture & Build Plan

> **Status:** Draft · 2026-05-02
> **Goal:** Ship the smallest possible hosted feature (public canvas sharing) in ~3 days. Treat it as a demand-signal experiment, not the start of "Supacanvas Cloud."
> **Context:** 427 npm installs, ~20-30 active users. Too early for accounts/billing/sync. Too late to do nothing — momentum is real and free public sharing is a viral surface.

---

## 1. Goals & non-goals

### Goals
- A user runs `supacanvas share <id>` and gets a public URL anyone can open.
- The URL renders the canvas exactly as the local viewer does (theme + sandboxed iframe).
- Every shared URL is a viral landing page — Open Graph card, screenshot preview, "Made with supacanvas" footer, install link.
- Free for every user, forever, at this scale (no account, no card).
- ~3 days of solo work, including deploy.
- Costs **<$5/month at 1k active sharers**.

### Explicit non-goals (defer until trigger criteria hit — see §11)
- ❌ User accounts / login / sessions
- ❌ Stripe / billing / subscriptions
- ❌ Cross-device sync of `~/.supacanvas/`
- ❌ Team workspaces / collaboration / comments
- ❌ Custom domains
- ❌ Private shares (everything is public-by-URL)
- ❌ Edit-after-publish (re-run `share` to update — old URL stays valid)
- ❌ Analytics dashboard for sharers (just a view counter on the page)
- ❌ Server-side canvas rendering for screenshots (use the local Puppeteer at share-time)

---

## 2. User flows

### 2.1 Sharing a canvas
```
$ supacanvas share weather-dash-7k2

  Uploaded: weather-dash-7k2 (12.4 KB)
  Public URL: https://supacanvas.so/c/x7k2pa9b
  Owner token saved to ~/.supacanvas/share-tokens.json

  Anyone with this URL can view the canvas. Revoke anytime:
    $ supacanvas share --revoke x7k2pa9b
```

### 2.2 Viewing a shared canvas
- Anyone opens `https://supacanvas.so/c/x7k2pa9b` → renders the standalone HTML
- Open Graph meta tags → preview cards on Twitter, Slack, Discord, LinkedIn
- Footer: "Made with [supacanvas](https://supacanvas.so) · Install" (the viral hook)
- View counter increments (sampled, not exact)

### 2.3 Revoking
```
$ supacanvas share --revoke x7k2pa9b
  Revoked. URL now returns 410 Gone.
```

### 2.4 Listing your shares
```
$ supacanvas share --list
  x7k2pa9b   weather-dash-7k2   2026-05-02   42 views
  m3pq8tx2   q2-revenue-board   2026-04-28   3 views
```

### 2.5 Updating
```
$ supacanvas share --update x7k2pa9b weather-dash-7k2
  Updated. Same URL: https://supacanvas.so/c/x7k2pa9b
```

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────┐
│  Local machine                                         │
│                                                        │
│   supacanvas CLI                                       │
│   ├── reads ~/.supacanvas/canvases/<id>/               │
│   ├── runs toStandaloneHtml() (already exists)         │
│   ├── POSTs to https://supacanvas.so/api/share         │
│   └── stores owner token in                            │
│       ~/.supacanvas/share-tokens.json                  │
└─────────────────────┬──────────────────────────────────┘
                      │  multipart/form-data: html, meta JSON
                      │  Authorization: Bearer <new owner token>
                      ▼
┌────────────────────────────────────────────────────────┐
│  Cloudflare Workers (supacanvas-share-api)             │
│                                                        │
│   Hono app (same framework as local server)            │
│   ├── POST /api/share         → upload                 │
│   ├── DELETE /api/share/:slug → revoke (token-gated)   │
│   ├── GET /api/share/:slug    → metadata only          │
│   ├── GET /c/:slug            → render HTML viewer     │
│   ├── GET /c/:slug.png        → screenshot redirect    │
│   ├── GET /                   → marketing landing page │
│   └── Rate limit (50 shares/IP/day, KV-backed)         │
└─────────┬─────────────────────────┬────────────────────┘
          │                         │
          ▼                         ▼
┌─────────────────┐         ┌──────────────────────────┐
│  Cloudflare KV  │         │  Cloudflare R2           │
│                 │         │                          │
│  slug → meta    │         │  share/<slug>/index.html │
│  ratelimit:ip   │         │  share/<slug>/screen.png │
└─────────────────┘         └──────────────────────────┘
```

### Why this stack
| Choice | Reason |
|---|---|
| **Cloudflare Workers** | Same Hono framework as local server (no context switch). 100k req/day free tier. Edge-fast globally. No cold start. |
| **Hono** | You already know it — `src/http.ts` is Hono on Node, the share API is Hono on Workers. Routes feel identical. |
| **Cloudflare KV** | Slug → meta lookups must be ≤10ms. KV is built for read-heavy edge KV. Free 100k reads/day, 1k writes/day, 1GB. |
| **Cloudflare R2** | Stores the actual canvas HTML blobs. **Zero egress fees** (S3 charges $0.09/GB out — kills the unit economics for a viral page). 10GB free. |
| **No SQL database** | Don't need joins. KV is enough. Adding Postgres later if/when accounts ship. |
| **No auth library** | Owner token = random 32-char string, sha256 hashed in KV. Stateless. No JWT, no sessions. |

### Why NOT Vercel / Render / Fly
- Vercel: blob egress isn't free, function cold starts hurt at low traffic
- Render / Fly: always-on container = $7/mo minimum even at zero traffic
- Workers: $0/mo at this scale, scales to $5/mo Workers Paid plan after free tier (covers ~10M req/mo)

### Why supacanvas.so (or whatever the domain is)
- Single domain for marketing + share URLs = simplicity + SEO compounding
- `supacanvas.so/c/<slug>` matches the local viewer URL pattern (`localhost:7777/c/<id>`)
- One Cloudflare zone, one Worker route

---

## 4. API surface

### `POST /api/share`
Upload a canvas to be hosted publicly.

**Request:**
```http
POST /api/share
Content-Type: application/json

{
  "title": "Q2 revenue dashboard",
  "description": "NA / EMEA / APAC, sourced from Salesforce 2026-04-30",
  "source": "claude-code:claude-opus-4-7",
  "html": "<full standalone HTML from toStandaloneHtml() — theme inlined>",
  "ogImage": "<base64 PNG screenshot, optional>"
}
```

**Response (201):**
```json
{
  "slug": "x7k2pa9b",
  "url": "https://supacanvas.so/c/x7k2pa9b",
  "ownerToken": "f3a8…<32 chars>",
  "createdAt": "2026-05-02T18:30:00Z"
}
```

**Constraints:**
- `html` ≤ 1 MB (compressed). Larger → 413.
- `ogImage` ≤ 500 KB. Larger or omitted → server uses a generic OG card.
- Rate limited to 50 shares per IP per 24h (returns 429 with `Retry-After`).
- No auth required to upload (deliberately — friction kills the wedge).

### `DELETE /api/share/:slug`
**Headers:** `Authorization: Bearer <ownerToken>`

Compares sha256(token) against stored hash. On match: deletes KV entry + R2 blob, replaces with 410 Gone marker (in KV with 7-day TTL so the URL doesn't immediately get reused for someone else).

### `GET /api/share/:slug`
Returns metadata only (no full HTML). Useful for the CLI's `--list` and `--update` commands.
```json
{
  "slug": "x7k2pa9b",
  "title": "Q2 revenue dashboard",
  "createdAt": "2026-05-02T18:30:00Z",
  "viewCount": 42,
  "exists": true
}
```

### `GET /c/:slug`
Returns the rendered HTML — the canvas wrapped in a chrome that adds:
- `<meta property="og:*">` tags (title, description, image)
- A small fixed footer: "Made with supacanvas · Install"
- A sampled view-count increment (10% sample → counter ≥ ~10 means real signal)
- CSP headers locking down the iframe (no top-nav, no same-origin, allow-scripts only)

### `GET /c/:slug.png`
302 redirect to R2 public URL of the cached screenshot. If no screenshot was uploaded, returns a generated PNG card with the title in the supacanvas brand style (also cached in R2).

### `GET /`
Marketing landing page. v1 is a single static page describing what supacanvas is, with `npm install -g supacanvas` and a link to the GitHub repo.

---

## 5. Data model

### KV namespace `SHARE_META`
```typescript
type ShareMeta = {
  slug: string;          // "x7k2pa9b"
  title: string;
  description: string;
  source: string;        // "claude-code:claude-opus-4-7"
  ownerHash: string;     // sha256 hex of the owner token
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
  viewCount: number;     // sampled
  htmlSize: number;      // bytes, for analytics
  hasScreenshot: boolean;
};

// keyed by slug
```

### KV namespace `SHARE_RATELIMIT`
```typescript
// keyed by `ratelimit:<ip-or-cf-ray>:<utc-day>`
// value: { count: number }
// TTL: 86400s
```

### R2 bucket `supacanvas-share`
```
share/<slug>/index.html        (the standalone HTML)
share/<slug>/screenshot.png    (optional)
```

R2 access is ONLY via the Worker — no public bucket URLs. This means we can revoke instantly without R2 propagation lag.

---

## 6. CLI changes (`src/cli.ts`)

### New file: `src/share.ts`
```typescript
const SHARE_API = process.env.SUPACANVAS_SHARE_API ?? "https://supacanvas.so";
const TOKEN_PATH = path.join(supacanvasHome(), "share-tokens.json");

export async function shareCanvas(id: string): Promise<{ slug: string; url: string }>;
export async function revokeShare(slug: string): Promise<void>;
export async function listShares(): Promise<Array<{ slug: string; title: string; createdAt: string; viewCount: number }>>;
export async function updateShare(slug: string, id: string): Promise<void>;
```

Token storage format (`~/.supacanvas/share-tokens.json`):
```json
{
  "x7k2pa9b": {
    "token": "f3a8…",
    "canvasId": "weather-dash-7k2",
    "title": "Weather dashboard",
    "createdAt": "2026-05-02T18:30:00Z"
  }
}
```

### CLI commands (added to `src/cli.ts`)
```
supacanvas share <id>                  # upload, print URL
supacanvas share --list                # list owned shares
supacanvas share --revoke <slug>       # take down
supacanvas share --update <slug> <id>  # re-upload to same slug
```

### Optional MCP tool (`src/mcp.ts`)
```
canvas_share { id }       # for AI agents to share on the user's behalf
canvas_unshare { slug }   # revoke
```

Defer adding the MCP tool to v0.2 — sharing is a deliberate user action, not something agents should do automatically.

---

## 7. Security & abuse model

### What we're protecting against
| Threat | Mitigation |
|---|---|
| Spam shares (10k upload script) | 50 shares/IP/day rate limit, 1MB HTML size cap |
| Hosting malware HTML (drive-by, phishing kits) | CSP locks scripts to canvas iframe sandbox; no top-frame nav; no third-party resources allowed in CSP |
| Hosting illegal content (CSAM, etc.) | "Report" link in footer → email; manual takedown; we keep no PII so cooperation with law enforcement is "here's the IP that uploaded, here's the HTML" |
| Slug enumeration | 8-char base62 = 218 trillion combos, no enumeration possible |
| Token theft → unauthorized revoke | Tokens are 32-char random, only sha256 hash stored. Token loss only affects the owner's ability to revoke — doesn't grant edit access (each share is immutable; updates need the token) |
| Server-side resource exhaustion | All Worker endpoints are pure functions over KV/R2; no in-memory state, no per-user heap |
| DDoS | Cloudflare absorbs at edge; Workers Free has no per-request cost |

### What we accept
- **Anyone can view any shared URL.** That's the point. Made obvious in CLI output.
- **No personal data is collected.** No email, no name, no IP retention beyond rate limit window.
- **Owner has limited recovery options.** Lose the token → can't revoke. We document this clearly. (Future: account-based recovery, but that's deliberately deferred.)
- **One person can create up to 50 shares/day.** Fine.

### CSP for `/c/:slug` pages
```
Content-Security-Policy:
  default-src 'self';
  script-src 'unsafe-inline' 'unsafe-eval';   # canvases need inline scripts
  style-src 'unsafe-inline' fonts.googleapis.com;
  font-src fonts.gstatic.com;
  img-src 'self' data: blob:;
  frame-ancestors 'none';                      # can't be iframed by other sites
  base-uri 'none';
  form-action 'none';
```

Note: the canvas HTML lives inside this page directly (no double-iframe needed because the entire page is the sandbox). The `frame-ancestors 'none'` blocks click-jacking.

---

## 8. Privacy

- **No accounts** → no PII to leak
- **No analytics SDK** → no Google Analytics, no PostHog, no third-party JS
- **Sampled view counter** → exact view count is intentionally fuzzy (10% sample), reduces fingerprinting
- **No IP logging** beyond the 24h rate-limit window (then KV TTL deletes it)
- **No referrer logging**
- **CF Workers logs** are off / minimal — only enable for debugging incidents

The pitch: **"public hosting that doesn't track viewers."**

---

## 9. Cost projection

### Free tier (everything below is $0):
- Workers: 100k requests/day
- KV: 100k reads/day, 1k writes/day, 1 GB stored
- R2: 10 GB stored, 1M Class A ops/mo, 10M Class B ops/mo, **0 egress fees**

### Realistic month-12 at 1k active sharers (2 shares/sharer/mo, 50 views/share):
- Shares: 24k uploads → 24k Worker requests + 24k KV writes + ~50MB R2 storage
- Views: 1.2M / mo → 40k/day → 1.2M Worker reads + 1.2M KV reads + 1.2M R2 Class B ops
- KV reads exceed free (100k/day = 3M/mo; we'd be at 1.2M, still free)
- Workers requests exceed free (100k/day = 3M/mo; we'd be at 1.224M, still free)
- R2 storage: well under 10GB

**Bill: $0/mo.** First real money kicks in at ~10k active sharers (~$5/mo Workers Paid + R2 storage).

### Worst case (one viral share gets 1M views in a day):
- 1M Worker requests → exceeds 100k/day free → **kicks into Workers Paid: $5/mo + $0.30/M = $0.30 incremental**
- 1M KV reads → exceeds 100k/day free → KV Paid pricing $0.50/M = $0.45
- R2 egress: $0
- **Total worst-case incident: ~$1.** That's the entire blast radius of a viral hit.

---

## 10. Build sequence (3 days)

### Day 1 — Cloud surface
- [ ] `pnpm create cloudflare supacanvas-share-api --type hello-world --ts` (or wrangler-only setup)
- [ ] `wrangler kv namespace create SHARE_META` + `SHARE_RATELIMIT`
- [ ] `wrangler r2 bucket create supacanvas-share`
- [ ] Hono app with all 6 endpoints (~250 LOC)
- [ ] Slug generator (8-char base62)
- [ ] Owner-token system (gen, hash, verify)
- [ ] Rate limit middleware (KV-backed counter)
- [ ] Deploy to Cloudflare under `supacanvas.so` (or `share.supacanvas.so` for v1, swap later)
- [ ] Smoke-test with curl

### Day 2 — Local CLI integration
- [ ] `src/share.ts` — token storage, upload, revoke, list helpers
- [ ] Hook into `src/cli.ts` (4 new subcommands)
- [ ] Re-use `toStandaloneHtml()` from `src/export.ts` for the upload payload
- [ ] Add `share-tokens.json` to the `~/.supacanvas/` layout (existing storage layer is the right home)
- [ ] Friendly error messages: server unreachable, rate-limited, payload too big, slug already revoked
- [ ] Print **clear privacy notice** on first share: "This URL is public. Anyone with it can view your canvas."

### Day 3 — Polish & launch
- [ ] Viewer page chrome: Open Graph tags, footer, optional screenshot
- [ ] Screenshot upload from CLI: if Chrome is available locally, run `screenshotCanvas()` (existing) and POST as `ogImage`
- [ ] Marketing landing page at `/` (single static HTML; reuse the gallery aesthetic)
- [ ] README + AGENTS.md updates: add `supacanvas share` documentation
- [ ] Add a "Share this canvas" button to the local viewer (`src/http.ts` viewer drawer) → calls the same API via `chrome.runtime` … no wait, this is the local server, just a fetch from the viewer to localhost CLI? Actually: the local viewer drawer can call a new local endpoint `POST /api/canvases/:id/share` that proxies to the share API. That keeps the share secret on the server, not in the browser
- [ ] Show HN draft: "Show HN: Supacanvas — local AI artifacts, now shareable"

### Day 4 (slack day)
- Bug fixes from real usage
- Tally form for "What would make you pay for hosted supacanvas?" linked from the landing page footer

---

## 11. Trigger criteria → graduate to "real" hosted

Build accounts/sync/billing when **any one** of these hits:

| Trigger | Number | Why this signal |
|---|---|---|
| **Behavioral: 100+ unique sharers / month** | 100 | Means there's a real "I want to share my work" use case at scale, not just curiosity |
| **Verbal: 10+ users emailing/issuing for sync or accounts** | 10 | Real demand for the next feature, not assumed demand |
| **Engagement: 50+ shares/week sustained for 4 weeks** | 200/mo | Means people are sharing repeatedly (not one-and-done) — they have an ongoing reason |
| **Conversion: someone tries to pay you** | 1 | The strongest possible signal |

If none of these hit by **2026-09-01** (4 months post-launch), the wedge isn't sharing — talk to the few users who DID share, find what they actually want, and pivot the wedge.

---

## 12. Metrics to track (built-in, no third party)

A simple admin endpoint behind a hardcoded admin token:
```
GET /admin/stats?token=<bhaulik-only>
```
Returns:
- Total shares (all time)
- Shares last 24h, 7d, 30d
- Total views (all time, sampled)
- Unique slugs viewed in last 7d
- Top 20 most-viewed slugs (slug, title, viewCount)
- Distinct rate-limited IPs in last 24h (abuse signal)

Watch this weekly. Match spikes to GitHub stars / npm downloads / Twitter mentions.

---

## 13. Open questions (decide during build)

| Question | Default if unresolved |
|---|---|
| Domain: `supacanvas.so`, `supacanvas.app`, `supa.so`? | `supacanvas.so` — register before publishing |
| Slug format: 8-char base62 vs. 6-char + collision detect? | 8-char base62 (no collision logic needed) |
| Can the canvas update after share? | Yes via `--update` (re-upload, same slug). New `updatedAt`. View count preserved. |
| Show "Made with supacanvas" footer always? | Yes for v1. Future paid tier could remove it. |
| Allow custom slugs (`/c/my-dashboard`)? | No for v1. Adds collision logic + name-squatting risk. Defer. |
| Should the Chrome extension show a "Share" button? | Yes — calls the same API. Day 3 stretch. |
| Should we generate OG images server-side if no screenshot uploaded? | Yes — simple Cloudflare Workers + `@vercel/og` or hand-rolled SVG → PNG. |
| What happens to a slug after revoke — reusable? | No, blocked for 7 days then garbage collected. Avoids URL hijacking. |

---

## 14. Why this is the right wedge

A summary of the strategic case (the long version is in the prior conversation):

1. **Lowest possible build cost** for a hosted feature (3 days vs. 3-4 weeks for full accounts/sync)
2. **Biggest possible demand-signal-per-engineering-hour** — every share is a public URL that either gets viewed or doesn't
3. **Built-in viral loop** — every shared canvas is a landing page for new users
4. **No subscription infrastructure means no support burden** — there's nothing to bill, dispute, or refund
5. **Pre-qualifies eventual paid users** — when you ship accounts later, "people who shared 5+ times" is your conversion list
6. **Zero ongoing cost at this scale** — no risk of running out of runway during the experiment
7. **Reversible** — if it doesn't work in 4 months, you turn off the Worker and it costs you nothing. Existing shares 410 gracefully.

The prior recommendation was: don't build hosted yet. The refined recommendation is: **don't build the *full* hosted product yet — build the *smallest* hosted feature that tests demand.** That's `supacanvas share`.
