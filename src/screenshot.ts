import { existsSync } from "node:fs";
import type { Canvas } from "./types.ts";
import { renderCanvasDoc } from "./render.ts";

/**
 * Auto-detect a Chrome/Chromium executable. We don't bundle a browser —
 * keeps the package small and avoids ~300MB of binaries the user almost
 * always has anyway. Override with SUPACANVAS_CHROME_PATH if needed.
 */
const CHROME_CANDIDATES = [
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Arc.app/Contents/MacOS/Arc",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

export function findChromePath(): string | null {
  if (process.env.SUPACANVAS_CHROME_PATH) return process.env.SUPACANVAS_CHROME_PATH;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const p of CHROME_CANDIDATES) {
    try { if (existsSync(p)) return p; } catch { /* permission errors etc. */ }
  }
  return null;
}

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  fullPage?: boolean;
  /** Pixel ratio. 2 = retina-quality, larger payload. Default 2. */
  deviceScaleFactor?: number;
  /** Extra ms to wait after networkidle, lets animations/fonts settle. Default 250. */
  settleMs?: number;
}

export class ChromeNotFoundError extends Error {
  constructor() {
    super(
      "No Chrome/Chromium installation found. Install Chrome from " +
      "https://www.google.com/chrome/ or set SUPACANVAS_CHROME_PATH to an " +
      "executable (Chromium / Brave / Edge / Arc all work)."
    );
    this.name = "ChromeNotFoundError";
  }
}

export async function screenshotCanvas(canvas: Canvas, opts: ScreenshotOptions = {}): Promise<Buffer> {
  const chromePath = findChromePath();
  if (!chromePath) throw new ChromeNotFoundError();

  // Lazy import — keeps `canvas mcp` startup fast even if screenshot is never used.
  const puppeteer = (await import("puppeteer-core")).default;

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: opts.width ?? 1280,
      height: opts.height ?? 800,
      deviceScaleFactor: opts.deviceScaleFactor ?? 2,
    });

    const html = await renderCanvasDoc(canvas);
    // setContent writes the HTML directly — no server, no file, no origin issues.
    // networkidle0 = wait until 0 network connections for 500ms.
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 10_000 });

    // Small settle window for CSS animations + font rendering.
    await new Promise(r => setTimeout(r, opts.settleMs ?? 250));

    const out = await page.screenshot({
      type: "png",
      fullPage: opts.fullPage ?? false,
    });
    return Buffer.isBuffer(out) ? out : Buffer.from(out);
  } finally {
    await browser.close();
  }
}
