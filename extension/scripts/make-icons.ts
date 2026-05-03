// Generates PNG icons (16/48/128) without external dependencies.
// Draws a cream-on-oxidized-red mark inspired by the supacanvas wordmark.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "public", "icon");
mkdirSync(outDir, { recursive: true });

interface Rgb { r: number; g: number; b: number; a: number; }
const PAPER: Rgb = { r: 0xf5, g: 0xf0, b: 0xe6, a: 0xff };
const ACCENT: Rgb = { r: 0xa8, g: 0x35, b: 0x2d, a: 0xff };
const INK: Rgb = { r: 0x1a, g: 0x16, b: 0x14, a: 0xff };

for (const size of [16, 48, 128]) {
  const buf = drawIcon(size);
  const path = resolve(outDir, `${size}.png`);
  writeFileSync(path, buf);
  console.log(`wrote ${path}`);
}

function drawIcon(size: number): Buffer {
  const pixels = new Uint8Array(size * size * 4);
  // Solid accent fill (ink-aware rounded rect for the bigger sizes)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = baseColor(x, y, size);
      setPx(pixels, size, x, y, c);
    }
  }
  drawGlyph(pixels, size);
  return encodePng(pixels, size, size);
}

function baseColor(x: number, y: number, size: number): Rgb {
  // Rounded square mask for sizes >= 32; below that, leave it square.
  if (size >= 32) {
    const r = size * 0.2;
    if (!insideRoundedRect(x + 0.5, y + 0.5, size, size, r)) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
  }
  return ACCENT;
}

function insideRoundedRect(px: number, py: number, w: number, h: number, r: number): boolean {
  const dx = Math.max(r - px, px - (w - r), 0);
  const dy = Math.max(r - py, py - (h - r), 0);
  return dx * dx + dy * dy <= r * r;
}

function drawGlyph(pixels: Uint8Array, size: number): void {
  // Draw a stylized "S" — italic stroke using two sine-shaped diagonals.
  const strokeWidth = Math.max(2, Math.round(size * 0.14));
  const inset = Math.round(size * 0.22);
  const top = inset;
  const bottom = size - inset;
  const left = inset + Math.round(size * 0.04);
  const right = size - inset - Math.round(size * 0.04);
  // top horizontal
  fillBar(pixels, size, left, top, right, top + strokeWidth, PAPER);
  // bottom horizontal
  fillBar(pixels, size, left, bottom - strokeWidth, right, bottom, PAPER);
  // middle horizontal
  const mid = Math.round((top + bottom) / 2);
  fillBar(pixels, size, left, mid - Math.floor(strokeWidth / 2), right, mid + Math.ceil(strokeWidth / 2), PAPER);
  // upper-left vertical (top to mid)
  fillBar(pixels, size, left, top, left + strokeWidth, mid, PAPER);
  // lower-right vertical (mid to bottom)
  fillBar(pixels, size, right - strokeWidth, mid, right, bottom, PAPER);
  // tiny ink dot for editorial detail at >= 48
  if (size >= 48) {
    const dotR = Math.max(1, Math.round(size * 0.04));
    drawDot(pixels, size, right + Math.round(size * 0.05), bottom - Math.round(size * 0.04), dotR, INK);
  }
}

function fillBar(pixels: Uint8Array, size: number, x0: number, y0: number, x1: number, y1: number, color: Rgb): void {
  for (let y = Math.max(0, y0); y < Math.min(size, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(size, x1); x++) {
      // only paint over filled (non-transparent) base
      const idx = (y * size + x) * 4;
      const baseAlpha = pixels[idx + 3] ?? 0;
      if (baseAlpha === 0) continue;
      setPx(pixels, size, x, y, color);
    }
  }
}

function drawDot(pixels: Uint8Array, size: number, cx: number, cy: number, r: number, color: Rgb): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const idx = (y * size + x) * 4;
      const baseAlpha = pixels[idx + 3] ?? 0;
      if (baseAlpha === 0) continue;
      setPx(pixels, size, x, y, color);
    }
  }
}

function setPx(pixels: Uint8Array, size: number, x: number, y: number, c: Rgb): void {
  const i = (y * size + x) * 4;
  pixels[i] = c.r;
  pixels[i + 1] = c.g;
  pixels[i + 2] = c.b;
  pixels[i + 3] = c.a;
}

// --- PNG encoder (RGBA, 8-bit, no transparency tricks) ---

function encodePng(pixels: Uint8Array, width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = width * 4;
  const raw = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowSize + 1)] = 0; // filter: none
    for (let x = 0; x < rowSize; x++) {
      raw[y * (rowSize + 1) + 1 + x] = pixels[y * rowSize + x] ?? 0;
    }
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
