/**
 * Accent — the single accent colour of the unified nocturnal theme ("os" / bone).
 *
 * Tuned for the ink palette (bg #0e1116, surfaces #161b22):
 *   accent / hover  ≥ 6:1 against the background (AA for text and UI),
 *   contrast        text colour drawn ON the accent (primary button label),
 *   grid            dim variant for the globe graticule / XP orb outline.
 * Mirrored as first-paint tokens in src/index.css (:root --accent…).
 */

export const ACCENT = {
  accent: "#e6dccb",
  hover: "#f4eee3",
  contrast: "#0e1116",
  grid: "#6b665c",
  rgb: "230, 220, 203",
};

/** Theme-colour overrides (getThemeColors keys) derived from the accent. */
export const ACCENT_OVERRIDES = Object.freeze({
  accent: ACCENT.accent,
  accentHover: ACCENT.hover,
  accentSoft: `rgba(${ACCENT.rgb}, 0.16)`,
  accentGlow: ACCENT.accent,
  accentContrast: ACCENT.contrast,
  accentGrid: ACCENT.grid,
  selectionHighlight: ACCENT.accent,
  gold: ACCENT.accent,
  mapSurfaceSelected: ACCENT.accent,
  gridDot: `rgba(${ACCENT.rgb}, 0.14)`,
  graticule: ACCENT.grid,
  selectionRingColor: ACCENT.accent,
});

export const MODE_PIXEL_PALETTES = {
  conquest: {
    primary: "#f59e0b",
    secondary: "#2dd4bf",
    spark: "#fde047",
  },
  countries: {
    primary: "#f6b93b",
    secondary: "#38bdf8",
    spark: "#fef08a",
  },
  capitals: {
    primary: "#fbbf24",
    secondary: "#fb923c",
    spark: "#fffbeb",
  },
  departments: {
    primary: "#60a5fa",
    secondary: "#f87171",
    spark: "#fde047",
  },
  us_states: {
    primary: "#fb923c",
    secondary: "#38bdf8",
    spark: "#fef08a",
  },
  rivers_mountains: {
    primary: "#2dd4bf",
    secondary: "#f59e0b",
    spark: "#a5f3fc",
  },
};

export const PIXEL_SCENE_SWATCHES = {
  bgArenaOuter: "#0d111a",
  bgArenaInner: "#131926",
  bgCountriesOuter: "#090d16",
  bgCountriesInner: "#0f172a",
  bgCapitalsOuter: "#0c0f17",
  bgCapitalsInner: "#141824",
  bgDeptsOuter: "#0b111e",
  bgDeptsInner: "#111a2e",
  bgUsOuter: "#0d121c",
  bgUsInner: "#141c2b",
  bgRiversOuter: "#08131c",
  bgRiversInner: "#0d1f2d",
  gridSlate: "#1e293b",
  mutedSlate: "#94a3b8",
  oceanDeep: "#172554",
  oceanMid: "#1e3a8a",
  oceanDark: "#112233",
  amber900: "#7c2d12",
  amber800: "#92400e",
  amber700: "#b45309",
  amber600: "#d97706",
  amber500: "#f59e0b",
  amber400: "#fbbf24",
  yellow200: "#fde047",
  yellow100: "#fef08a",
  yellow50: "#fffbeb",
  white: "#ffffff",
  ice100: "#f8fafc",
  ice200: "#e2e8f0",
  iceSky: "#e0f2fe",
  teal900: "#115e59",
  teal600: "#0d9488",
  teal400: "#2dd4bf",
  teal100: "#ccfbf1",
  cyan600: "#0891b2",
  cyan500: "#06b6d4",
  cyan400: "#22d3ee",
  cyan300: "#67e8f9",
  cyan200: "#a5f3fc",
  cyan100: "#cffafe",
  blue700: "#1d4ed8",
  blue600: "#2563eb",
  blue500: "#3b82f6",
  blue400: "#60a5fa",
  sky400: "#38bdf8",
  red600: "#dc2626",
  red500: "#ef4444",
  orange700: "#c2410c",
  orange600: "#ea580c",
  orange400: "#fb923c",
  earthDark: "#271c15",
  earthMid: "#452c16",
  slopeDark: "#5c3818",
  slopeMid: "#78471c",
  slopeWarm: "#925822",
  slopeOchre: "#b46924",
  slopeGold: "#d98836",
};
