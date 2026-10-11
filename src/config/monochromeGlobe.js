/**
 * Monochrome globe (CRT look): the whole palette is derived from the user's
 * accent preset — ocean, land shades, graticule, halo and glitch tint. Land
 * shades target a fixed luminance so every accent keeps the same contrast
 * (magenta is dim, acid green is bright: both land at the same lightness).
 */
import { ACCENT_PRESETS, resolveAccentId } from "./accentPresets.js";

const INK = "#07060a";
const REGIONS = [
  "Europe",
  "Americas",
  "Africa",
  "Oceania",
  "Asia",
  "Antarctic",
  "France",
  "Unknown",
];
// Per-region lightness offsets: subtle, Antarctica no brighter than the rest.
const REGION_LIGHTNESS = [1, 1.12, 0.92, 1.18, 1.05, 1.08, 1, 1.12];

const hexToRgb = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb) =>
  `#${rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;

const mixHex = (a, b, t) => {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return toHex(ra.map((v, i) => v + (rb[i] - v) * t));
};

const relativeLuminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Ink→accent mix factor that reaches roughly the target luminance. */
const mixForLuminance = (accent, target) => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 12; i += 1) {
    const mid = (lo + hi) / 2;
    if (relativeLuminance(mixHex(INK, accent, mid)) < target) lo = mid;
    else hi = mid;
  }
  return lo;
};

const isPaperAccent = (accent) => {
  const [r, g, b] = hexToRgb(accent);
  return relativeLuminance(accent) > 0.6 && Math.max(r, g, b) - Math.min(r, g, b) < 60;
};

export const buildMonochromePalette = (accentId) => {
  const accent = ACCENT_PRESETS[resolveAccentId(accentId)].accent;
  // Bone/"os": sober paper-on-ink — paler land, quieter halo.
  const paper = isPaperAccent(accent);
  const landTarget = paper ? 0.14 : 0.09;
  const base = mixForLuminance(accent, landTarget);
  const land = REGION_LIGHTNESS.map((k) => mixHex(INK, accent, Math.min(1, base * k)));
  return {
    accent,
    paper,
    ocean: mixHex(INK, accent, 0.02),
    land: Object.fromEntries(REGIONS.map((region, i) => [region, land[i]])),
    graticule: mixHex(INK, accent, mixForLuminance(accent, 0.12)),
    glow: Number.parseInt((paper ? mixHex(INK, accent, 0.7) : accent).slice(1), 16),
    rim: paper ? mixHex(INK, accent, 0.6) : accent,
    // Country borders: deep ink-tinted accent, engraved into the bright phosphor land.
    border: mixHex(INK, accent, paper ? 0.12 : 0.08),
    glitchTintA: accent,
    glitchTintB: mixHex(accent, "#ffffff", 0.6),
  };
};
