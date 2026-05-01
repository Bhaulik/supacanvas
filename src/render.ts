import type { Canvas } from "./types.ts";
import { getThemeCSS } from "./storage.ts";

function escapeForScript(s: string): string {
  return s.replace(/<\/script/gi, "<\\/script");
}

/**
 * Build the full HTML document that runs inside the sandboxed iframe.
 * Theme CSS is prepended so canvas CSS can override it.
 *
 * Note on safety: the iframe is rendered with sandbox="allow-scripts" but NOT
 * allow-same-origin. That keeps untrusted JS from touching cookies, localStorage,
 * or the parent page. We still inline the canvas's own JS in a <script> tag.
 */
export async function renderCanvasDoc(canvas: Canvas): Promise<string> {
  const themeCss = await getThemeCSS(canvas.meta.theme);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(canvas.meta.title)}</title>
<style data-canvas-theme="${escapeHtml(canvas.meta.theme)}">
${themeCss}
</style>
<style data-canvas-style>
${canvas.css}
</style>
</head>
<body>
${canvas.html}
<script>
${escapeForScript(canvas.js)}
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
