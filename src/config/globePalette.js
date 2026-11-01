/**
 * Globe palette of the unified nocturnal theme: ocean, land shades, graticule,
 * halo and glitch tint are all derived from the bone accent. Land shades target
 * a fixed luminance so the contrast stays stable if the accent is retuned.
 */
import { ACCENT } from "./accentPresets.js";

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

const buildGlobePalette = () => {
  const { accent } = ACCENT;
  // Bone/"os": sober paper-on-ink — paler land, quieter halo.
  const paper = isPaperAccent(accent);
  const landTarget = paper ? 0.14 : 0.09;
  const base = mixForLuminance(accent, landTarget);
  const uniformLandShade = mixHex(INK, accent, Math.min(1, base));
  const land = REGIONS.map(() => uniformLandShade);
  // High-contrast label/gauge tones (>= 4.5:1 against dark glass panels).
  const labelTarget = paper ? 0.52 : 0.36;
  const labelBase = mixForLuminance(accent, labelTarget);
  const label = REGION_LIGHTNESS.map((k) => mixHex(INK, accent, Math.min(1, labelBase * k)));
  return {
    accent,
    paper,
    ocean: mixHex(INK, accent, 0.02),
    land: Object.fromEntries(REGIONS.map((region, i) => [region, land[i]])),
    label: Object.fromEntries(REGIONS.map((region, i) => [region, label[i]])),
    graticule: mixHex(INK, accent, mixForLuminance(accent, 0.12)),
    glow: Number.parseInt((paper ? mixHex(INK, accent, 0.7) : accent).slice(1), 16),
    rim: paper ? mixHex(INK, accent, 0.6) : accent,
    // Country borders: deep ink-tinted accent, engraved into the bright phosphor land.
    border: mixHex(INK, accent, paper ? 0.12 : 0.08),
    glitchTintA: accent,
    glitchTintB: mixHex(accent, "#ffffff", 0.6),
  };
};

export const GLOBE_PALETTE = Object.freeze(buildGlobePalette());
