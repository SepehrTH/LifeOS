/**
 * Generates the LifeOS app icons into public/ — no image libraries involved.
 * The artwork is the app itself: a window card on a dotted board.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SS = 4; // supersampling factor, downsampled at the end for clean edges

const INK = [10, 10, 10];
const DOT = [58, 58, 58];
const CARD = [255, 255, 255];
const LINE = [190, 190, 186];
const ACCENT = [111, 168, 255];

function canvas(size) {
  return { size, data: new Uint8ClampedArray(size * size * 4) };
}

function px(c, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  c.data[i] = r;
  c.data[i + 1] = g;
  c.data[i + 2] = b;
  c.data[i + 3] = a;
}

function roundRect(c, x, y, w, h, r, color) {
  for (let py = Math.floor(y); py < y + h; py++) {
    for (let pxx = Math.floor(x); pxx < x + w; pxx++) {
      const dx = Math.max(x + r - pxx, pxx - (x + w - r - 1), 0);
      const dy = Math.max(y + r - py, py - (y + h - r - 1), 0);
      if (dx * dx + dy * dy <= r * r) px(c, pxx, py, color);
    }
  }
}

function disc(c, cx, cy, radius, color) {
  for (let py = Math.floor(cy - radius); py <= cy + radius; py++) {
    for (let pxx = Math.floor(cx - radius); pxx <= cx + radius; pxx++) {
      const dx = pxx - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= radius * radius) px(c, pxx, py, color);
    }
  }
}

/** Draws the icon at `size` (already supersampled). `bleed` fills the whole square. */
function draw(size, bleed) {
  const c = canvas(size);
  const radius = bleed ? 0 : size * 0.22;
  roundRect(c, 0, 0, size, size, radius, INK);

  // dotted board
  const step = size / 7;
  for (let gx = 1; gx < 7; gx++) {
    for (let gy = 1; gy < 7; gy++) {
      disc(c, gx * step, gy * step, size * 0.011, DOT);
    }
  }

  // window card
  const cw = size * 0.54;
  const ch = size * 0.46;
  const cx = (size - cw) / 2;
  const cy = (size - ch) / 2;
  roundRect(c, cx, cy, cw, ch, size * 0.045, CARD);

  // two todo rows, the first one "recurring"
  const rowH = size * 0.035;
  const rowX = cx + cw * 0.14;
  const rowW = cw * 0.62;
  roundRect(c, rowX, cy + ch * 0.38, rowW, rowH, rowH / 2, ACCENT);
  roundRect(c, rowX, cy + ch * 0.62, rowW * 0.72, rowH, rowH / 2, LINE);

  return c;
}

function downsample(src, factor) {
  const size = src.size / factor;
  const out = canvas(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const i = ((y * factor + sy) * src.size + (x * factor + sx)) * 4;
          const alpha = src.data[i + 3];
          r += src.data[i] * alpha;
          g += src.data[i + 1] * alpha;
          b += src.data[i + 2] * alpha;
          a += alpha;
        }
      }
      const i = (y * size + x) * 4;
      out.data[i] = a ? r / a : 0;
      out.data[i + 1] = a ? g / a : 0;
      out.data[i + 2] = a ? b / a : 0;
      out.data[i + 3] = a / (factor * factor);
    }
  }
  return out;
}

/* --- minimal PNG writer --- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([head, typed, crc]);
}

function toPng(c) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.size, 0);
  ihdr.writeUInt32BE(c.size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(c.size * (c.size * 4 + 1));
  for (let y = 0; y < c.size; y++) {
    const rowStart = y * (c.size * 4 + 1);
    raw[rowStart] = 0; // no filter
    Buffer.from(c.data.buffer, y * c.size * 4, c.size * 4).copy(raw, rowStart + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(process.cwd(), "public");
mkdirSync(outDir, { recursive: true });

const targets = [
  ["icon-512.png", 512, false],
  ["icon-192.png", 192, false],
  ["apple-touch-icon.png", 180, true],
  ["icon-maskable-512.png", 512, true],
  ["favicon-32.png", 32, false],
];

for (const [name, size, bleed] of targets) {
  const png = toPng(downsample(draw(size * SS, bleed), SS));
  writeFileSync(path.join(outDir, name), png);
  console.log(`public/${name}  ${size}×${size}`);
}
