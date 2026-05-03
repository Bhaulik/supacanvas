import type { ShareMeta } from "./lib";

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function renderViewer(
  meta: ShareMeta,
  htmlBody: string,
  publicBase: string,
): string {
  const title = escapeHtml(meta.title || "Untitled canvas");
  const description = escapeHtml(meta.description || "Made with supacanvas.");
  const url = `${publicBase}/c/${meta.slug}`;
  const ogImage = meta.hasScreenshot ? `${publicBase}/c/${meta.slug}.png` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Supacanvas</title>
  <meta name="description" content="${description}">

  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${escapeAttr(url)}">
  ${ogImage ? `<meta property="og:image" content="${escapeAttr(ogImage)}">` : ""}

  <meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${ogImage ? `<meta name="twitter:image" content="${escapeAttr(ogImage)}">` : ""}

  <style id="supacanvas-foot-style">
    .supacanvas-foot {
      position: fixed;
      bottom: 14px;
      right: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif;
      font-size: 11px;
      color: rgba(26, 22, 20, 0.6);
      background: rgba(245, 240, 230, 0.92);
      padding: 7px 12px;
      border-radius: 999px;
      border: 1px solid rgba(26, 22, 20, 0.08);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 2147483647;
      letter-spacing: 0.02em;
    }
    .supacanvas-foot a {
      color: #a8352d;
      text-decoration: none;
      font-weight: 500;
    }
    .supacanvas-foot a:hover { text-decoration: underline; }
  </style>
</head>
<body>
${htmlBody}
<aside class="supacanvas-foot" aria-label="Made with Supacanvas">
  Made with <a href="${escapeAttr(publicBase)}" target="_blank" rel="noreferrer">supacanvas</a>
</aside>
</body>
</html>`;
}

// One-click deep links for clients that support them.
function buildCursorDeepLink(): string {
  const config = JSON.stringify({ command: "supacanvas", args: ["mcp"] });
  const b64 = btoa(config);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=supacanvas&config=${encodeURIComponent(b64)}`;
}

function buildVSCodeDeepLink(insiders = false): string {
  const config = JSON.stringify({ name: "supacanvas", command: "supacanvas", args: ["mcp"] });
  const scheme = insiders ? "vscode-insiders" : "vscode";
  return `${scheme}:mcp/install?${encodeURIComponent(config)}`;
}

const INSTALL_CMD = "npm install -g supacanvas";
const SERVE_CMD = "supacanvas serve";
const CLAUDE_CODE_CMD = "claude mcp add supacanvas supacanvas mcp";
const CLAUDE_DESKTOP_JSON = JSON.stringify(
  { mcpServers: { supacanvas: { command: "supacanvas", args: ["mcp"] } } },
  null,
  2,
);
const CONTINUE_YAML = `mcpServers:
  - name: supacanvas
    command: supacanvas
    args:
      - mcp`;
const UNIVERSAL_JSON = JSON.stringify(
  { supacanvas: { command: "supacanvas", args: ["mcp"] } },
  null,
  2,
);

// === Mini-illustration SVGs for the hero specimen grid ===
// Thin-line botanical-illustration style. All use currentColor for the stroke.
const SPEC_DASHBOARD = `<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" aria-hidden="true">
  <rect x="6" y="6" width="22" height="14"/>
  <rect x="32" y="6" width="22" height="14"/>
  <rect x="6" y="24" width="22" height="14"/>
  <rect x="32" y="24" width="22" height="14"/>
  <rect x="6" y="42" width="48" height="12"/>
  <line x1="10" y1="16" x2="14" y2="12"/><line x1="14" y1="12" x2="18" y2="14"/><line x1="18" y1="14" x2="24" y2="10"/>
  <line x1="36" y1="16" x2="40" y2="12"/><line x1="40" y1="12" x2="46" y2="13"/><line x1="46" y1="13" x2="50" y2="10"/>
  <circle cx="17" cy="31" r="4"/>
  <line x1="36" y1="32" x2="42" y2="28"/><line x1="42" y1="28" x2="46" y2="32"/><line x1="46" y1="32" x2="50" y2="29"/>
  <line x1="10" y1="48" x2="50" y2="48"/>
</svg>`;

const SPEC_BARCHART = `<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" aria-hidden="true">
  <line x1="8" y1="50" x2="52" y2="50"/>
  <line x1="8" y1="50" x2="8" y2="10"/>
  <rect x="14" y="34" width="6" height="16"/>
  <rect x="24" y="22" width="6" height="28"/>
  <rect x="34" y="28" width="6" height="22"/>
  <rect x="44" y="16" width="6" height="34"/>
</svg>`;

const SPEC_PIE = `<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" aria-hidden="true">
  <circle cx="30" cy="30" r="20"/>
  <line x1="30" y1="30" x2="30" y2="10"/>
  <line x1="30" y1="30" x2="47" y2="40"/>
  <line x1="30" y1="30" x2="13" y2="40"/>
</svg>`;

const SPEC_LINE = `<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" aria-hidden="true">
  <line x1="8" y1="50" x2="52" y2="50"/>
  <line x1="8" y1="50" x2="8" y2="10"/>
  <polyline points="12,40 18,28 24,32 30,18 36,24 42,15 48,22"/>
  <circle cx="12" cy="40" r="1.5" fill="currentColor"/>
  <circle cx="18" cy="28" r="1.5" fill="currentColor"/>
  <circle cx="24" cy="32" r="1.5" fill="currentColor"/>
  <circle cx="30" cy="18" r="1.5" fill="currentColor"/>
  <circle cx="36" cy="24" r="1.5" fill="currentColor"/>
  <circle cx="42" cy="15" r="1.5" fill="currentColor"/>
  <circle cx="48" cy="22" r="1.5" fill="currentColor"/>
</svg>`;

const SPEC_CLOCK = `<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
  <circle cx="30" cy="30" r="22"/>
  <line x1="30" y1="10" x2="30" y2="13"/>
  <line x1="30" y1="47" x2="30" y2="50"/>
  <line x1="10" y1="30" x2="13" y2="30"/>
  <line x1="47" y1="30" x2="50" y2="30"/>
  <line x1="30" y1="30" x2="30" y2="18"/>
  <line x1="30" y1="30" x2="40" y2="36"/>
  <circle cx="30" cy="30" r="1.5" fill="currentColor"/>
</svg>`;

const SPEC_DIAGRAM = `<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" aria-hidden="true">
  <rect x="6" y="22" width="14" height="16"/>
  <rect x="40" y="8" width="14" height="14"/>
  <rect x="40" y="38" width="14" height="14"/>
  <line x1="20" y1="26" x2="40" y2="14"/>
  <polyline points="36,12 40,15 36,18"/>
  <line x1="20" y1="34" x2="40" y2="46"/>
  <polyline points="36,42 40,45 36,48"/>
</svg>`;

const SPEC_CALENDAR = `<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" aria-hidden="true">
  <rect x="8" y="12" width="44" height="40"/>
  <line x1="8" y1="22" x2="52" y2="22"/>
  <line x1="19" y1="12" x2="19" y2="8"/>
  <line x1="41" y1="12" x2="41" y2="8"/>
  <line x1="19" y1="32" x2="52" y2="32"/>
  <line x1="19" y1="42" x2="52" y2="42"/>
  <line x1="19" y1="22" x2="19" y2="52"/>
  <line x1="30" y1="22" x2="30" y2="52"/>
  <line x1="41" y1="22" x2="41" y2="52"/>
  <rect x="22" y="35" width="6" height="4" fill="currentColor"/>
</svg>`;

const SPEC_MAP = `<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M8 20 Q 14 14, 22 18 T 38 16 Q 48 14, 52 22 L 50 42 Q 44 48, 36 44 T 18 46 Q 10 44, 8 38 Z"/>
  <circle cx="32" cy="28" r="3"/>
  <line x1="32" y1="31" x2="32" y2="38"/>
  <path d="M28 28 Q 28 22, 32 22 Q 36 22, 36 28" />
</svg>`;

const SPEC_SLIDES = `<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" aria-hidden="true">
  <rect x="14" y="10" width="38" height="22"/>
  <line x1="20" y1="18" x2="38" y2="18"/>
  <line x1="20" y1="24" x2="46" y2="24"/>
  <rect x="10" y="16" width="38" height="22" fill="#f4ede0"/>
  <rect x="10" y="16" width="38" height="22"/>
  <line x1="16" y1="24" x2="34" y2="24"/>
  <line x1="16" y1="30" x2="42" y2="30"/>
  <rect x="6" y="22" width="38" height="22" fill="#f4ede0"/>
  <rect x="6" y="22" width="38" height="22"/>
  <line x1="12" y1="30" x2="30" y2="30"/>
  <line x1="12" y1="36" x2="38" y2="36"/>
</svg>`;

interface Specimen { svg: string; label: string; fig: string; }
const SPECIMENS: Specimen[] = [
  { svg: SPEC_DASHBOARD, label: "DASHBOARD", fig: "I" },
  { svg: SPEC_BARCHART,  label: "BAR CHART", fig: "II" },
  { svg: SPEC_PIE,       label: "DIVISION",  fig: "III" },
  { svg: SPEC_LINE,      label: "TIME SERIES", fig: "IV" },
  { svg: SPEC_CLOCK,     label: "INSTRUMENT", fig: "V" },
  { svg: SPEC_DIAGRAM,   label: "FLOW", fig: "VI" },
  { svg: SPEC_CALENDAR,  label: "REGISTER", fig: "VII" },
  { svg: SPEC_MAP,       label: "GAZETTEER", fig: "VIII" },
  { svg: SPEC_SLIDES,    label: "DECK", fig: "IX" },
];

export function renderLanding(): string {
  const cursorLink = buildCursorDeepLink();
  const vscodeLink = buildVSCodeDeepLink(false);
  const vscodeInsidersLink = buildVSCodeDeepLink(true);

  const specimens = SPECIMENS.map((s, i) => `
    <figure class="spec" style="--i:${i}">
      <div class="spec__art">${s.svg}</div>
      <figcaption class="spec__cap">
        <span class="spec__fig">FIG. ${s.fig}</span>
        <span class="spec__lbl">${s.label}</span>
      </figcaption>
    </figure>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Supacanvas — A specimen catalog of everything your AI tools build</title>
  <meta name="description" content="The workspace for every dashboard, mockup, and diagram your AI tools build. Captured, searchable, exportable, yours forever. Works with Claude, Cursor, and any AI tool that speaks MCP.">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Supacanvas — A specimen catalog">
  <meta property="og:description" content="The workspace for everything your AI tools build.">
  <meta property="og:url" content="https://supacanvas.com">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400;1,9..144,500&family=General+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">

  <style>
    /* ============================================================ DESIGN SYSTEM */
    :root {
      --paper: #f4ede0;
      --paper-tint: #ede4d0;
      --paper-deep: #e3d8be;
      --ink: #1a1614;
      --ink-soft: #3b352d;
      --ink-faint: #6a604c;
      --rule: #d2c5a6;
      --rule-strong: #b9aa86;
      --accent: #a8352d;
      --accent-deep: #7d2520;
      --accent-soft: rgba(168, 53, 45, 0.08);
      --gold: #b08749;
      --easing: cubic-bezier(0.2, 0.8, 0.2, 1);

      --display: 'Fraunces', 'Times New Roman', Georgia, serif;
      --sans: 'General Sans', -apple-system, BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif;
      --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    }

    /* ============================================================ RESET / BASE */
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 16px;
      line-height: 1.55;
      font-feature-settings: "ss01" on, "ss02" on, "tnum" on;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      min-height: 100vh;
      position: relative;
      overflow-x: hidden;
    }
    /* Subtle paper grain — SVG noise, embedded as data URI */
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
      opacity: 0.045;
      mix-blend-mode: multiply;
    }
    a { color: inherit; text-decoration: none; }
    button { font-family: inherit; cursor: pointer; }

    /* ============================================================ LAYOUT */
    .page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 40px 56px;
      position: relative;
      z-index: 2;
    }

    /* ============================================================ MASTHEAD (newspaper top) */
    .masthead {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 24px;
      align-items: center;
      padding: 4px 0 16px;
      border-bottom: 1px solid var(--ink);
      border-image: linear-gradient(to right, transparent, var(--ink) 6%, var(--ink) 94%, transparent) 1;
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .masthead__col { display: flex; gap: 18px; align-items: center; }
    .masthead__col--end { justify-content: flex-end; }
    .masthead__center {
      font-family: var(--display);
      font-style: italic;
      font-size: 15px;
      letter-spacing: 0.06em;
      text-transform: none;
      color: var(--ink);
      white-space: nowrap;
    }
    .masthead__sep::after {
      content: "·";
      margin-left: 18px;
      color: var(--rule-strong);
    }

    /* ============================================================ ORNAMENTAL RULES */
    .rule {
      display: flex;
      align-items: center;
      gap: 24px;
      margin: 80px 0;
    }
    .rule::before, .rule::after {
      content: "";
      flex: 1;
      border-top: 1px solid var(--ink);
    }
    .rule__mark {
      font-family: var(--display);
      font-style: italic;
      color: var(--accent);
      font-size: 18px;
      letter-spacing: 0.4em;
      padding-left: 0.4em;
    }

    /* ============================================================ HERO */
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.18fr) minmax(0, 1fr);
      gap: 56px;
      padding-top: 64px;
      padding-bottom: 24px;
    }

    .plate-tag {
      display: inline-flex;
      align-items: baseline;
      gap: 10px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 500;
      margin-bottom: 28px;
    }
    .plate-tag::before {
      content: "";
      width: 36px;
      height: 1px;
      background: var(--accent);
      align-self: center;
    }
    .plate-tag__sep { color: var(--ink-faint); font-weight: 400; letter-spacing: 0.16em; }

    .wordmark {
      font-family: var(--display);
      font-weight: 300;
      font-size: clamp(80px, 13vw, 196px);
      line-height: 0.84;
      letter-spacing: -0.04em;
      margin: 0 0 22px;
      color: var(--ink);
      font-feature-settings: "ss01" on, "ss02" on;
      font-optical-sizing: auto;
    }
    .wordmark__supa { font-style: normal; }
    .wordmark__canvas {
      font-style: italic;
      color: var(--accent);
      font-weight: 400;
      letter-spacing: -0.05em;
    }

    .ornament-row {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--accent);
      font-family: var(--display);
      font-style: italic;
      font-size: 14px;
      letter-spacing: 0.4em;
      margin-bottom: 22px;
    }
    .ornament-row::before, .ornament-row::after {
      content: "";
      width: 28px;
      height: 1px;
      background: var(--accent);
      opacity: 0.6;
    }

    .tagline {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: clamp(24px, 3vw, 32px);
      line-height: 1.18;
      letter-spacing: -0.015em;
      color: var(--ink);
      margin: 0 0 18px;
      max-width: 17ch;
    }

    .abstract {
      font-size: 16px;
      line-height: 1.65;
      color: var(--ink-soft);
      margin: 0 0 36px;
      max-width: 56ch;
    }
    .abstract::first-letter {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 3.2em;
      float: left;
      line-height: 0.84;
      padding: 4px 8px 0 0;
      color: var(--accent);
    }

    /* === Provenance tag (the install command) === */
    .provenance {
      border: 1px solid var(--ink);
      background: var(--paper-tint);
      padding: 0;
      margin: 0 0 28px;
      max-width: 540px;
      box-shadow: 4px 4px 0 var(--ink);
      transition: box-shadow 220ms var(--easing), transform 220ms var(--easing);
    }
    .provenance:hover {
      box-shadow: 6px 6px 0 var(--accent);
      transform: translate(-2px, -2px);
    }
    .provenance__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      border-bottom: 1px solid var(--ink);
      background: var(--ink);
      color: var(--paper);
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .provenance__head em {
      font-style: italic;
      color: var(--paper);
      letter-spacing: 0.04em;
      text-transform: none;
      font-family: var(--display);
      font-size: 13px;
    }
    .provenance__body {
      display: flex;
      align-items: stretch;
      background: var(--paper);
    }
    .provenance__cmd {
      flex: 1;
      padding: 16px 18px;
      font-family: var(--mono);
      font-size: 14px;
      color: var(--ink);
      letter-spacing: 0.02em;
      white-space: pre;
      overflow-x: auto;
    }
    .provenance__cmd::before {
      content: "$ ";
      color: var(--accent);
      font-weight: 500;
    }
    .provenance__btn {
      flex-shrink: 0;
      padding: 0 22px;
      background: var(--paper);
      color: var(--ink);
      border: 0;
      border-left: 1px solid var(--ink);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-weight: 500;
      transition: background 160ms var(--easing), color 160ms var(--easing);
    }
    .provenance__btn:hover { background: var(--ink); color: var(--paper); }
    .provenance__btn[data-copied="1"] { background: var(--accent); color: var(--paper); }
    .provenance__btn[data-copied="1"]::before { content: "✓ "; }

    .cataloged {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 14px;
      margin-bottom: 32px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .cataloged__head {
      color: var(--accent);
      font-weight: 500;
    }
    .cataloged__head::after {
      content: "·";
      margin-left: 14px;
      opacity: 0.5;
    }
    .cataloged__item {
      position: relative;
      padding-right: 14px;
    }
    .cataloged__item:not(:last-child)::after {
      content: "·";
      position: absolute;
      right: 2px;
      opacity: 0.5;
    }

    .lookups {
      display: flex;
      gap: 28px;
      flex-wrap: wrap;
      font-family: var(--display);
      font-style: italic;
      font-size: 18px;
    }
    .lookups a {
      color: var(--ink);
      transition: color 160ms var(--easing), letter-spacing 240ms var(--easing);
      letter-spacing: 0;
    }
    .lookups a::before {
      content: "→ ";
      color: var(--accent);
      font-style: normal;
      transition: margin-right 240ms var(--easing);
    }
    .lookups a:hover { color: var(--accent); }
    .lookups a:hover::before { margin-right: 4px; }

    /* === Specimen grid (right side of hero) === */
    .specimens {
      align-self: start;
      position: relative;
    }
    .specimens__head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-bottom: 12px;
      margin-bottom: 0;
      border-bottom: 2px solid var(--ink);
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .specimens__head em {
      font-family: var(--display);
      font-style: italic;
      font-size: 13px;
      text-transform: none;
      letter-spacing: 0.02em;
      color: var(--ink);
    }
    .specimens__grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border-left: 1px solid var(--rule-strong);
      border-top: 1px solid var(--rule-strong);
      background: var(--paper-tint);
    }
    .spec {
      margin: 0;
      padding: 18px 14px 12px;
      border-right: 1px solid var(--rule-strong);
      border-bottom: 1px solid var(--rule-strong);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      transition: background 180ms var(--easing), transform 180ms var(--easing);
      animation: specFadeIn 600ms var(--easing) backwards;
      animation-delay: calc(280ms + var(--i) * 60ms);
    }
    .spec:hover {
      background: var(--paper);
      transform: scale(1.02);
    }
    .spec:hover .spec__art { color: var(--accent); }
    .spec__art {
      width: 64px;
      height: 64px;
      color: var(--ink);
      transition: color 200ms var(--easing);
    }
    .spec__art svg { width: 100%; height: 100%; }
    .spec__cap {
      text-align: center;
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      line-height: 1.4;
    }
    .spec__fig {
      display: block;
      color: var(--accent);
      font-weight: 500;
    }
    .spec__lbl {
      display: block;
      color: var(--ink-faint);
      letter-spacing: 0.18em;
    }
    .specimens__foot {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-top: 12px;
      border-top: 1px solid var(--ink);
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin-top: 0;
    }
    .specimens__foot em {
      font-family: var(--display);
      font-style: italic;
      font-size: 11px;
      text-transform: none;
      letter-spacing: 0;
      color: var(--accent);
    }

    @keyframes specFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Hero load-in stagger */
    .hero__title-card > * { animation: fadeUp 700ms var(--easing) backwards; }
    .hero__title-card > *:nth-child(1) { animation-delay: 0ms; }
    .hero__title-card > *:nth-child(2) { animation-delay: 60ms; }
    .hero__title-card > *:nth-child(3) { animation-delay: 120ms; }
    .hero__title-card > *:nth-child(4) { animation-delay: 180ms; }
    .hero__title-card > *:nth-child(5) { animation-delay: 240ms; }
    .hero__title-card > *:nth-child(6) { animation-delay: 300ms; }
    .hero__title-card > *:nth-child(7) { animation-delay: 360ms; }
    .hero__title-card > *:nth-child(8) { animation-delay: 420ms; }
    .specimens__head, .specimens__foot { animation: fadeUp 700ms var(--easing) backwards; animation-delay: 200ms; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ============================================================ SECTION HEADS */
    .section-head {
      display: grid;
      grid-template-columns: minmax(180px, 280px) 1fr;
      gap: 48px;
      padding-bottom: 44px;
      align-items: end;
    }
    .section-head__plate {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 500;
      padding-top: 8px;
      border-top: 2px solid var(--accent);
      max-width: max-content;
    }
    .section-head__main {
      max-width: 720px;
    }
    .section-head__title {
      font-family: var(--display);
      font-weight: 300;
      font-style: normal;
      font-size: clamp(40px, 5.6vw, 72px);
      line-height: 1;
      letter-spacing: -0.025em;
      margin: 0 0 14px;
      color: var(--ink);
    }
    .section-head__title em { font-style: italic; color: var(--accent); font-weight: 400; }
    .section-head__lede {
      font-family: var(--display);
      font-style: italic;
      font-size: 19px;
      line-height: 1.45;
      color: var(--ink-soft);
      margin: 0;
      max-width: 56ch;
    }

    /* ============================================================ MOVEMENTS (How it works) */
    .movements {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0;
      border-top: 1px solid var(--ink);
      border-left: 1px solid var(--ink);
    }
    .movement {
      padding: 32px 28px 32px;
      border-right: 1px solid var(--ink);
      border-bottom: 1px solid var(--ink);
      background: var(--paper-tint);
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      transition: background 200ms var(--easing);
    }
    .movement:hover { background: var(--paper); }
    .movement__roman {
      font-family: var(--display);
      font-style: italic;
      font-weight: 300;
      font-size: 88px;
      line-height: 0.85;
      color: var(--accent);
      letter-spacing: -0.04em;
      margin-bottom: 4px;
    }
    .movement__title {
      font-family: var(--display);
      font-style: italic;
      font-weight: 400;
      font-size: 26px;
      line-height: 1.15;
      letter-spacing: -0.015em;
      color: var(--ink);
      margin: 0;
    }
    .movement__body {
      font-size: 14.5px;
      color: var(--ink-soft);
      line-height: 1.55;
      margin: 0;
      flex: 1;
    }
    .movement__body code {
      font-family: var(--mono);
      font-size: 12.5px;
      background: var(--paper);
      padding: 1px 5px;
      border: 1px solid var(--rule);
      border-radius: 2px;
    }

    /* === Inline mini-copybox (used inside movements) === */
    .mini-copybox {
      display: flex;
      align-items: stretch;
      background: var(--ink);
      color: var(--paper);
      font-family: var(--mono);
      font-size: 12px;
      overflow: hidden;
    }
    .mini-copybox__cmd {
      flex: 1;
      padding: 12px 14px;
      letter-spacing: 0.02em;
      white-space: pre;
      overflow-x: auto;
    }
    .mini-copybox__cmd::before { content: "$ "; opacity: 0.55; }
    .mini-copybox__btn {
      flex-shrink: 0;
      padding: 0 14px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--paper);
      border: 0;
      border-left: 1px solid rgba(255, 255, 255, 0.12);
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      transition: background 160ms var(--easing);
    }
    .mini-copybox__btn:hover { background: var(--accent); }
    .mini-copybox__btn[data-copied="1"] { background: var(--accent); }
    .mini-copybox__btn[data-copied="1"]::before { content: "✓ "; }

    .movement__jump {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--accent);
      align-self: flex-start;
      margin-top: auto;
      padding: 10px 16px;
      border: 1px solid var(--accent);
      background: transparent;
      transition: background 160ms var(--easing), color 160ms var(--easing);
    }
    .movement__jump:hover { background: var(--accent); color: var(--paper); }
    .movement__jump::after {
      content: "↓";
      transition: transform 200ms var(--easing);
    }
    .movement__jump:hover::after { transform: translateY(3px); }

    /* ============================================================ PLATE III — Connect to AI */
    .featured-plates {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 18px;
      margin-bottom: 18px;
    }
    .plate {
      position: relative;
      background: var(--paper-tint);
      border: 1px solid var(--ink);
      padding: 28px 30px 30px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: transform 220ms var(--easing), box-shadow 220ms var(--easing);
    }
    .plate--featured {
      box-shadow: 4px 4px 0 var(--ink);
    }
    .plate--featured:hover {
      transform: translate(-3px, -3px);
      box-shadow: 7px 7px 0 var(--accent);
    }
    .plate__head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--rule-strong);
    }
    .plate__no {
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.18em;
      color: var(--ink-faint);
      text-transform: uppercase;
      font-weight: 500;
    }
    .plate__method {
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      padding: 4px 10px;
      border: 1px solid var(--rule-strong);
      color: var(--ink-faint);
      font-weight: 500;
      background: var(--paper);
    }
    .plate__method--stamp {
      background: var(--accent);
      color: var(--paper);
      border-color: var(--accent);
      letter-spacing: 0.22em;
      transform: rotate(-2deg);
      box-shadow: 1px 1px 0 var(--ink);
    }
    .plate__name {
      font-family: var(--display);
      font-weight: 300;
      font-style: normal;
      font-size: 44px;
      line-height: 0.95;
      letter-spacing: -0.025em;
      margin: 0;
      color: var(--ink);
    }
    .plate__name em { font-style: italic; color: var(--accent); font-weight: 400; }
    .plate__hint {
      font-size: 14px;
      line-height: 1.5;
      color: var(--ink-soft);
      margin: 0;
    }
    .plate__hint code {
      font-family: var(--mono);
      font-size: 12px;
      background: var(--paper);
      padding: 1px 5px;
      border: 1px solid var(--rule);
    }

    /* CTA — stamped, inviting, distinct */
    .cta {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      align-self: flex-start;
      padding: 14px 22px;
      background: var(--ink);
      color: var(--paper);
      font-family: var(--mono);
      font-size: 13px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 500;
      border: 1px solid var(--ink);
      border-radius: 0;
      box-shadow: 3px 3px 0 var(--accent);
      transition: transform 200ms var(--easing), box-shadow 200ms var(--easing), background 200ms var(--easing);
    }
    .cta:hover {
      background: var(--accent);
      transform: translate(-2px, -2px);
      box-shadow: 5px 5px 0 var(--ink);
    }
    .cta__arrow { transition: transform 240ms var(--easing); display: inline-block; }
    .cta:hover .cta__arrow { transform: translateX(4px); }

    .cta-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .cta-alt {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-soft);
      border: 1px solid var(--rule-strong);
      background: var(--paper);
      transition: border-color 160ms var(--easing), color 160ms var(--easing);
    }
    .cta-alt:hover { border-color: var(--accent); color: var(--accent); }

    /* Secondary plates (Claude Code, Claude Desktop, Continue, Universal) */
    .secondary-plates {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }
    .plate--secondary {
      background: var(--paper);
      box-shadow: none;
    }
    .plate--secondary:hover {
      transform: translateY(-2px);
      box-shadow: 4px 4px 0 var(--rule-strong);
    }
    .plate--secondary .plate__name {
      font-size: 30px;
    }
    .plate--secondary .plate__head { padding-bottom: 12px; }

    /* === Code snippet block === */
    .snippet {
      position: relative;
      background: var(--ink);
      color: var(--paper);
      overflow: hidden;
      font-family: var(--mono);
    }
    .snippet pre {
      margin: 0;
      padding: 16px 76px 16px 18px;
      font-size: 12px;
      line-height: 1.55;
      overflow-x: auto;
      white-space: pre;
      color: var(--paper);
    }
    .snippet__btn {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 5px 11px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--paper);
      border: 1px solid rgba(255, 255, 255, 0.18);
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      transition: background 160ms var(--easing), border-color 160ms var(--easing);
    }
    .snippet__btn:hover { background: var(--accent); border-color: var(--accent); }
    .snippet__btn[data-copied="1"] { background: var(--accent); border-color: var(--accent); }
    .snippet__btn[data-copied="1"]::before { content: "✓ "; }

    /* ============================================================ PLATE IV — Demonstration */
    .demonstration {
      background: var(--paper-tint);
      border-top: 1px solid var(--ink);
      border-bottom: 1px solid var(--ink);
      padding: 64px 56px;
      position: relative;
      overflow: hidden;
    }
    .demonstration::before {
      content: "✦";
      position: absolute;
      top: 18px;
      left: 24px;
      font-family: var(--display);
      font-style: italic;
      font-size: 24px;
      color: var(--accent);
      opacity: 0.5;
    }
    .demonstration::after {
      content: "✦";
      position: absolute;
      bottom: 18px;
      right: 24px;
      font-family: var(--display);
      font-style: italic;
      font-size: 24px;
      color: var(--accent);
      opacity: 0.5;
    }
    .demonstration__instruction {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 24px;
      text-align: center;
    }
    .demonstration__quote {
      font-family: var(--display);
      font-style: italic;
      font-weight: 300;
      font-size: clamp(28px, 4.4vw, 56px);
      line-height: 1.18;
      letter-spacing: -0.02em;
      color: var(--ink);
      margin: 0 auto 40px;
      max-width: 22ch;
      text-align: center;
      position: relative;
    }
    .demonstration__quote::before {
      content: "“";
      color: var(--accent);
      font-weight: 400;
    }
    .demonstration__quote::after {
      content: "”";
      color: var(--accent);
      font-weight: 400;
    }
    .demonstration__caption {
      font-size: 14.5px;
      line-height: 1.6;
      color: var(--ink-soft);
      max-width: 64ch;
      margin: 0 auto;
      text-align: center;
    }
    .demonstration__caption code {
      font-family: var(--mono);
      font-size: 12.5px;
      background: var(--paper);
      padding: 2px 7px;
      border: 1px solid var(--rule);
    }

    /* ============================================================ COLOPHON (footer) */
    .colophon {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 32px;
      align-items: end;
      padding-top: 56px;
      margin-top: 80px;
      border-top: 2px double var(--ink);
      font-family: var(--mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-faint);
      line-height: 1.85;
    }
    .colophon em {
      font-family: var(--display);
      font-style: italic;
      font-size: 13px;
      text-transform: none;
      letter-spacing: 0.02em;
      color: var(--ink);
    }
    .colophon__links {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .colophon__links a {
      color: var(--ink-soft);
      transition: color 160ms var(--easing);
      border-bottom: 1px solid transparent;
      padding-bottom: 1px;
    }
    .colophon__links a:hover { color: var(--accent); border-bottom-color: var(--accent); }

    /* ============================================================ RESPONSIVE */
    @media (max-width: 980px) {
      .hero { grid-template-columns: 1fr; gap: 48px; padding-top: 32px; }
      .specimens__grid { grid-template-columns: repeat(3, 1fr); }
      .section-head { grid-template-columns: 1fr; gap: 16px; padding-bottom: 32px; }
      .movements { grid-template-columns: 1fr; }
      .featured-plates { grid-template-columns: 1fr; }
      .secondary-plates { grid-template-columns: 1fr 1fr; }
      .colophon { grid-template-columns: 1fr; }
      .colophon__links { justify-content: flex-start; }
      .demonstration { padding: 48px 28px; }
    }
    @media (max-width: 640px) {
      .page { padding: 20px 22px 40px; }
      .masthead { font-size: 9px; }
      .masthead__center { font-size: 13px; }
      .secondary-plates { grid-template-columns: 1fr; }
      .specimens__grid { grid-template-columns: repeat(3, 1fr); }
      .spec__art { width: 48px; height: 48px; }
      .movement__roman { font-size: 64px; }
      .plate { padding: 22px 22px 24px; }
      .plate__name { font-size: 32px; }
      .plate--secondary .plate__name { font-size: 24px; }
      .demonstration { padding: 36px 20px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0ms !important;
        transition-duration: 0ms !important;
      }
    }
  </style>
</head>
<body>
  <main class="page">

    <header class="masthead">
      <div class="masthead__col">
        <span>Vol. I</span>
        <span class="masthead__sep">№ 0001</span>
        <span>Anno MMXXVI</span>
      </div>
      <div class="masthead__center">Supacanvas <em>— a specimen catalog —</em></div>
      <div class="masthead__col masthead__col--end">
        <span>Edition 0.8.0</span>
        <span class="masthead__sep">MIT</span>
      </div>
    </header>

    <section class="hero">
      <div class="hero__title-card">
        <div class="plate-tag">
          <span>Plate №&nbsp;I</span>
          <span class="plate-tag__sep">—</span>
          <span>The specimen</span>
        </div>

        <h1 class="wordmark">
          <span class="wordmark__supa">Supa</span><span class="wordmark__canvas">canvas</span>
        </h1>

        <div class="ornament-row">✦ ✦ ✦</div>

        <p class="tagline">A workspace for everything your AI tools build.</p>

        <p class="abstract">Every dashboard, mockup, diagram, status board, and prototype your agents create — captured the moment it appears, searchable across every chat, exportable anywhere, yours forever. Works with Claude, Cursor, Claude Desktop, and any AI tool that speaks the Model Context Protocol.</p>

        <div class="provenance">
          <div class="provenance__head">
            <span>Provenance · npm registry</span>
            <em>cataloged 2026</em>
          </div>
          <div class="provenance__body">
            <span class="provenance__cmd">${INSTALL_CMD}</span>
            <button class="provenance__btn" data-copy="${INSTALL_CMD}" type="button">Copy</button>
          </div>
        </div>

        <div class="cataloged">
          <span class="cataloged__head">Cataloged under</span>
          <span class="cataloged__item">No accounts</span>
          <span class="cataloged__item">No telemetry</span>
          <span class="cataloged__item">Files on disk</span>
          <span class="cataloged__item">MIT</span>
        </div>

        <div class="lookups">
          <a href="https://github.com/Bhaulik/supacanvas">GitHub</a>
          <a href="https://www.npmjs.com/package/supacanvas">npm</a>
          <a href="https://github.com/Bhaulik/supacanvas#readme">Documentation</a>
        </div>
      </div>

      <aside class="specimens" aria-label="Specimen index">
        <div class="specimens__head">
          <span>Index of types</span>
          <em>nine specimens, page 01</em>
        </div>
        <div class="specimens__grid">
          ${specimens}
        </div>
        <div class="specimens__foot">
          <span>What your AI builds</span>
          <em>+ anything else with HTML</em>
        </div>
      </aside>
    </section>

    <hr class="rule" aria-hidden="true"><div class="rule__mark" style="text-align:center; margin: -64px 0 64px;">✦ ✦ ✦</div>

    <section>
      <header class="section-head">
        <span class="section-head__plate">Plate №&nbsp;II — Method</span>
        <div class="section-head__main">
          <h2 class="section-head__title">A method, in <em>three movements</em>.</h2>
          <p class="section-head__lede">No accounts. No installer wizard. No setup flow that pretends to be friendly. Just three commands — one of which you'll only run once.</p>
        </div>
      </header>

      <ol class="movements">
        <li class="movement">
          <div class="movement__roman">I.</div>
          <h3 class="movement__title">Install the binary.</h3>
          <p class="movement__body">One command. The <code>supacanvas</code> CLI lands on your <code>PATH</code>. Works on Node ≥ 18 — no other runtime required.</p>
          <div class="mini-copybox">
            <span class="mini-copybox__cmd">${INSTALL_CMD}</span>
            <button class="mini-copybox__btn" data-copy="${INSTALL_CMD}" type="button">Copy</button>
          </div>
        </li>

        <li class="movement">
          <div class="movement__roman">II.</div>
          <h3 class="movement__title">Wire it into your AI.</h3>
          <p class="movement__body">One click for Cursor or VS Code. One command for Claude Code. Copy-paste for everything else. Most people add two or three.</p>
          <a href="#connect" class="movement__jump">Pick a connector</a>
        </li>

        <li class="movement">
          <div class="movement__roman">III.</div>
          <h3 class="movement__title">Run the viewer; ask your AI.</h3>
          <p class="movement__body">A separate terminal hosts the gallery. Your agent sends URLs, you open them, you keep working.</p>
          <div class="mini-copybox">
            <span class="mini-copybox__cmd">${SERVE_CMD}</span>
            <button class="mini-copybox__btn" data-copy="${SERVE_CMD}" type="button">Copy</button>
          </div>
        </li>
      </ol>
    </section>

    <hr class="rule" aria-hidden="true"><div class="rule__mark" style="text-align:center; margin: -64px 0 64px;">✦ ✦ ✦</div>

    <section id="connect">
      <header class="section-head">
        <span class="section-head__plate">Plate №&nbsp;III — Connectors</span>
        <div class="section-head__main">
          <h2 class="section-head__title">Wire it into your <em>AI tool</em>.</h2>
          <p class="section-head__lede">Six clients, three methods. The featured pair below get one-click installers. The rest — copy-and-paste, and you'll thank yourself in two minutes.</p>
        </div>
      </header>

      <div class="featured-plates">
        <article class="plate plate--featured">
          <div class="plate__head">
            <span class="plate__no">№ III.01</span>
            <span class="plate__method plate__method--stamp">One click</span>
          </div>
          <h3 class="plate__name"><em>Cursor</em></h3>
          <p class="plate__hint">Click the stamp below. Cursor opens, asks you to confirm, and writes the MCP entry for you. No file editing on your end.</p>
          <a class="cta" href="${cursorLink}">+ Add to Cursor <span class="cta__arrow">→</span></a>
        </article>

        <article class="plate plate--featured">
          <div class="plate__head">
            <span class="plate__no">№ III.02</span>
            <span class="plate__method plate__method--stamp">One click</span>
          </div>
          <h3 class="plate__name"><em>VS Code</em></h3>
          <p class="plate__hint">Requires VS Code with MCP support enabled (Copilot Chat or compatible extension). Insiders builds work too.</p>
          <div class="cta-row">
            <a class="cta" href="${vscodeLink}">+ Add to VS Code <span class="cta__arrow">→</span></a>
            <a class="cta-alt" href="${vscodeInsidersLink}">Insiders ↗</a>
          </div>
        </article>
      </div>

      <div class="secondary-plates">
        <article class="plate plate--secondary">
          <div class="plate__head">
            <span class="plate__no">№ III.03</span>
            <span class="plate__method">One command</span>
          </div>
          <h3 class="plate__name">Claude Code</h3>
          <p class="plate__hint">Run in your terminal. Claude Code's CLI registers supacanvas globally.</p>
          <div class="snippet">
            <pre>${escapeForHtml(CLAUDE_CODE_CMD)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(CLAUDE_CODE_CMD)}" type="button">Copy</button>
          </div>
        </article>

        <article class="plate plate--secondary">
          <div class="plate__head">
            <span class="plate__no">№ III.04</span>
            <span class="plate__method">Manual JSON</span>
          </div>
          <h3 class="plate__name">Claude Desktop</h3>
          <p class="plate__hint">Edit <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) and merge in:</p>
          <div class="snippet">
            <pre>${escapeForHtml(CLAUDE_DESKTOP_JSON)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(CLAUDE_DESKTOP_JSON)}" type="button">Copy</button>
          </div>
        </article>

        <article class="plate plate--secondary">
          <div class="plate__head">
            <span class="plate__no">№ III.05</span>
            <span class="plate__method">Manual YAML</span>
          </div>
          <h3 class="plate__name">Continue</h3>
          <p class="plate__hint">Add to <code>~/.continue/config.yaml</code>:</p>
          <div class="snippet">
            <pre>${escapeForHtml(CONTINUE_YAML)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(CONTINUE_YAML)}" type="button">Copy</button>
          </div>
        </article>

        <article class="plate plate--secondary">
          <div class="plate__head">
            <span class="plate__no">№ III.06</span>
            <span class="plate__method">Universal</span>
          </div>
          <h3 class="plate__name">Anything else MCP</h3>
          <p class="plate__hint">ChatGPT (when its MCP preview ships), Cline, Aider — drop this into the client's <code>mcpServers</code> map:</p>
          <div class="snippet">
            <pre>${escapeForHtml(UNIVERSAL_JSON)}</pre>
            <button class="snippet__btn" data-copy="${escapeForAttr(UNIVERSAL_JSON)}" type="button">Copy</button>
          </div>
        </article>
      </div>
    </section>

    <hr class="rule" aria-hidden="true"><div class="rule__mark" style="text-align:center; margin: -64px 0 64px;">✦ ✦ ✦</div>

    <section>
      <header class="section-head">
        <span class="section-head__plate">Plate №&nbsp;IV — Demonstration</span>
        <div class="section-head__main">
          <h2 class="section-head__title">Once you're <em>set up</em>.</h2>
          <p class="section-head__lede">Send your AI a request like the one below — verbatim if you want. The wire-up does the rest.</p>
        </div>
      </header>

      <div class="demonstration">
        <div class="demonstration__instruction">— Ask your agent —</div>
        <p class="demonstration__quote">create a canvas with a working analog clock and screenshot it back to me</p>
        <p class="demonstration__caption">Your AI calls <code>canvas_create</code> + <code>canvas_screenshot</code>. The PNG renders inline in chat. The canvas lives at <code>~/.supacanvas/canvases/</code> as plain HTML / CSS / JS files. Browse the gallery any time at <code>localhost:7777</code>.</p>
      </div>
    </section>

    <footer class="colophon">
      <div>
        Set in <em>Fraunces</em>, <em>General Sans</em>, and <em>JetBrains&nbsp;Mono</em>.<br>
        Pressed at the edge — Cloudflare Workers · KV · R2.<br>
        Edition 0.8.0 · MIT · Anno MMXXVI · No telemetry, ever.
      </div>
      <div class="colophon__links">
        <a href="https://github.com/Bhaulik/supacanvas">GitHub</a>
        <a href="https://www.npmjs.com/package/supacanvas">npm</a>
        <a href="https://github.com/Bhaulik/supacanvas#readme">Docs</a>
        <a href="https://github.com/Bhaulik/supacanvas/blob/main/AGENTS.md">AGENTS.md</a>
      </div>
    </footer>

  </main>

  <script>
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-copy') || '';
        try {
          await navigator.clipboard.writeText(text);
        } catch (_) {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (__) {}
          document.body.removeChild(ta);
        }
        btn.dataset.copied = '1';
        const originalLabel = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => {
          delete btn.dataset.copied;
          btn.textContent = originalLabel;
        }, 1400);
      });
    });
  </script>
</body>
</html>`;
}

// Escape HTML text content (between tags) — for code blocks visible in <pre>
function escapeForHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Escape values that go inside HTML attributes (data-copy="...")
function escapeForAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderGone(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Revoked · Supacanvas</title>
  <style>
    body {
      font-family: -apple-system, system-ui, sans-serif;
      background: #f5f0e6;
      color: #1a1614;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 40px;
      text-align: center;
    }
    h1 { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 400; font-size: 48px; margin: 0 0 12px; color: #a8352d; }
    p { color: #6a604c; max-width: 40ch; }
    a { color: #a8352d; }
  </style>
</head>
<body>
  <h1>410 — Gone</h1>
  <p>This shared canvas was revoked by its creator. Visit <a href="https://supacanvas.com">supacanvas.com</a> to learn more.</p>
</body>
</html>`;
}

export function renderNotFound(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Not found · Supacanvas</title>
  <style>
    body {
      font-family: -apple-system, system-ui, sans-serif;
      background: #f5f0e6;
      color: #1a1614;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 40px;
      text-align: center;
    }
    h1 { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 400; font-size: 48px; margin: 0 0 12px; }
    p { color: #6a604c; max-width: 40ch; }
    a { color: #a8352d; }
  </style>
</head>
<body>
  <h1>404</h1>
  <p>No canvas found at this URL. It may have been revoked, or the link may be incorrect. Visit <a href="https://supacanvas.com">supacanvas.com</a>.</p>
</body>
</html>`;
}
