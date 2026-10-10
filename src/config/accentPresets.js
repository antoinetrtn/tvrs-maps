/**
 * Accent presets — user-selectable accent colour (Settings → "Couleur d'accent").
 *
 * Each preset is tuned for the ink palette (bg #0e1116, surfaces #161b22):
 *   accent / hover  ≥ 6:1 against the background (AA for text and UI),
 *   contrast        text colour drawn ON the accent (primary button label),
 *   grid            dim variant for the globe graticule / XP orb outline.
 *
 * The active preset is module state so getThemeColors() (also used by the
 * globe) picks it up without threading a new argument through src/globe.
 */

export const ACCENT_PRESETS = {
  magenta: {
    label: { fr: "Magenta glitch", en: "Glitch magenta" },
    accent: "#ff5fa8",
    hover: "#ff8cc1",
    contrast: "#0e1116",
    grid: "#7a3a5a",
    rgb: "255, 95, 168",
  },
  cyan: {
    label: { fr: "Cyan CRT", en: "CRT cyan" },
    accent: "#3fd8e8",
    hover: "#7ee6f0",
    contrast: "#0e1116",
    grid: "#2c6f78",
    rgb: "63, 216, 232",
  },
  acid: {
    label: { fr: "Vert acide", en: "Acid green" },
    accent: "#b6f03c",
    hover: "#ccf57a",
    contrast: "#0e1116",
    grid: "#5c7a25",
    rgb: "182, 240, 60",
  },
  signal: {
    label: { fr: "Orange signal", en: "Signal orange" },
    accent: "#ff8a3d",
    hover: "#ffab73",
    contrast: "#0e1116",
    grid: "#7a4a2a",
    rgb: "255, 138, 61",
  },
  bone: {
    label: { fr: "Os (sobre)", en: "Bone (sober)" },
    accent: "#e6dccb",
    hover: "#f4eee3",
    contrast: "#0e1116",
    grid: "#6b665c",
    rgb: "230, 220, 203",
  },
  teal: {
    label: { fr: "Sarcelle", en: "Teal" },
    accent: "#52b5aa",
    hover: "#7cc8bf",
    contrast: "#0e1116",
    grid: "#4d7a76",
    rgb: "82, 181, 170",
  },
};

export const DEFAULT_ACCENT = "magenta";

export const isValidAccent = (id) =>
  typeof id === "string" && Object.prototype.hasOwnProperty.call(ACCENT_PRESETS, id);

export const resolveAccentId = (id) => (isValidAccent(id) ? id : DEFAULT_ACCENT);

let activeAccent = DEFAULT_ACCENT;

export const setActiveAccent = (id) => {
  activeAccent = resolveAccentId(id);
  return activeAccent;
};

/** Theme-colour overrides (getThemeColors keys) for an accent preset. */
export const getAccentOverrides = (id = activeAccent) => {
  const p = ACCENT_PRESETS[resolveAccentId(id)];
  return {
    accent: p.accent,
    accentHover: p.hover,
    accentSoft: `rgba(${p.rgb}, 0.16)`,
    accentGlow: p.accent,
    accentContrast: p.contrast,
    accentGrid: p.grid,
    selectionHighlight: p.accent,
    gold: p.accent,
    mapSurfaceSelected: p.accent,
    gridDot: `rgba(${p.rgb}, 0.14)`,
    graticule: p.grid,
    selectionRingColor: p.accent,
  };
};

/** localStorage helpers (safe when storage is unavailable). */
export const readStoredAccent = (storage, key) => {
  try {
    return resolveAccentId(storage?.getItem(key));
  } catch {
    return DEFAULT_ACCENT;
  }
};

export const persistAccent = (storage, key, id) => {
  const next = resolveAccentId(id);
  try {
    storage?.setItem(key, next);
  } catch {}
  return next;
};
