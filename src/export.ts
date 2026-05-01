import type { Canvas } from "./types.ts";
import { getThemeCSS } from "./storage.ts";
import { escapeHtml } from "./render.ts";

export function toMarkdown(canvas: Canvas): string {
  const { meta, html, css, js } = canvas;
  const lines: string[] = [
    "---",
    `id: ${meta.id}`,
    `title: ${jsonString(meta.title)}`,
    `description: ${jsonString(meta.description)}`,
    `tags: [${meta.tags.map(jsonString).join(", ")}]`,
    `theme: ${meta.theme}`,
    `created: ${meta.createdAt}`,
    `updated: ${meta.updatedAt}`,
    "---",
    "",
    `# ${meta.title}`,
    "",
  ];
  if (meta.description) {
    lines.push(`_${meta.description}_`, "");
  }
  if (meta.tags.length) {
    lines.push(`> Subjects: ${meta.tags.join(", ")}`);
    lines.push("");
  }
  if (meta.context) {
    lines.push("## Context", "", meta.context, "");
  }
  lines.push("## HTML", "", "```html", html.trim() || "<!-- empty -->", "```", "");
  lines.push("## CSS", "", "```css", css.trim() || "/* empty */", "```", "");
  lines.push("## JS", "", "```js", js.trim() || "// empty", "```", "");
  return lines.join("\n");
}

function jsonString(s: string): string {
  return JSON.stringify(s);
}

export async function toStandaloneHtml(canvas: Canvas): Promise<string> {
  const themeCss = await getThemeCSS(canvas.meta.theme);
  const contextBlock = canvas.meta.context
    ? `<!-- canvas-context\n${canvas.meta.context.replace(/-->/g, "-- >")}\n-->\n`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="universal-canvas" />
<meta name="canvas-id" content="${escapeHtml(canvas.meta.id)}" />
<meta name="canvas-theme" content="${escapeHtml(canvas.meta.theme)}" />
<meta name="description" content="${escapeHtml(canvas.meta.description)}" />
${contextBlock}<title>${escapeHtml(canvas.meta.title)}</title>
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
${canvas.js.replace(/<\/script/gi, "<\\/script")}
</script>
</body>
</html>`;
}

export async function toPrintHtml(canvas: Canvas): Promise<string> {
  const themeCss = await getThemeCSS(canvas.meta.theme);
  // Same as standalone but auto-fires the print dialog so the user can
  // "Save as PDF" via the browser's native print sheet.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(canvas.meta.title)}</title>
<style>
@page { size: auto; margin: 12mm; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
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
${canvas.js.replace(/<\/script/gi, "<\\/script")}
</script>
<script>
// Wait for assets/animations to settle, then open the print dialog.
window.addEventListener("load", () => setTimeout(() => window.print(), 250));
</script>
</body>
</html>`;
}
