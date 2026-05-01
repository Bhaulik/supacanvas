import type { Plate } from "./types.ts";
import { getThemeCSS } from "./storage.ts";
import { escapeHtml } from "./render.ts";

export function toMarkdown(plate: Plate): string {
  const { meta, html, css, js } = plate;
  const lines: string[] = [
    "---",
    `id: ${meta.id}`,
    `title: ${jsonString(meta.title)}`,
    `description: ${jsonString(meta.description)}`,
    `tags: [${meta.tags.map(jsonString).join(", ")}]`,
    `theme: ${meta.theme}`,
    `source: ${jsonString(meta.source)}`,
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

export async function toStandaloneHtml(plate: Plate): Promise<string> {
  const themeCss = await getThemeCSS(plate.meta.theme);
  const contextBlock = plate.meta.context
    ? `<!-- plate-context\n${plate.meta.context.replace(/-->/g, "-- >")}\n-->\n`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="universal-plate" />
<meta name="plate-id" content="${escapeHtml(plate.meta.id)}" />
<meta name="plate-theme" content="${escapeHtml(plate.meta.theme)}" />
<meta name="plate-source" content="${escapeHtml(plate.meta.source)}" />
<meta name="description" content="${escapeHtml(plate.meta.description)}" />
${contextBlock}<title>${escapeHtml(plate.meta.title)}</title>
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
${plate.js.replace(/<\/script/gi, "<\\/script")}
</script>
</body>
</html>`;
}

export async function toPrintHtml(plate: Plate): Promise<string> {
  const themeCss = await getThemeCSS(plate.meta.theme);
  // Same as standalone but auto-fires the print dialog so the user can
  // "Save as PDF" via the browser's native print sheet.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(plate.meta.title)}</title>
<style>
@page { size: auto; margin: 12mm; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
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
${plate.js.replace(/<\/script/gi, "<\\/script")}
</script>
<script>
// Wait for assets/animations to settle, then open the print dialog.
window.addEventListener("load", () => setTimeout(() => window.print(), 250));
</script>
</body>
</html>`;
}
