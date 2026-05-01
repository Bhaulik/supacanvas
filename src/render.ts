import type { Plate } from "./types.ts";
import { getThemeCSS } from "./storage.ts";

function escapeForScript(s: string): string {
  return s.replace(/<\/script/gi, "<\\/script");
}

/**
 * Build the full HTML document that runs inside the sandboxed iframe.
 * Theme CSS is prepended so plate CSS can override it.
 *
 * Note on safety: the iframe is rendered with sandbox="allow-scripts" but NOT
 * allow-same-origin. That keeps untrusted JS from touching cookies, localStorage,
 * or the parent page. We still inline the plate's own JS in a <script> tag.
 */
export async function renderPlateDoc(plate: Plate): Promise<string> {
  const themeCss = await getThemeCSS(plate.meta.theme);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(plate.meta.title)}</title>
<style data-plate-theme="${escapeHtml(plate.meta.theme)}">
${themeCss}
</style>
<style data-plate-style>
${plate.css}
</style>
</head>
<body>
${plate.html}
<script>
${escapeForScript(plate.js)}
</script>
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
