/**
 * ==========================================
 * DESIGN SYSTEM - Colors, Themes & Style Tokens
 * ==========================================
 */

// ==========================================
// 1. DESIGN TOKENS (Base values)
// ==========================================

export const STYLE_TOKENS = {
  radius: {
    sm: "0.4px",
    md: "calc(var(--radius-sm) + var(--spacing-xs))",
    lg: "calc(var(--radius-md) + var(--spacing-xs) * 1.5)",
    xl: "calc(var(--radius-lg) + var(--spacing-sm) + var(--spacing-xs))",
    full: "9999px",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  transition: {
    fast: "0.15s cubic-bezier(0.4, 0, 0.2, 1)",
    normal: "0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    emphasized: "0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    layout: "220ms cubic-bezier(0.2, 0.9, 0.2, 1)",
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
};

// ==========================================
// 2. CORE THEMES
// ==========================================

export const THEMES_LIST = [
  { id: "satellite" },
  { id: "blackout" },
];

// Valid globe-theme ids, derived from THEMES_LIST so the list lives in one place.
export const GLOBE_THEME_IDS = THEMES_LIST.map((entry) => entry.id);

// The theme used on a fresh install (before any localStorage preference exists).
// Blackout is the dark, high-contrast default.
export const DEFAULT_GLOBE_THEME = "blackout";

export const THEME = {
  light: {
    bg: "#ffffff",
    bgElevated: "#f1f5f9",
    bgGradientStart: "#ffffff",
    bgGradientEnd: "#f8fafc",
    textMain: "#000000",
    textMuted: "#666666",
    textInverse: "#ffffff",
    ink: "#000000",
    paper: "#ffffff",
    black: "#000000",
    accent: "#000000",
    accentHover: "#333333",
    accentSoft: "rgba(0, 0, 0, 0.08)",
    accentGlow: "#000000",
    accentContrast: "#ffffff",
    glassBg: "rgba(255, 255, 255, 0.85)",
    glassBorder: "rgba(0, 0, 0, 0.12)",
    glassBorderStrong: "rgba(0, 0, 0, 0.24)",
    glassHover: "rgba(0, 0, 0, 0.04)",
    glassShadow: "0 20px 50px rgba(0, 0, 0, 0.06)",
    glassShadowStrong: "0 24px 58px rgba(0, 0, 0, 0.1)",
    glassShadowDrag: "0 34px 86px rgba(0, 0, 0, 0.14)",
    overlayBg: "rgba(255, 255, 255, 0.85)",
    modalHeaderBg: "rgba(255, 255, 255, 0.6)",
    subtleTint: "rgba(0, 0, 0, 0.05)",
    subtleTintStrong: "rgba(0, 0, 0, 0.1)",
    highlight: "rgba(0, 0, 0, 0.08)",
    highlightSoft: "rgba(0, 0, 0, 0.02)",
    success: "#000000",
    successSoft: "rgba(0, 0, 0, 0.08)",
    gold: "#666666",
    error: "#ff4500",
    errorSoft: "rgba(255, 69, 0, 0.08)",
    errorDeep: "#e63e00",
    errorDeeper: "#b33000",
    errorMuted: "#ff8a65",
    warning: "#888888",
    warningSoft: "rgba(0, 0, 0, 0.04)",
    mapBase: "#f0f0f0",
    mapSea: "#ffffff",
    mapBorder: "#cccccc",
    mapBorderMuted: "#e5e5e5",
    borderFound: "#cccccc",
    borderUnfound: "#e5e5e5",
    mapSurfaceSelected: "#111111",
    gridDot: "rgba(0, 0, 0, 0.08)",
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
    decorGlowPrimary: "rgba(0, 0, 0, 0.04)",
    decorGlowPrimaryEnd: "rgba(255, 255, 255, 0)",
    decorGlowSecondary: "rgba(0, 0, 0, 0.02)",
    decorGlowSecondaryEnd: "rgba(255, 255, 255, 0)",
    riverActive: "#0284c7",
    riverInactive: "#7dd3fc",
    riverSelectedFound: "#0284c7",
    riverSelectedUnfound: "#38bdf8",
  },
  dark: {
    bg: "#000000",
    bgElevated: "#0f0f0f",
    bgGradientStart: "#000000",
    bgGradientEnd: "#000000",
    textMain: "#ffffff",
    textMuted: "#888888",
    textInverse: "#000000",
    ink: "#ffffff",
    paper: "#000000",
    black: "#000000",
    accent: "#ffffff",
    accentHover: "#cccccc",
    accentSoft: "rgba(255, 255, 255, 0.15)",
    accentGlow: "#ffffff",
    accentContrast: "#000000",
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
    subtleTintStrong: "rgba(255, 255, 255, 0.16)",
    highlight: "rgba(255, 255, 255, 0.15)",
    highlightSoft: "rgba(255, 255, 255, 0.05)",
    success: "#ffffff",
    successSoft: "rgba(255, 255, 255, 0.15)",
    gold: "#cccccc",
    error: "#ff4500",
    errorSoft: "rgba(255, 69, 0, 0.15)",
    errorDeep: "#e63e00",
    errorDeeper: "#b33000",
    errorMuted: "#ff8a65",
    warning: "#888888",
    warningSoft: "rgba(255, 255, 255, 0.08)",
    mapBase: "#202025",
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
    decorGlowPrimary: "rgba(255, 255, 255, 0.05)",
    decorGlowPrimaryEnd: "rgba(0, 0, 0, 0)",
    decorGlowSecondary: "rgba(255, 255, 255, 0.02)",
    decorGlowSecondaryEnd: "rgba(0, 0, 0, 0)",
    riverActive: "#38bdf8",
    riverInactive: "#0369a1",
    riverSelectedFound: "#38bdf8",
    riverSelectedUnfound: "#bae6fd",
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
      Europe: "#eaf0f6",
      Americas: "#f6ecea",
      Asia: "#f6f0ea",
      Africa: "#eaf6ee",
      Oceania: "#f0eaf6",
      Antarctic: "#f1f4f6",
      Unknown: "#e2e8f0",
    },
    dark: {
      Europe: "#142332",
      Americas: "#321411",
      Asia: "#322711",
      Africa: "#11321c",
      Oceania: "#271132",
      Antarctic: "#151e26",
      Unknown: "#334155",
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
export const GLOBE_THEMES = {
  satellite: {
    globeSettings: {
      globeTextureUrl: "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
      globeMaterialType: "phong",
      globeMaterialColor: "#ffffff",
      globeSpecular: "#333333",
      globeShininess: 15,
      glowColorHex: 0x3a76f0,
      glowPower: 0.75,
      glowCoef: 0.35,
      graticuleOpacity: 0.25,
      useRegionalBorders: true,
      labelColorType: "paper",
      strokeWidthMobile: 0.55,
      strokeWidthDesktop: 0.75,
      isBlackoutTheme: false,
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
      glowColorHexLight: 0x3b82f6,
      glowColorHexDark: 0x1d4ed8,
      glowPower: 0.8,
      glowCoef: 0.25,
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
          Europe: "#eeeeee",
          Americas: "#d4d4d4",
          Asia: "#bbbbbb",
          Africa: "#a1a1a1",
          Oceania: "#888888",
          Antarctic: "#6e6e6e",
          France: "#eeeeee",
          Unknown: "#cccccc",
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
  const globeOverrides = { ...themeCfg.globeSettings } || {};

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
  selectedCountry = null,
  activeDataMap = null,
) => {
  const theme = getThemeColors(globeTheme, systemTheme);

  return {
    "--bg-color": theme.bg,
    "--bg-elevated": theme.bgElevated,
    "--bg-gradient-start": theme.bgGradientStart,
    "--bg-gradient-end": theme.bgGradientEnd,
    "--text-main": theme.textMain,
    "--text-muted": theme.textMuted,
    "--text-inverse": theme.textInverse,
    "--accent": theme.accent,
    "--accent-hover": theme.accentHover,
    "--accent-soft": theme.accentSoft,
    "--accent-glow": theme.accentGlow,
    "--accent-contrast": theme.accentContrast,
    "--success": theme.success,
    "--success-soft": theme.successSoft,
    "--gold": theme.gold,
    "--warning": theme.warning,
    "--error": theme.error,
    "--error-soft": theme.errorSoft,
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
    "--subtle-tint-strong": theme.subtleTintStrong,
    "--highlight": theme.highlight,
    "--highlight-soft": theme.highlightSoft,
    "--map-border": theme.mapBorder,
    "--grid-dot": theme.gridDot,
    "--decor-glow-primary": theme.decorGlowPrimary,
    "--decor-glow-primary-end": theme.decorGlowPrimaryEnd,
    "--decor-glow-secondary": theme.decorGlowSecondary,
    "--decor-glow-secondary-end": theme.decorGlowSecondaryEnd,
    "--theme-dot-satellite": "#10b981",
    "--theme-dot-blackout": "#ffffff",
    "--radius-sm": STYLE_TOKENS.radius.sm,
    "--radius-md": STYLE_TOKENS.radius.md,
    "--radius-lg": STYLE_TOKENS.radius.lg,
    "--radius-xl": STYLE_TOKENS.radius.xl,
    "--radius-full": STYLE_TOKENS.radius.full,
    "--spacing-xs": STYLE_TOKENS.spacing.xs,
    "--spacing-sm": STYLE_TOKENS.spacing.sm,
    "--spacing-md": STYLE_TOKENS.spacing.md,
    "--spacing-lg": STYLE_TOKENS.spacing.lg,
    "--spacing-xl": STYLE_TOKENS.spacing.xl,
    "--transition-fast": STYLE_TOKENS.transition.fast,
    "--transition-normal": STYLE_TOKENS.transition.normal,
    "--transition-emphasized": STYLE_TOKENS.transition.emphasized,
    "--transition-layout": STYLE_TOKENS.transition.layout,
    "--control-sm": STYLE_TOKENS.size.controlSm,
    "--control-md": STYLE_TOKENS.size.controlMd,
    "--control-lg": STYLE_TOKENS.size.controlLg,
    "--island-width": STYLE_TOKENS.size.islandWidth,
  };
};

export const getThemeRegionColor = (globeTheme, systemTheme, region) => {
  const normRegion = region === "France" ? "Europe" : (region || "Unknown");
  const themeCfg = GLOBE_THEMES[globeTheme] || GLOBE_THEMES.satellite;
  const palette = themeCfg.continents || GLOBE_THEMES.satellite.continents;
  const sysTheme = systemTheme || "dark";
  const colors = palette.surface[sysTheme];
  return colors[normRegion] || colors.Unknown || "#888888";
};

export const getThemeRegionColorAttenuated = (
  globeTheme,
  systemTheme,
  region,
) => {
  const normRegion = region === "France" ? "Europe" : (region || "Unknown");
  const themeCfg = GLOBE_THEMES[globeTheme] || GLOBE_THEMES.satellite;
  const palette = themeCfg.continents || GLOBE_THEMES.satellite.continents;
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
    if (sysTheme === "light") {
      const mr = Math.round(r * 0.5 + 255 * 0.5);
      const mg = Math.round(g * 0.5 + 255 * 0.5);
      const mb = Math.round(b * 0.5 + 255 * 0.5);
      return `#${mr.toString(16).padStart(2, '0')}${mg.toString(16).padStart(2, '0')}${mb.toString(16).padStart(2, '0')}`;
    } else {
      const mr = Math.round(r * 0.4);
      const mg = Math.round(g * 0.4);
      const mb = Math.round(b * 0.4);
      return `#${mr.toString(16).padStart(2, '0')}${mg.toString(16).padStart(2, '0')}${mb.toString(16).padStart(2, '0')}`;
    }
  }
  return baseColor;
};

export const getThemeRegionColorLabel = (globeTheme, systemTheme, region) => {
  const normRegion = region === "France" ? "Europe" : (region || "Unknown");
  const themeCfg = GLOBE_THEMES[globeTheme] || GLOBE_THEMES.satellite;
  const palette = themeCfg.continents || GLOBE_THEMES.satellite.continents;
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

/**
 * Scramble text with glitched characters for text animations.
 */
export const scrambleText = (text, seed = 0) => {
  if (!text) return "";
  const glyphs = "░▒▓█░▒▓█▲▼◆◇@#$%&?*¢¤§[]{}<>/=+_~^0123456789XØÆßΔΩΨΞ";
  return text
    .split("")
    .map((char, index) => {
      if (char === " " || char === "-" || char === "'") return char;
      const hash = Math.sin(index * 13.5 + seed * 7.1) * 10000;
      const rand = Math.abs(hash) % 1.0;
      const glyphIndex = Math.floor(rand * glyphs.length);
      return glyphs[glyphIndex];
    })
    .join("");
};

// Global RGB configurations for SpaceBackground to comply with linter rules
export const SPACE_RGB_COMPONENTS = {
  light: {
    normal: [15, 23, 42],
    cyan: [15, 23, 42],
    magenta: [15, 23, 42]
  },
  dark: {
    normal: [255, 255, 255],
    cyan: [0, 240, 255],
    magenta: [255, 0, 127]
  }
};
