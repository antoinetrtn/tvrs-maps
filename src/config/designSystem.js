/**
 * ==========================================
 * DESIGN SYSTEM - Colors, Themes & Style Tokens
 * ==========================================
 */

// ==========================================
// 1. DESIGN TOKENS (Base values)
// ==========================================
//
// --- Radius scale & concentric rule ---
//
// The radius scale follows a *concentric* model:
//   outerRadius = innerRadius + padding
//
// This keeps nested borders visually parallel. Each tier is built
// from the previous one plus a spacing increment.
//
//   sm  =  4px  — Atomic elements: buttons, inputs, tags, badges.
//                  This is the default "boxy" radius used across
//                  the GameHUD and all interactive controls.
//   md  =  8px  — Containers & cards that wrap `sm` children with
//                  ~4px (spacing-xs) padding. Settings toggles,
//                  modals, panels, game-mode buttons.
//   lg  = 14px  — Reserved / exceptional: only for containers that
//                  wrap `md` children with extra spacing. Rarely
//                  needed in practice.
//   full= 9999px — Circles (gauges, spinners) and thin progress
//                  bars only.
//
// When choosing a radius, always check the element's parent
// padding so the rule  inner + padding ≈ outer  holds.
// ==========================================

const STYLE_TOKENS = {
  radius: {
    sm: "4px",
    md: "calc(var(--radius-sm) + var(--spacing-xs))",
    lg: "calc(var(--radius-md) + var(--spacing-xs) * 1.5)",
    full: "9999px",
  },
  spacing: {
    xxs: "2px",
    xs: "4px",
    sm: "8px",
    ms: "12px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  transition: {
    fast: "0.15s cubic-bezier(0.4, 0, 0.2, 1)",
    normal: "0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    emphasized: "0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    layout: "220ms cubic-bezier(0.2, 0.9, 0.2, 1)",
    spring: "0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
    instant: "70ms ease",
  },
  blur: {
    sm: "blur(4px)",
    md: "blur(12px)",
    lg: "blur(16px)",
    glass: "blur(24px) saturate(200%)",
    glassCompact: "blur(12px) saturate(140%)",
  },
  size: {
    controlSm: "32px",
    controlMd: "40px",
    controlLg: "44px",
    islandWidth: "500px",
  },
  fontSize: {
    "2xs": "0.6rem",
    xs: "0.7rem",
    sm: "0.8rem",
    md: "0.9rem",
    base: "1rem",
    lg: "1.15rem",
    xl: "1.3rem",
  },
};

// ==========================================
// 2. CORE THEMES
// ==========================================

const THEMES_LIST = [{ id: "satellite" }, { id: "blackout" }];
const _GLOBE_THEME_IDS = THEMES_LIST.map((entry) => entry.id);
export function isValidGlobeTheme(id) {
  return THEMES_LIST.some((entry) => entry.id === id);
}

// The theme used on a fresh install (before any localStorage preference exists).
// Blackout is the dark, high-contrast default.
export const DEFAULT_GLOBE_THEME = "blackout";

// LIGHT PALETTE — soft near-black ink on warm paper. No pure #000 in the UI:
// pure black reads harsh/dated on light surfaces ("noir trop noir"). Shadows are
// ink-tinted, low-opacity and multi-layered instead of heavy black blurs.
// KEEP IN SYNC with [data-theme="light"] in src/index.css (first-paint mirror).
const THEME = {
  light: {
    bg: "#f7f6f3",
    bgElevated: "#fdfcfa",
    textMain: "#1c2433",
    textMuted: "#5a6472",
    textInverse: "#ffffff",
    ink: "#1c2433",
    paper: "#ffffff",
    black: "#000000",
    labelShadow: "#ffffff",
    accent: "#1f2937",
    accentHover: "#374151",
    accentSoft: "rgba(31, 41, 55, 0.08)",
    accentGlow: "#1f2937",
    glassBg: "rgba(253, 252, 250, 0.8)",
    glassBorder: "rgba(28, 36, 51, 0.1)",
    glassBorderStrong: "rgba(28, 36, 51, 0.2)",
    glassHover: "rgba(28, 36, 51, 0.05)",
    glassShadow: "0 1px 2px rgba(28, 36, 51, 0.05), 0 12px 32px rgba(28, 36, 51, 0.1)",
    glassShadowStrong: "0 2px 4px rgba(28, 36, 51, 0.06), 0 18px 44px rgba(28, 36, 51, 0.14)",
    glassShadowDrag: "0 4px 8px rgba(28, 36, 51, 0.08), 0 24px 60px rgba(28, 36, 51, 0.18)",
    overlayBg: "rgba(247, 246, 243, 0.6)",
    modalHeaderBg: "rgba(253, 252, 250, 0.6)",
    subtleTint: "rgba(28, 36, 51, 0.05)",
    highlight: "rgba(28, 36, 51, 0.08)",
    success: "#1c2433",
    selectionHighlight: "#2dffa8",
    gold: "#5a6472",
    error: "#ff4500",
    errorDeep: "#e63e00",
    errorDeeper: "#b33000",
    errorMuted: "#ff8a65",
    warning: "#6b7280",
    warningSoft: "rgba(28, 36, 51, 0.04)",
    mapBase: "#dedee4",
    mapSea: "#ffffff",
    mapBorder: "#cccccc",
    mapBorderMuted: "#e5e5e5",
    borderFound: "#cccccc",
    borderUnfound: "#e5e5e5",
    mapSurfaceSelected: "#111111",
    gridDot: "rgba(28, 36, 51, 0.08)",
    graticule: "#666666",
    atmosphere: "#e0e0e0",
    globeEmissive: "#ffffff",
    globeSpecular: "#ffffff",
    globeInnerGlow: "#e2e8f0",
    lightingRim: "#dddddd",
    lightingFill: "#ffffff",
    lightingGround: "#ffffff",
    lightingStudio: "#ffffff",
    lightingLeft: "#ffffff",
    lightingRight: "#ffffff",
    riverActive: "#0284c7",
    riverInactive: "#7dd3fc",
    riverSelectedFound: "#0284c7",
    riverSelectedUnfound: "#38bdf8",
  },
  dark: {
    bg: "#000000",
    bgElevated: "#0f0f0f",
    textMain: "#ffffff",
    textMuted: "#888888",
    textInverse: "#000000",
    ink: "#ffffff",
    paper: "#000000",
    black: "#000000",
    labelShadow: "#000000",
    accent: "#ffffff",
    accentHover: "#cccccc",
    accentSoft: "rgba(255, 255, 255, 0.15)",
    accentGlow: "#ffffff",
    glassBg: "rgba(15, 15, 15, 0.85)",
    glassBorder: "rgba(255, 255, 255, 0.15)",
    glassBorderStrong: "rgba(255, 255, 255, 0.25)",
    glassHover: "rgba(255, 255, 255, 0.08)",
    glassShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
    glassShadowStrong: "0 24px 58px rgba(0, 0, 0, 0.6)",
    glassShadowDrag: "0 34px 86px rgba(0, 0, 0, 0.7)",
    overlayBg: "rgba(0, 0, 0, 0.85)",
    modalHeaderBg: "rgba(15, 15, 15, 0.6)",
    subtleTint: "rgba(255, 255, 255, 0.08)",
    highlight: "rgba(255, 255, 255, 0.15)",
    success: "#ffffff",
    selectionHighlight: "#2dffa8",
    gold: "#cccccc",
    error: "#ff4500",
    errorDeep: "#e63e00",
    errorDeeper: "#b33000",
    errorMuted: "#ff8a65",
    warning: "#888888",
    warningSoft: "rgba(255, 255, 255, 0.08)",
    mapBase: "#303036",
    mapSea: "#000000",
    mapBorder: "#44444c",
    mapBorderMuted: "#2d2d34",
    borderFound: "#ffffff",
    borderUnfound: "#44444c",
    mapSurfaceSelected: "#ffffff",
    gridDot: "rgba(255, 255, 255, 0.15)",
    graticule: "#888888",
    atmosphere: "rgba(255, 255, 255, 0.15)",
    globeEmissive: "#000000",
    globeSpecular: "#000000",
    globeInnerGlow: "rgba(255, 255, 255, 0.12)",
    lightingRim: "#333333",
    lightingFill: "#111111",
    lightingGround: "#000000",
    lightingStudio: "#000000",
    lightingLeft: "#000000",
    lightingRight: "#000000",
    riverActive: "#00f0ff",
    riverInactive: "#0e7490",
    riverSelectedFound: "#00f0ff",
    riverSelectedUnfound: "#38bdf8",
  },
};

// ==========================================
// 3. GEOGRAPHIC PALETTES & THEMES CONFIG (Continents & Regions)
// ==========================================

const DEFAULT_CONTINENT_COLORS = {
  surface: {
    light: {
      Europe: "#849bb3",
      Americas: "#cfa29b",
      Asia: "#cfba9b",
      Africa: "#9bcfaf",
      Oceania: "#b89bcf",
      Antarctic: "#cbd4db",
      Unknown: "#cbd5e1",
    },
    dark: {
      Europe: "#38526c",
      Americas: "#854d45",
      Asia: "#857045",
      Africa: "#458557",
      Oceania: "#704585",
      Antarctic: "#394a59",
      Unknown: "#64748b",
    },
  },
  label: {
    light: {
      Europe: "#1f344a",
      Americas: "#54251e",
      Asia: "#54411e",
      Africa: "#1e542d",
      Oceania: "#411e54",
      Antarctic: "#233240",
      Unknown: "#1e293b",
    },
    dark: {
      Europe: "#bcd0e8",
      Americas: "#e8beb7",
      Asia: "#e8d6be",
      Africa: "#bee8cb",
      Oceania: "#d6bee8",
      Antarctic: "#cbd9e5",
      Unknown: "#94a3b8",
    },
  },
  attenuated: {
    light: {
      Europe: "#4c5d6e",
      Americas: "#7c5953",
      Asia: "#7c6d53",
      Africa: "#537c62",
      Oceania: "#6b537c",
      Antarctic: "#6f7a84",
      Unknown: "#64748b",
    },
    dark: {
      Europe: "#141414",
      Americas: "#1a1a1a",
      Asia: "#202020",
      Africa: "#262626",
      Oceania: "#2c2c2c",
      Antarctic: "#303030",
      Unknown: "#1a1a1a",
    },
  },
};

export const GLOBE_TRANSPARENT_BACKGROUND = "rgba(0, 0, 0, 0)";

const DEFAULT_DEPARTMENT_COLORS = {
  11: "#e11d48", // Île-de-France (Rose/Red)
  24: "#f59e0b", // Centre-Val de Loire (Orange)
  27: "#d97706", // Bourgogne-Franche-Comté (Dark Orange)
  28: "#059669", // Normandie (Green)
  32: "#0284c7", // Hauts-de-France (Blue)
  44: "#7c3aed", // Grand Est (Purple)
  52: "#10b981", // Pays de la Loire (Teal)
  53: "#2563eb", // Bretagne (Royal Blue)
  75: "#0d9488", // Nouvelle-Aquitaine (Teal/Green)
  76: "#ea580c", // Occitanie (Red-Orange)
  84: "#4f46e5", // Auvergne-Rhône-Alpes (Indigo)
  93: "#db2777", // Provence-Alpes-Côte d'Azur (Pink)
  94: "#4b5563", // Corse (Grey)
  "01": "#06b6d4", // Guadeloupe
  "02": "#0891b2", // Martinique
  "03": "#0ea5e9", // Guyane
  "04": "#3b82f6", // La Réunion
  "06": "#6366f1", // Mayotte
};

/**
 * GLOBE THEMES — per-globe-theme overrides.
 *
 * IMPORTANT (theme model): the UI chrome (panels, text, accents, glass…) comes
 * entirely from the base `THEME[light|dark]` above and is SHARED by every globe
 * theme. A globe theme (satellite / blackout) must only override GLOBE-scene
 * concerns — globe material, atmosphere glow, graticules, stroke widths, label
 * colour mode, continent/department palettes. That is what keeps "switching the
 * globe theme changes the globe, not the interface" true. `getThemeColors()`
 * below merges `globeSettings` on top of the base theme, so anything NOT listed
 * here automatically stays identical across globe themes.
 */
const GLOBE_THEMES = {
  satellite: {
    globeSettings: {
      globeTextureUrl: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
      globeMaterialType: "phong",
      globeMaterialColor: "#ffffff",
      globeSpecular: "#333333",
      globeShininess: 15,
      glowColorHex: 0x3a76f0,
      glowColorHexLight: 0x3a76f0,
      glowColorHexDark: 0x2563eb,
      glowPower: 3.2,
      glowCoef: 0.22,
      graticuleOpacity: 0.25,
      useRegionalBorders: true,
      labelColorType: "paper",
      strokeWidthMobile: 0.55,
      strokeWidthDesktop: 0.75,
      isBlackoutTheme: false,
      borderFound: "#ffffff",
      borderUnfound: "#555555",
      // NOTE: no globeLabelText/Dot/Stalk override here — labels fall back to
      // textMain/accent, i.e. white in dark and ink in light. Hardcoding white
      // made labels unreadable on the light (day) satellite globe.
    },
    continents: DEFAULT_CONTINENT_COLORS,
    departments: {
      type: "colorful",
      colors: DEFAULT_DEPARTMENT_COLORS,
    },
  },
  blackout: {
    globeSettings: {
      globeMaterialType: "basic",
      globeMaterialColor: "#0b0b0e",
      isBlackoutTheme: true,
      polyMatMatte: true,
      polyMatEmissiveIntensityFoundLight: 0.22,
      polyMatEmissiveIntensityFoundDark: 0.52,
      glowColorHexLight: 0xbbbbbb,
      glowColorHexDark: 0x777777,
      glowPower: 0.8,
      glowCoef: 0.45,
      graticuleOpacity: 0.12,
      labelColorType: "paper",
      strokeWidthMobile: 1.1,
      strokeWidthDesktop: 1.6,
      selectionRingColor: "#ffffff",
    },
    continents: {
      surface: {
        light: {
          Europe: "#4a4a4a",
          Americas: "#636363",
          Asia: "#7c7c7c",
          Africa: "#969696",
          Oceania: "#b0b0b0",
          Antarctic: "#c9c9c9",
          France: "#4a4a4a",
          Unknown: "#888888",
        },
        dark: {
          Europe: "#2a2a2a",
          Americas: "#333333",
          Asia: "#3d3d3d",
          Africa: "#474747",
          Oceania: "#525252",
          Antarctic: "#5c5c5c",
          France: "#2a2a2a",
          Unknown: "#333333",
        },
      },
    },
    departments: {
      type: "monochrome",
    },
  },
};

export const GLOBE_STYLE = {
  lighting: {
    sideOpacity: { light: 0.8, dark: 0.55 },
    capOpacity: { light: 0.9, dark: 0.6 },
    selectedSideOpacity: { light: 0.9, dark: 0.7 },
    sideDarken: {
      selectedLight: 0.08,
      selectedDark: 0.12,
      foundLight: 0.06,
      foundDark: 0.08,
      baseLight: 0.04,
      baseDark: 0.06,
    },
    capPulseToPaper: { light: 0.16, dark: 0.28 },
    selectedStrokeGlow: { light: 0.42, dark: 0.5 },
    selectedEmissiveBoost: { light: 0.08, dark: 0.1 },
    strokeDarken: { light: 0.28, dark: 0.2 },
    graticuleOpacity: { light: 0.24, dark: 0.18 },
    material: {
      capEmissiveLight: 0.18,
      capEmissiveDark: 0.24,
      sideEmissiveLight: 0.05,
      sideEmissiveDark: 0.08,
      capShininessLight: 7,
      capShininessDark: 8,
      sideShininessLight: 2,
      sideShininessDark: 3,
    },
  },
  overlay: {
    darkOpacity: 0.68,
    lightOpacity: 0.48,
  },
};

// ==========================================
// 4. UTILITY FUNCTIONS
// ==========================================

export const getOpaqueThreeColor = (color, fallback = THEME.dark.paper) => {
  if (typeof color !== "string") return fallback;
  const normalized = color.trim();
  if (!normalized || normalized === "transparent") return fallback;

  const rgbaMatch = normalized.match(/^rgba\((.+)\)$/i);
  if (rgbaMatch) {
    const channels = rgbaMatch[1].split(",").map((channel) => channel.trim());
    if (channels.length >= 3) {
      return `rgb(${channels.slice(0, 3).join(", ")})`;
    }
    return fallback;
  }

  if (
    normalized.startsWith("#") ||
    normalized.startsWith("rgb(") ||
    normalized.startsWith("hsl(") ||
    normalized.startsWith("hsla(")
  ) {
    return normalized;
  }

  return fallback;
};

export const getThemeColors = (globeTheme = "satellite", systemTheme = "dark") => {
  const baseTheme = THEME[systemTheme] || THEME.dark;
  const themeCfg = GLOBE_THEMES[globeTheme] || GLOBE_THEMES.satellite;
  const globeOverrides = { ...themeCfg.globeSettings };

  if (globeTheme === "satellite") {
    globeOverrides.globeTextureUrl =
      "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
    globeOverrides.lightingRim = "#ffffff";
    globeOverrides.lightingFill = "#ffffff";
    globeOverrides.lightingGround = "#eeeeee";
    globeOverrides.lightingStudio = "#ffffff";
    globeOverrides.lightingLeft = "#cccccc";
    globeOverrides.lightingRight = "#cccccc";
    globeOverrides.glowColorHexDark = 0x3a76f0;
    globeOverrides.glowColorHexLight = 0x3a76f0;
  }

  if (globeTheme === "blackout" && systemTheme === "light") {
    globeOverrides.globeMaterialColor = "#ffffff";
  }

  return {
    ...baseTheme,
    ...globeOverrides,
  };
};

export const getThemeCssVariables = (
  systemTheme = "dark",
  globeTheme = "satellite",
  { uiScale = 1 } = {}
) => {
  const theme = getThemeColors(globeTheme, systemTheme);
  const isLight = systemTheme === "light";

  const scale = Math.max(0.72, Math.min(1.05, uiScale || 1));
  const s = (px) => `${Math.round(px * scale)}px`;

  return {
    "--bg-color": theme.bg,
    "--bg-elevated": theme.bgElevated,
    "--text-main": theme.textMain,
    "--text-muted": theme.textMuted,
    "--text-inverse": theme.textInverse,
    "--accent": theme.accent,
    "--accent-hover": theme.accentHover,
    "--accent-soft": theme.accentSoft,
    "--accent-glow": theme.accentGlow,
    "--success": theme.success,
    "--selection-highlight": theme.selectionHighlight,
    "--gold": theme.gold,
    "--warning": theme.warning,
    "--error": theme.error,
    "--glass-bg": theme.glassBg,
    "--glass-border": theme.glassBorder,
    "--glass-border-strong": theme.glassBorderStrong,
    "--glass-hover": theme.glassHover,
    "--glass-shadow": theme.glassShadow,
    "--glass-shadow-strong": theme.glassShadowStrong,
    "--glass-shadow-drag": theme.glassShadowDrag,
    "--glass-blur": STYLE_TOKENS.blur.glass,
    "--glass-blur-compact": STYLE_TOKENS.blur.glassCompact,
    "--overlay-bg": theme.overlayBg,
    "--modal-header-bg": theme.modalHeaderBg,
    "--subtle-tint": theme.subtleTint,
    "--highlight": theme.highlight,
    "--map-border": theme.mapBorder,
    "--grid-dot": theme.gridDot,
    "--radius-sm": STYLE_TOKENS.radius.sm,
    "--radius-md": STYLE_TOKENS.radius.md,
    "--radius-lg": STYLE_TOKENS.radius.lg,
    "--radius-full": STYLE_TOKENS.radius.full,
    "--spacing-xxs": STYLE_TOKENS.spacing.xxs,
    "--spacing-xs": STYLE_TOKENS.spacing.xs,
    "--spacing-sm": STYLE_TOKENS.spacing.sm,
    "--spacing-ms": STYLE_TOKENS.spacing.ms,
    "--spacing-md": STYLE_TOKENS.spacing.md,
    "--spacing-lg": STYLE_TOKENS.spacing.lg,
    "--spacing-xl": STYLE_TOKENS.spacing.xl,
    "--font-size-2xs": STYLE_TOKENS.fontSize["2xs"],
    "--font-size-xs": STYLE_TOKENS.fontSize.xs,
    "--font-size-sm": STYLE_TOKENS.fontSize.sm,
    "--font-size-md": STYLE_TOKENS.fontSize.md,
    "--font-size-base": STYLE_TOKENS.fontSize.base,
    "--font-size-lg": STYLE_TOKENS.fontSize.lg,
    "--font-size-xl": STYLE_TOKENS.fontSize.xl,
    "--transition-fast": STYLE_TOKENS.transition.fast,
    "--transition-normal": STYLE_TOKENS.transition.normal,
    "--transition-emphasized": STYLE_TOKENS.transition.emphasized,
    "--transition-layout": STYLE_TOKENS.transition.layout,
    "--transition-spring": STYLE_TOKENS.transition.spring,
    "--transition-instant": STYLE_TOKENS.transition.instant,
    // Scaled control / layout sizes (root cause of "UI ENORME on 1080p")
    "--control-sm": s(parseInt(STYLE_TOKENS.size.controlSm)),
    "--control-md": s(parseInt(STYLE_TOKENS.size.controlMd)),
    "--control-lg": s(parseInt(STYLE_TOKENS.size.controlLg)),
    "--island-width": s(parseInt(STYLE_TOKENS.size.islandWidth)),
    // Neon accents: full-glow neons are unreadable on light panels, so the
    // light theme swaps them for deep ink-compatible hues with faint glows.
    "--color-cyan": isLight ? "#0e7490" : "#00f0ff",
    "--color-magenta": isLight ? "#be185d" : "#ff007f",
    "--color-cyan-glow": isLight ? "rgba(14, 116, 144, 0.15)" : "rgba(0, 240, 255, 0.12)",
    "--color-magenta-glow": isLight ? "rgba(190, 24, 93, 0.15)" : "rgba(255, 0, 127, 0.12)",
    "--color-gold": isLight ? "#b45309" : "#ffd700",
    "--color-gold-glow": isLight ? "rgba(180, 83, 9, 0.2)" : "rgba(255, 215, 0, 0.25)",
    "--color-silver": isLight ? "#64748b" : "#c0c0c0",
    "--color-silver-glow": isLight ? "rgba(100, 116, 139, 0.2)" : "rgba(192, 192, 192, 0.25)",
    "--color-bronze": isLight ? "#92400e" : "#cd7f32",
    "--color-bronze-glow": isLight ? "rgba(146, 64, 14, 0.2)" : "rgba(205, 127, 50, 0.25)",
    "--shadow-subtle": isLight ? "rgba(28, 36, 51, 0.12)" : "rgba(0, 0, 0, 0.15)",
    "--color-cyan-glow-strong": isLight ? "rgba(14, 116, 144, 0.25)" : "rgba(0, 240, 255, 0.4)",
    "--color-lime": isLight ? "#4d7c0f" : "#a3e635",
    "--color-lime-glow-strong": isLight ? "rgba(77, 124, 15, 0.25)" : "rgba(163, 230, 53, 0.4)",
    "--color-error-glow-strong": isLight ? "rgba(255, 69, 0, 0.25)" : "rgba(255, 69, 0, 0.4)",
    "--ui-scale": scale, // fluid calc(var(--base-foo) * var(--ui-scale))
    "--globe-flag-scale": Math.max(scale, 1.12),
  };
};

/** US state sub-regions resolve to the Americas palette, like France resolves to Europe. */
const US_STATE_REGIONS = new Set(["Northeast", "Midwest", "South", "West"]);

const normalizeRegion = (region) => {
  if (region === "France") return "Europe";
  if (US_STATE_REGIONS.has(region)) return "Americas";
  return region || "Unknown";
};

const resolveThemePalette = (globeTheme) => {
  const themeCfg = GLOBE_THEMES[globeTheme] || GLOBE_THEMES.satellite;
  const palette = themeCfg.continents || GLOBE_THEMES.satellite.continents;
  return { themeCfg, palette };
};

export const getThemeRegionColor = (globeTheme, systemTheme, region) => {
  const normRegion = normalizeRegion(region);
  const { palette } = resolveThemePalette(globeTheme);
  const sysTheme = systemTheme || "dark";
  const colors = palette.surface[sysTheme];
  return colors[normRegion] || colors.Unknown || "#888888";
};

export const getThemeRegionColorAttenuated = (globeTheme, systemTheme, region) => {
  const normRegion = normalizeRegion(region);
  const { palette } = resolveThemePalette(globeTheme);
  const sysTheme = systemTheme || "dark";

  if (palette.attenuated) {
    const colors = palette.attenuated[sysTheme];
    return colors[normRegion] || colors.Unknown;
  }

  // Blackout fallbacks: programmatically blend colors to avoid browser-only CSS color-mix in ThreeJS
  const baseColor = getThemeRegionColor(globeTheme, systemTheme, normRegion);
  if (baseColor.startsWith("#")) {
    const r = parseInt(baseColor.substring(1, 3), 16);
    const g = parseInt(baseColor.substring(3, 5), 16);
    const b = parseInt(baseColor.substring(5, 7), 16);
    const factor = sysTheme === "light" ? 0.6 : 0.4;
    const mr = Math.round(r * factor);
    const mg = Math.round(g * factor);
    const mb = Math.round(b * factor);
    return `#${mr.toString(16).padStart(2, "0")}${mg.toString(16).padStart(2, "0")}${mb.toString(16).padStart(2, "0")}`;
  }
  return baseColor;
};

export const getThemeRegionColorLabel = (globeTheme, systemTheme, region) => {
  const normRegion = normalizeRegion(region);
  const { palette } = resolveThemePalette(globeTheme);
  const sysTheme = systemTheme || "dark";

  if (palette.label) {
    const colors = palette.label[sysTheme];
    return colors[normRegion] || colors.Unknown;
  }

  // Blackout fallback: use base surface color shade directly
  return getThemeRegionColor(globeTheme, systemTheme, normRegion);
};

export const getThemeDepartmentColor = (globeTheme, systemTheme, regionCode, fallbackColor) => {
  const themeCfg = GLOBE_THEMES[globeTheme] || GLOBE_THEMES.satellite;
  const deptCfg = themeCfg.departments || { type: "colorful" };

  if (deptCfg.type === "monochrome") {
    const uiColors = getThemeColors(globeTheme, systemTheme);
    return uiColors.mapSurfaceSelected || uiColors.mapBase;
  }

  const colors = deptCfg.colors || DEFAULT_DEPARTMENT_COLORS;
  return colors[regionCode] || fallbackColor;
};

export const SPACE_RGB_COMPONENTS = {
  light: {
    normal: [15, 23, 42],
    cyan: [15, 23, 42],
    magenta: [15, 23, 42],
    glitchRed: [255, 80, 80],
    glitchCyan: [80, 255, 255],
  },
  dark: {
    normal: [255, 255, 255],
    cyan: [0, 240, 255],
    magenta: [255, 0, 127],
    glitchRed: [255, 0, 110],
    glitchCyan: [0, 255, 255],
  },
};
// Standardized retro TV glitch shader effect parameters and state rules
export const GLITCH_EFFECT_SETTINGS = {
  speedTimeFactor: 28.0,
  scanlineFrequency: 15.0,
  scanlineAmplitude: 5.0,
  colorSuccess: [0.176, 1.0, 0.659],
  foundGreenSurface: "#2dffa8",
  selectionHighlight: "#2dffa8",
  foundMountainColor: "#2dffa8",
  colorError: [1.0, 0.27, 0.0], // Orange-red
  // Extruded side walls share the cap's effect pipeline, opaque and slightly
  // shaded darker so the extrusion keeps its depth cue.
  sideWallOpacity: 1.0,
  sideShadeFactor: 0.82,
  // Desktop DPR the screen-space glitch grain is tuned against; lower actual
  // ratios (mobile cap 1.25) are compensated in-shader via uPixelScale.
  referencePixelRatio: 2.0,
  noiseRangeDark: { min: 0.12, max: 0.68 },
  noiseRangeLight: { min: 0.65, max: 0.98 },
  asciiScramble: {
    glyphs: "░▒▓█▲▼◆◇@#$%&?*¢¤§[]{}<>/=+_~^0123456789XØÆßΔΩΨΞ",
    idleProbability: 0.015,
    hoverProbability: 0.08,
    updateIntervalMs: 80,
  },
  rules: {
    unfoundCap: "Transparent (opacity: 0.0) during transitions, hidden side walls",
    selectedCap: "Solid opaque cap rendering high-speed television static noise glitch",
    foundCap: "Wireframe mesh displaying high-contrast neon label color of its region",
  },
};

export const AVATAR_COLORS = {
  cyan: "#00f0ff",
  magenta: "#ff007f",
  green: "#00ff88",
  yellow: "#ffeb3b",
  purple: "#bd00ff",
  orange: "#ff5722",
  blue: "#2196f3",
  lime: "#a3e635",
  pink: "#f472b6",
  amber: "#fbbf24",
};

export const GAME_XP_COLORS = {
  greenInner: "#55ff55",
  greenOuter: "#00aa00",
  yellowInner: "#ffff55",
  yellowOuter: "#7f7f00",
};
