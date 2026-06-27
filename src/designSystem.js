/**
 * Design System - Colors, Themes & Style Tokens
 */

export const THEMES_LIST = [
  { id: "satellite", name_fr: "Satellite", name_en: "Satellite" },
  { id: "blackout", name_fr: "Noir & Blanc", name_en: "Blacked Out" },
];

export const THEME = {
  light: {
    bg: "#f1f5f9",
    bgElevated: "#ffffff",
    bgGradientStart: "#f1f5f9",
    bgGradientEnd: "#f8fafc",
    textMain: "#0f172a",
    textMuted: "#475569",
    textInverse: "#ffffff",
    ink: "#0f172a",
    paper: "#ffffff",
    black: "#000000",
    accent: "#2563eb",
    accentHover: "#1d4ed8",
    accentSoft: "rgba(37, 99, 235, 0.1)",
    accentGlow: "#60a5fa",
    accentContrast: "#ffffff",
    glassBg: "rgba(255, 255, 255, 0.8)",
    glassBorder: "rgba(15, 23, 42, 0.08)",
    glassBorderStrong: "rgba(15, 23, 42, 0.16)",
    glassHover: "rgba(15, 23, 42, 0.05)",
    glassShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
    glassShadowStrong: "0 24px 58px rgba(15, 23, 42, 0.1)",
    glassShadowDrag: "0 34px 86px rgba(15, 23, 42, 0.14)",
    overlayBg: "rgba(241, 245, 249, 0.6)",
    modalHeaderBg: "rgba(255, 255, 255, 0.4)",
    subtleTint: "rgba(15, 23, 42, 0.05)",
    subtleTintStrong: "rgba(15, 23, 42, 0.1)",
    highlight: "rgba(255, 255, 255, 0.28)",
    highlightSoft: "rgba(255, 255, 255, 0.12)",
    success: "#10b981",
    successSoft: "rgba(16, 185, 129, 0.1)",
    gold: "#fbbf24",
    goldSoft: "rgba(251, 191, 36, 0.1)",
    goldLight: "#fde68a",
    error: "#ef4444",
    errorSoft: "rgba(239, 68, 68, 0.1)",
    errorSoftStrong: "rgba(239, 68, 68, 0.2)",
    errorGlow: "rgba(239, 68, 68, 0.4)",
    errorGlowStrong: "rgba(239, 68, 68, 0.6)",
    errorDeep: "#991b1b",
    errorDeeper: "#7f1d1d",
    errorMuted: "#dc7f7f",
    warning: "#f59e0b",
    warningSoft: "rgba(245, 158, 11, 0.1)",
    mapBase: "#ffffff",
    mapSea: "#e2e8f0",
    mapBorder: "#cbd5e1",
    mapBorderMuted: "#94a3b8",
    gridDot: "rgba(15, 23, 42, 0.2)",
    graticule: "#64748b",
    atmosphere: "#b0e2ff",
    globeEmissive: "#dbeafe",
    globeSpecular: "#dbeafe",
    globeInnerGlow: "#93c5fd",
    lightingRim: "#60a5fa",
    lightingFill: "#dbeafe",
    lightingGround: "#e2e8f0",
    lightingStudio: "#e0f2fe",
    lightingLeft: "#ffffff",
    lightingRight: "#bfdbfe",
    departmentLabelBg: "rgba(255, 255, 255, 0.92)",
    departmentLabelBorder: "rgba(15, 23, 42, 0.14)",
    departmentLabelDotShadow: "0 2px 8px rgba(0, 0, 0, 0.28)",
    departmentLabelShadow: "0 8px 20px rgba(0, 0, 0, 0.18)",
    departmentLabelInsetShadow: "0 0 0 1px rgba(255, 255, 255, 0.1) inset",
    decorGlowPrimary: "rgba(255, 255, 255, 0.7)",
    decorGlowPrimaryEnd: "rgba(241, 245, 249, 0)",
    decorGlowSecondary: "rgba(255, 255, 255, 0.5)",
    decorGlowSecondaryEnd: "rgba(241, 245, 249, 0)",
    riverActive: "#0ea5e9",
    riverInactive: "rgba(56, 189, 248, 0.45)",
    riverSelectedFound: "#10b981",
    riverSelectedUnfound: "rgba(56, 189, 248, 0.75)",
  },
  dark: {
    bg: "#020617",
    bgElevated: "#020617",
    bgGradientStart: "#020617",
    bgGradientEnd: "#020617",
    textMain: "#f8fafc",
    textMuted: "#94a3b8",
    textInverse: "#020617",
    ink: "#020617",
    paper: "#ffffff",
    black: "#000000",
    accent: "#f8fafc",
    accentHover: "#ffffff",
    accentSoft: "rgba(248, 250, 252, 0.1)",
    accentGlow: "#60a5fa",
    accentContrast: "#020617",
    glassBg: "rgba(15, 23, 42, 0.7)",
    glassBorder: "rgba(255, 255, 255, 0.1)",
    glassBorderStrong: "rgba(255, 255, 255, 0.2)",
    glassHover: "rgba(255, 255, 255, 0.05)",
    glassShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
    glassShadowStrong: "0 24px 58px rgba(0, 0, 0, 0.34)",
    glassShadowDrag: "0 34px 86px rgba(0, 0, 0, 0.44)",
    overlayBg: "rgba(2, 6, 23, 0.8)",
    modalHeaderBg: "rgba(15, 23, 42, 0.4)",
    subtleTint: "rgba(255, 255, 255, 0.05)",
    subtleTintStrong: "rgba(255, 255, 255, 0.1)",
    highlight: "rgba(255, 255, 255, 0.12)",
    highlightSoft: "rgba(255, 255, 255, 0.04)",
    success: "#10b981",
    successSoft: "rgba(16, 185, 129, 0.1)",
    gold: "#fbbf24",
    goldSoft: "rgba(251, 191, 36, 0.1)",
    goldLight: "#fde68a",
    error: "#ef4444",
    errorSoft: "rgba(239, 68, 68, 0.1)",
    errorSoftStrong: "rgba(239, 68, 68, 0.2)",
    errorGlow: "rgba(239, 68, 68, 0.4)",
    errorGlowStrong: "rgba(239, 68, 68, 0.6)",
    errorDeep: "#991b1b",
    errorDeeper: "#7f1d1d",
    errorMuted: "#991b1b",
    warning: "#f59e0b",
    warningSoft: "rgba(245, 158, 11, 0.1)",
    mapBase: "#2a3a4f",
    mapSea: "#0a1425",
    mapBorder: "#475569",
    mapBorderMuted: "#334155",
    gridDot: "rgba(255, 255, 255, 0.15)",
    graticule: "#d3d3d3",
    atmosphere: "#3a76f0",
    globeEmissive: "#0ea5e9",
    globeSpecular: "#67e8f9",
    globeInnerGlow: "#38bdf8",
    lightingRim: "#7dd3fc",
    lightingFill: "#93c5fd",
    lightingGround: "#1e293b",
    lightingStudio: "#b9d8ff",
    lightingLeft: "#dbeafe",
    lightingRight: "#93c5fd",
    departmentLabelBg: "rgba(2, 6, 23, 0.82)",
    departmentLabelBorder: "rgba(255, 255, 255, 0.18)",
    departmentLabelDotShadow: "0 2px 8px rgba(0, 0, 0, 0.28)",
    departmentLabelShadow: "0 8px 20px rgba(0, 0, 0, 0.18)",
    departmentLabelInsetShadow: "0 0 0 1px rgba(255, 255, 255, 0.1) inset",
    decorGlowPrimary: "rgba(58, 118, 240, 0.1)",
    decorGlowPrimaryEnd: "rgba(2, 6, 23, 0)",
    decorGlowSecondary: "rgba(139, 92, 246, 0.06)",
    decorGlowSecondaryEnd: "rgba(2, 6, 23, 0)",
    riverActive: "#38bdf8",
    riverInactive: "rgba(56, 189, 248, 0.55)",
    riverSelectedFound: "#34d399",
    riverSelectedUnfound: "rgba(56, 189, 248, 0.80)",
  },
};

export const GLOBE_TRANSPARENT_BACKGROUND = "rgba(0, 0, 0, 0)";

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

export const THEME_OVERRIDES = {
  glass: {},
  blueprint: {
    light: {
      bg: "#001122",
      bgElevated: "#002244",
      bgGradientStart: "#001122",
      bgGradientEnd: "#002244",
      textMain: "#00ffff",
      textMuted: "#00aaff",
      accent: "#00ffff",
      accentHover: "#80ffff",
      accentSoft: "rgba(0, 255, 255, 0.2)",
      accentGlow: "#00ffff",
      accentContrast: "#001122",
      glassBg: "rgba(0, 34, 68, 0.85)",
      glassBorder: "rgba(0, 255, 255, 0.3)",
      mapBase: "#001e3d",
      mapSea: "#000b14",
      mapBorder: "#00ffff",
      mapBorderMuted: "#003366",
      gridDot: "rgba(0, 255, 255, 0.2)",
      graticule: "#0088ff",
      atmosphere: "#0088ff",
      globeEmissive: "#000b14",
      globeSpecular: "#0088ff",
      globeInnerGlow: "#00ffff",
      lightingRim: "#00ffff",
      lightingFill: "#001e3d",
      decorGlowPrimary: "rgba(0, 255, 255, 0.25)",
      decorGlowPrimaryEnd: "rgba(0, 17, 34, 0)",
      decorGlowSecondary: "rgba(0, 170, 255, 0.15)",
      decorGlowSecondaryEnd: "rgba(0, 17, 34, 0)",
    },
    dark: {
      bg: "#001122",
      bgElevated: "#002244",
      bgGradientStart: "#001122",
      bgGradientEnd: "#002244",
      textMain: "#00ffff",
      textMuted: "#00aaff",
      accent: "#00ffff",
      accentHover: "#80ffff",
      accentSoft: "rgba(0, 255, 255, 0.2)",
      accentGlow: "#00ffff",
      accentContrast: "#001122",
      glassBg: "rgba(0, 34, 68, 0.85)",
      glassBorder: "rgba(0, 255, 255, 0.3)",
      mapBase: "#001e3d",
      mapSea: "#000b14",
      mapBorder: "#00ffff",
      mapBorderMuted: "#003366",
      gridDot: "rgba(0, 255, 255, 0.2)",
      graticule: "#0088ff",
      atmosphere: "#0088ff",
      globeEmissive: "#000b14",
      globeSpecular: "#0088ff",
      globeInnerGlow: "#00ffff",
      lightingRim: "#00ffff",
      lightingFill: "#001e3d",
      decorGlowPrimary: "rgba(0, 255, 255, 0.25)",
      decorGlowPrimaryEnd: "rgba(0, 17, 34, 0)",
      decorGlowSecondary: "rgba(0, 170, 255, 0.15)",
      decorGlowSecondaryEnd: "rgba(0, 17, 34, 0)",
    },
  },
  satellite: {
    light: {
      bg: "#030712",
      bgElevated: "#0b0f19",
      bgGradientStart: "#030712",
      bgGradientEnd: "#0b0f19",
      textMain: "#f9fafb",
      textMuted: "#9ca3af",
      accent: "#10b981",
      accentHover: "#34d399",
      accentSoft: "rgba(16, 185, 129, 0.18)",
      accentGlow: "#059669",
      accentContrast: "#ffffff",
      glassBg: "rgba(11, 15, 25, 0.85)",
      glassBorder: "rgba(16, 185, 129, 0.25)",
      mapBase: "rgba(255, 255, 255, 0.1)",
      mapSea: "#000814",
      mapBorder: "#10b981",
      mapBorderMuted: "rgba(16, 185, 129, 0.25)",
      gridDot: "rgba(16, 185, 129, 0.15)",
      graticule: "rgba(16, 185, 129, 0.25)",
      atmosphere: "#10b981",
      globeEmissive: "#000814",
      globeSpecular: "#10b981",
      globeInnerGlow: "#10b981",
      lightingRim: "#34d399",
      lightingFill: "#000814",
      decorGlowPrimary: "rgba(16, 185, 129, 0.15)",
      decorGlowPrimaryEnd: "rgba(3, 7, 18, 0)",
      decorGlowSecondary: "rgba(14, 165, 233, 0.08)",
      decorGlowSecondaryEnd: "rgba(3, 7, 18, 0)",
    },
    dark: {
      bg: "#030712",
      bgElevated: "#0b0f19",
      bgGradientStart: "#030712",
      bgGradientEnd: "#0b0f19",
      textMain: "#f9fafb",
      textMuted: "#9ca3af",
      accent: "#10b981",
      accentHover: "#34d399",
      accentSoft: "rgba(16, 185, 129, 0.18)",
      accentGlow: "#059669",
      accentContrast: "#ffffff",
      glassBg: "rgba(11, 15, 25, 0.85)",
      glassBorder: "rgba(16, 185, 129, 0.25)",
      mapBase: "rgba(255, 255, 255, 0.1)",
      mapSea: "#000814",
      mapBorder: "#10b981",
      mapBorderMuted: "rgba(16, 185, 129, 0.25)",
      gridDot: "rgba(16, 185, 129, 0.15)",
      graticule: "rgba(16, 185, 129, 0.25)",
      atmosphere: "#10b981",
      globeEmissive: "#000814",
      globeSpecular: "#10b981",
      globeInnerGlow: "#10b981",
      lightingRim: "#34d399",
      lightingFill: "#000814",
      decorGlowPrimary: "rgba(16, 185, 129, 0.15)",
      decorGlowPrimaryEnd: "rgba(3, 7, 18, 0)",
      decorGlowSecondary: "rgba(14, 165, 233, 0.08)",
      decorGlowSecondaryEnd: "rgba(3, 7, 18, 0)",
    },
  },
  blackout: {
    light: {
      bg: "#ffffff",
      bgElevated: "#f1f5f9",
      bgGradientStart: "#ffffff",
      bgGradientEnd: "#f8fafc",
      textMain: "#000000",
      textMuted: "#666666",
      accent: "#000000",
      accentHover: "#333333",
      accentSoft: "rgba(0, 0, 0, 0.08)",
      accentGlow: "#000000",
      accentContrast: "#ffffff",
      success: "#000000",
      successSoft: "rgba(0, 0, 0, 0.08)",
      error: "#888888",
      errorSoft: "rgba(0, 0, 0, 0.04)",
      warning: "#888888",
      warningSoft: "rgba(0, 0, 0, 0.04)",
      glassBg: "rgba(255, 255, 255, 0.85)",
      glassBorder: "rgba(0, 0, 0, 0.12)",
      glassBorderStrong: "rgba(0, 0, 0, 0.24)",
      glassHover: "rgba(0, 0, 0, 0.04)",
      mapBase: "#f0f0f0",
      mapSea: "#ffffff",
      mapBorder: "#cccccc",
      mapBorderMuted: "#e5e5e5",
      gridDot: "rgba(0, 0, 0, 0.08)",
      graticule: "#dddddd",
      atmosphere: "#e0e0e0",
      globeEmissive: "#ffffff",
      globeSpecular: "#ffffff",
      globeInnerGlow: "#e2e8f0",
      lightingRim: "#dddddd",
      lightingFill: "#ffffff",
      decorGlowPrimary: "rgba(0, 0, 0, 0.04)",
      decorGlowPrimaryEnd: "rgba(255, 255, 255, 0)",
      decorGlowSecondary: "rgba(0, 0, 0, 0.02)",
      decorGlowSecondaryEnd: "rgba(255, 255, 255, 0)",
    },
    dark: {
      bg: "#000000",
      bgElevated: "#0f0f0f",
      bgGradientStart: "#000000",
      bgGradientEnd: "#000000",
      textMain: "#ffffff",
      textMuted: "#888888",
      accent: "#ffffff",
      accentHover: "#cccccc",
      accentSoft: "rgba(255, 255, 255, 0.15)",
      accentGlow: "#ffffff",
      accentContrast: "#000000",
      success: "#ffffff",
      successSoft: "rgba(255, 255, 255, 0.12)",
      error: "#888888",
      errorSoft: "rgba(255, 255, 255, 0.05)",
      warning: "#888888",
      warningSoft: "rgba(255, 255, 255, 0.05)",
      glassBg: "rgba(15, 15, 15, 0.85)",
      glassBorder: "rgba(255, 255, 255, 0.15)",
      glassBorderStrong: "rgba(255, 255, 255, 0.3)",
      glassHover: "rgba(255, 255, 255, 0.05)",
      mapBase: "#0d0d0d",
      mapSea: "#0b0b0e",
      mapBorder: "#888888",
      mapBorderMuted: "#444444",
      gridDot: "rgba(255, 255, 255, 0.1)",
      graticule: "#333333",
      atmosphere: "#111111",
      globeEmissive: "#000000",
      globeSpecular: "#000000",
      globeInnerGlow: "#000000",
      lightingRim: "#222222",
      lightingFill: "#000000",
      decorGlowPrimary: "rgba(255, 255, 255, 0.05)",
      decorGlowPrimaryEnd: "rgba(0, 0, 0, 0)",
      decorGlowSecondary: "rgba(255, 255, 255, 0.02)",
      decorGlowSecondaryEnd: "rgba(0, 0, 0, 0)",
    },
  },
};

export const GLOBE_STYLE = {
  lighting: {
    sideOpacity: {
      light: 0.8,
      dark: 0.55,
    },
    capOpacity: {
      light: 0.9,
      dark: 0.6,
    },
    selectedSideOpacity: {
      light: 0.9,
      dark: 0.7,
    },
    sideDarken: {
      selectedLight: 0.08,
      selectedDark: 0.12,
      foundLight: 0.06,
      foundDark: 0.08,
      baseLight: 0.04,
      baseDark: 0.06,
    },
    capPulseToPaper: {
      light: 0.16,
      dark: 0.28,
    },
    selectedStrokeGlow: {
      light: 0.42,
      dark: 0.5,
    },
    selectedEmissiveBoost: {
      light: 0.08,
      dark: 0.1,
    },
    strokeDarken: {
      light: 0.28,
      dark: 0.2,
    },
    graticuleOpacity: {
      light: 0.24,
      dark: 0.08,
    },
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

export const CONTINENT_COLORS = {
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
};

export const FRENCH_REGION_COLORS = {
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

export const FRENCH_REGION_SYNTHWAVE_COLORS = [
  "#ff007f",
  "#00f0ff",
  "#ffea00",
  "#9d4edd",
  "#00ff66",
];
export const FRENCH_REGION_VINTAGE_COLORS = [
  "#e59866",
  "#a9dfbf",
  "#f9e79f",
  "#f5cbf7",
  "#a3e4d7",
  "#d5dbdb",
];
export const FRENCH_REGION_AURORA_COLORS_LIGHT = [
  "#a5f3fc",
  "#99f6e4",
  "#a7f3d0",
  "#c7d2fe",
  "#e9d5ff",
];
export const FRENCH_REGION_AURORA_COLORS_DARK = [
  "#0891b2",
  "#0d9488",
  "#059669",
  "#4f46e5",
  "#7c3aed",
];

export const CONTINENT_COLORS_LABELS = {
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
};

export const CONTINENT_COLORS_ATTENUATED = {
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
};

export const STYLE_TOKENS = {
  radius: {
    sm: "10px",
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

export const getThemeCssVariables = (
  systemTheme = "dark",
  globeTheme = "glass",
  selectedCountry = null,
  activeDataMap = null,
) => {
  const baseTheme = THEME[systemTheme] || THEME.dark;
  const overrides = THEME_OVERRIDES[globeTheme]?.[systemTheme] || {};
  // Theme overrides merged
  const theme = {
    ...baseTheme,
    ...overrides,
  };

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
    "--gold-soft": theme.goldSoft,
    "--gold-light": theme.goldLight,
    "--warning": theme.warning,
    "--warning-soft": theme.warningSoft,
    "--error": theme.error,
    "--error-soft": theme.errorSoft,
    "--error-soft-strong": theme.errorSoftStrong,
    "--error-glow": theme.errorGlow,
    "--error-glow-strong": theme.errorGlowStrong,
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
    "--department-label-border": theme.departmentLabelBorder,
    "--department-label-dot-shadow": theme.departmentLabelDotShadow,
    "--department-label-shadow": theme.departmentLabelShadow,
    "--department-label-inset-shadow": theme.departmentLabelInsetShadow,
    "--decor-glow-primary": theme.decorGlowPrimary,
    "--decor-glow-primary-end": theme.decorGlowPrimaryEnd,
    "--decor-glow-secondary": theme.decorGlowSecondary,
    "--decor-glow-secondary-end": theme.decorGlowSecondaryEnd,
    "--theme-dot-glass": "#0ea5e9",
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

export const SURFACE_THEME_COLORS = {
  blueprint: {
    base: "#00bfff",
  },
  blackout: {
    base: "#ffffff",
    light: "#111111",
    dark: "#ffffff",
  },
};

export const STROKE_THEME_COLORS = {
  blueprint: {
    unfound: "rgba(0, 240, 255, 0.2)",
    found: "#00ffff",
  },
  satellite: {
    unfound: "rgba(255, 255, 255, 0.25)",
    found: "#10b981",
  },
  blackout: {
    unfound: "#666666",
    found: "#ffffff",
  },
};

export const ATMOSPHERE_THEME_COLORS = {
  blueprint: "#00ffff",
  satellite: "#10b981",
  blackout: "#555555",
};

export const BLUEPRINT_REGION_COLORS_ATTENUATED = {
  light: {
    Europe: "#e6ffff",
    Americas: "#e6ffff",
    Africa: "#e6ffff",
    Asia: "#e6ffff",
    Oceania: "#e6ffff",
    Antarctic: "#e6ffff",
    Unknown: "#e6ffff",
  },
  dark: {
    Europe: "#002b3d",
    Americas: "#002b3d",
    Africa: "#002b3d",
    Asia: "#002b3d",
    Oceania: "#002b3d",
    Antarctic: "#002b3d",
    Unknown: "#002b3d",
  },
};

export const BLACKOUT_CONTINENT_COLORS = {
  light: {
    Europe: "#4a4a4a",
    Americas: "#636363",
    Asia: "#7c7c7c",
    Africa: "#969696",
    Oceania: "#b0b0b0",
    Antarctic: "#c9c9c9",
    Unknown: "#888888",
  },
  dark: {
    Europe: "#eeeeee",
    Americas: "#d4d4d4",
    Asia: "#bbbbbb",
    Africa: "#a1a1a1",
    Oceania: "#888888",
    Antarctic: "#6e6e6e",
    Unknown: "#cccccc",
  },
};

export const getThemeRegionColor = (globeTheme, systemTheme, region) => {
  if (region === "France") {
    region = "Europe";
  }

  if (globeTheme === "blueprint") {
    return SURFACE_THEME_COLORS.blueprint.base || "#00ffff";
  }
  if (globeTheme === "blackout") {
    return (
      BLACKOUT_CONTINENT_COLORS[systemTheme]?.[region] ||
      BLACKOUT_CONTINENT_COLORS[systemTheme]?.Unknown ||
      "#888888"
    );
  }
  return (
    CONTINENT_COLORS[systemTheme]?.[region] ||
    CONTINENT_COLORS[systemTheme]?.Unknown
  );
};

export const getThemeRegionColorAttenuated = (
  globeTheme,
  systemTheme,
  region,
) => {
  if (region === "France") {
    region = "Europe";
  }

  if (globeTheme === "blueprint") {
    return (
      BLUEPRINT_REGION_COLORS_ATTENUATED[systemTheme]?.[region] ||
      BLUEPRINT_REGION_COLORS_ATTENUATED[systemTheme]?.Unknown ||
      "#002b3d"
    );
  }
  if (globeTheme === "blackout") {
    const baseColor =
      BLACKOUT_CONTINENT_COLORS[systemTheme]?.[region] ||
      BLACKOUT_CONTINENT_COLORS[systemTheme]?.Unknown ||
      "#888888";
    return systemTheme === "light"
      ? `color-mix(in srgb, ${baseColor} 50%, #ffffff)`
      : `color-mix(in srgb, ${baseColor} 40%, #000000)`;
  }
  return (
    CONTINENT_COLORS_ATTENUATED[systemTheme]?.[region] ||
    CONTINENT_COLORS_ATTENUATED[systemTheme]?.Unknown
  );
};

export const getThemeRegionColorLabel = (globeTheme, systemTheme, region) => {
  if (region === "France") {
    region = "Europe";
  }

  if (globeTheme === "blueprint") {
    return "#00ffff";
  }
  if (globeTheme === "blackout") {
    return (
      BLACKOUT_CONTINENT_COLORS[systemTheme]?.[region] ||
      BLACKOUT_CONTINENT_COLORS[systemTheme]?.Unknown ||
      "#888888"
    );
  }
  return (
    CONTINENT_COLORS_LABELS[systemTheme]?.[region] ||
    CONTINENT_COLORS_LABELS[systemTheme]?.Unknown
  );
};
