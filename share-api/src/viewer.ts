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

export function renderLanding(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Supacanvas — workspace for everything your AI tools build</title>
  <meta name="description" content="The workspace for every dashboard, mockup, and diagram your AI tools build. Captured, searchable, exportable, yours forever. Works with Claude, Cursor, and any AI tool that speaks MCP.">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Supacanvas">
  <meta property="og:description" content="The workspace for everything your AI tools build.">
  <meta property="og:url" content="https://supacanvas.com">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400;1,9..144,500&family=General+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
  <style>
    :root {
      --paper: #f5f0e6;
      --paper-deep: #ebe2cf;
      --ink: #1a1614;
      --ink-soft: #3b352d;
      --muted: #6a604c;
      --rule: #d8cdb6;
      --accent: #a8352d;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: 'General Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }
    .wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 80px 32px 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      min-height: 100vh;
      justify-content: center;
    }
    .num {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 28px;
    }
    h1 {
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 400;
      font-size: 96px;
      line-height: 0.92;
      letter-spacing: -0.03em;
      margin: 0 0 28px;
      color: var(--ink);
    }
    h1 em {
      font-style: italic;
      color: var(--accent);
    }
    .lede {
      font-family: 'Fraunces', Georgia, serif;
      font-style: italic;
      font-size: 24px;
      line-height: 1.4;
      color: var(--ink-soft);
      margin: 0 0 16px;
      max-width: 32ch;
    }
    .sub {
      font-size: 15px;
      line-height: 1.5;
      color: var(--muted);
      margin: 0 0 36px;
      max-width: 50ch;
    }
    .install {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 14px;
      background: var(--ink);
      color: var(--paper);
      padding: 14px 22px;
      border-radius: 6px;
      margin-bottom: 28px;
      letter-spacing: 0.02em;
    }
    .install::before { content: "$ "; opacity: 0.5; }
    .links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .links a {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ink-soft);
      text-decoration: none;
      padding: 9px 16px;
      border: 1px solid var(--rule);
      border-radius: 4px;
      transition: all 120ms ease;
    }
    .links a:hover {
      background: var(--ink);
      color: var(--paper);
      border-color: var(--ink);
    }
    .foot {
      position: absolute;
      bottom: 24px;
      left: 0; right: 0;
      text-align: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }
    @media (max-width: 600px) {
      h1 { font-size: 64px; }
      .lede { font-size: 20px; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="num">№ 001 · Local-first MCP</div>
    <h1>Supa<em>canvas</em></h1>
    <p class="lede">The workspace for everything your AI tools build.</p>
    <p class="sub">Every dashboard, mockup, and diagram your agents create — captured, searchable, exportable, yours forever. Works with Claude, Cursor, and any AI tool that speaks MCP.</p>
    <div class="install">npm install -g supacanvas</div>
    <div class="links">
      <a href="https://github.com/Bhaulik/supacanvas">GitHub</a>
      <a href="https://www.npmjs.com/package/supacanvas">npm</a>
      <a href="https://github.com/Bhaulik/supacanvas#readme">Docs</a>
    </div>
  </main>
  <div class="foot">No accounts · No telemetry · Files on your machine · MIT</div>
</body>
</html>`;
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
