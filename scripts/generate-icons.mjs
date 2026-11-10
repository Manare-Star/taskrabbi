// Draws the Siza app icon set into assets/ with no dependencies beyond Node itself.
//
//   node scripts/generate-icons.mjs
//
// The mark is a lowercase "s" made of two arcs with round ends, white on the brand teal.
// It's drawn from a signed distance function (how far each pixel is from the stroke), which
// gives smooth edges at any size without an image library. To change the logo, change the
// geometry in `markDistance` (or replace these PNGs with designed artwork of the same
// sizes: icon 1024x1024, no transparency, no rounded corners — the stores round it).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

const TEAL = [0x0f, 0x6e, 0x56];
const WHITE = [0xff, 0xff, 0xff];

// ── The mark, in a unit square centred on (0, 0) spanning roughly -0.5..0.5 ──────────────

const RADIUS = 0.142; // radius of each arc's centre line
const STROKE = 0.098; // stroke thickness

const deg = (d) => (d * Math.PI) / 180;

// Distance from (x, y) to an arc of a circle. Angles are measured anticlockwise from the
// positive x axis with y pointing up; the arc runs from `from` to `to` (from < to).
function arcDistance(x, y, cx, cy, from, to) {
  const dx = x - cx;
  const dy = y - cy;
  let angle = Math.atan2(dy, dx);
  while (angle < from) angle += Math.PI * 2;
  if (angle <= to) return Math.abs(Math.hypot(dx, dy) - RADIUS);
  const end = (a) => Math.hypot(x - (cx + RADIUS * Math.cos(a)), y - (cy + RADIUS * Math.sin(a)));
  return Math.min(end(from), end(to));
}

// Signed distance to the "s": negative inside the stroke.
function markDistance(x, yDown) {
  const y = -yDown; // flip so y points up, like the angles
  const top = arcDistance(x, y, 0, RADIUS, deg(25), deg(270)); // over the top, round to the middle
  const bottom = arcDistance(x, y, 0, -RADIUS, deg(-155), deg(90)); // from the middle, round the bottom
  return Math.min(top, bottom) - STROKE / 2;
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────

// size: pixels. background: RGB or null for transparent. scale: mark size relative to the
// canvas (1 = the mark's unit square fills it).
function render({ size, background, foreground, scale }) {
  const pixels = Buffer.alloc(size * size * 4);
  const pixel = 1 / (size * scale); // one output pixel, in mark units
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const x = ((px + 0.5) / size - 0.5) / scale;
      const y = ((py + 0.5) / size - 0.5) / scale;
      // Coverage from distance: 1 well inside, 0 well outside, a one-pixel ramp between.
      const coverage = Math.min(1, Math.max(0, 0.5 - markDistance(x, y) / pixel));
      const offset = (py * size + px) * 4;
      if (background) {
        for (let c = 0; c < 3; c += 1) {
          pixels[offset + c] = Math.round(background[c] + (foreground[c] - background[c]) * coverage);
        }
        pixels[offset + 3] = 255;
      } else {
        pixels[offset] = foreground[0];
        pixels[offset + 1] = foreground[1];
        pixels[offset + 2] = foreground[2];
        pixels[offset + 3] = Math.round(coverage * 255);
      }
    }
  }
  return encodePng(pixels, size, size);
}

// ── Minimal PNG encoder (8-bit RGBA) ─────────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgba, width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // Each row is prefixed with its filter type (0 = none).
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Outputs ──────────────────────────────────────────────────────────────────────────────

const OUTPUTS = [
  // App Store / launcher icon: full-bleed square, no transparency.
  { file: "icon.png", size: 1024, background: TEAL, foreground: WHITE, scale: 1 },
  // Android adaptive icon foreground: transparent, with the mark inside the central safe
  // zone (the launcher crops the outer third into a circle, squircle, etc.).
  { file: "adaptive-icon.png", size: 1024, background: null, foreground: WHITE, scale: 0.8 },
  // Android 13+ themed icon: a single-colour silhouette the system tints.
  { file: "monochrome-icon.png", size: 1024, background: null, foreground: WHITE, scale: 0.8 },
  // Splash screen: the mark alone; app.json supplies the teal background.
  { file: "splash-icon.png", size: 1024, background: null, foreground: WHITE, scale: 1 },
  // Browser tab icon for the web preview.
  { file: "favicon.png", size: 48, background: TEAL, foreground: WHITE, scale: 1.1 },
];

mkdirSync(ASSETS, { recursive: true });
for (const { file, ...options } of OUTPUTS) {
  const png = render(options);
  writeFileSync(join(ASSETS, file), png);
  console.log(`${file}  ${options.size}x${options.size}  ${(png.length / 1024).toFixed(1)} KB`);
}
