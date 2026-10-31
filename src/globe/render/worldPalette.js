/**
 * World land-cover classes & pixel-art palette (see docs/world-palette.md).
 * Class ids match scripts/build-world-landcover.py (grey = classId * 16 + level).
 * Tones = [shadow, base, light, accent], display-space sRGB. Hues were sampled
 * on NASA Blue Marble (15/50/85th luminance percentiles of each class), then
 * lifted for the night-globe look (dark UI, amber city lights).
 */
import { WORLD_PALETTE } from "../../config/worldPaletteTokens";

export const LANDCOVER_CLASSES = [
  "none",
  "water",
  "shallow",
  "ice",
  "tundra",
  "taiga",
  "temperate",
  "meadow",
  "tropical",
  "savanna",
  "steppe",
  "sand",
  "rock",
  "alpine",
  "wetland",
];

export { WORLD_PALETTE };

const FORESTS = new Set(["taiga", "temperate", "tropical"]);

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function bayer4(x, y) {
  const b2 = (a, b) => a * 2 + b * (3 - 4 * a);
  return (4 * b2(x & 1, y & 1) + b2((x >> 1) & 1, (y >> 1) & 1)) / 16;
}

/**
 * Palette slot (0..3) of one texel. `level` (0..15) is the real Blue Marble
 * brightness of that texel inside its class; the Bayer threshold turns it into
 * hard 1-texel pixels, and each class adds its own sparse pixel-art motif.
 */
export function pickTone(name, level, x, y) {
  const grain = hash2(x + 17.3, y + 41.9);
  const v = level / 15 + (bayer4(x, y) - 0.47) * 0.38;
  const base = v < 0.34 ? 0 : v < 0.68 ? 1 : 2;
  if (FORESTS.has(name)) {
    // 2x2 canopy crowns: lit top-left pixel, shadowed opposite corner.
    const crown = hash2(x >> 1, (y >> 1) + 7.7);
    if (crown > 0.84)
      return (x & 1) === 0 && (y & 1) === 1 ? 3 : (x & 1) === 1 && (y & 1) === 0 ? 0 : 2;
    return base;
  }
  if (name === "savanna" || name === "steppe") return grain > 0.92 ? 3 : base;
  if (name === "tundra" || name === "wetland") return grain > 0.9 ? 3 : base;
  if (name === "sand") return v > 0.95 ? 3 : base;
  if (name === "alpine") return level >= 11 ? 3 : base;
  if (name === "ice") return level <= 1 && grain > 0.5 ? 3 : Math.max(1, base);
  return base;
}

/** Grey land-cover levels (row 0 = 90°S) → RGBA pixels; alpha 0 = sea / no data. */
export function bakeLandcover(grey, width, height) {
  const rgbaByClass = LANDCOVER_CLASSES.map((n) => (WORLD_PALETTE[n] || []).map(hexToRgb));
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const g = grey[y * width + x];
      const cid = g >> 4;
      if (!cid || !rgbaByClass[cid]?.length) continue;
      const rgb = rgbaByClass[cid][pickTone(LANDCOVER_CLASSES[cid], g & 15, x, y)];
      const i = (y * width + x) * 4;
      out[i] = rgb[0];
      out[i + 1] = rgb[1];
      out[i + 2] = rgb[2];
      out[i + 3] = 255;
    }
  }
  return out;
}
