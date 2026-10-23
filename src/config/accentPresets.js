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

export const DEFAULT_ACCENT = "bone";

export const isValidAccent = (id) =>
  typeof id === "string" && Object.prototype.hasOwnProperty.call(ACCENT_PRESETS, id);

export const resolveAccentId = (id) => (isValidAccent(id) ? id : DEFAULT_ACCENT);

let activeAccent = DEFAULT_ACCENT;

export const getActiveAccent = () => activeAccent;

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

/** localStorage helpers (safe when storage is unavailable). Migrates retired presets to DEFAULT_ACCENT. */
export const readStoredAccent = (storage, key) => {
  let raw = null;
  try {
    raw = storage?.getItem(key) ?? null;
  } catch {
    return DEFAULT_ACCENT;
  }
  const resolved = resolveAccentId(raw);
  if (raw !== null && raw !== resolved) {
    try {
      storage?.setItem(key, resolved);
    } catch {}
  }
  return resolved;
};

export const persistAccent = (storage, key, id) => {
  const next = resolveAccentId(id);
  try {
    storage?.setItem(key, next);
  } catch {}
  return next;
};
