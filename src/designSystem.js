/**
 * Design System - Colors, Themes & Style Tokens
 */

export const THEMES_LIST = [
  { id: 'glass', name_fr: 'Verre Moderne', name_en: 'Sleek Glass' },
  { id: 'lowpoly', name_fr: 'Low-Poly Biomes', name_en: 'Low-Poly Biomes' },
  { id: 'synthwave', name_fr: 'Cyber Synthwave', name_en: 'Cyber Synthwave' },
  { id: 'vintage', name_fr: 'Cartographe Rétro', name_en: 'Retro Cartographer' },
  { id: 'blueprint', name_fr: 'Tech Hologramme', name_en: 'Tech Blueprint' }
];

export const THEME = {
  light: {
    bg: '#f1f5f9',
    bgElevated: '#ffffff',
    bgGradientStart: '#f1f5f9',
    bgGradientEnd: '#f8fafc',
    textMain: '#0f172a',
    textMuted: '#475569',
    textInverse: '#ffffff',
    ink: '#0f172a',
    paper: '#ffffff',
    black: '#000000',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentSoft: 'rgba(37, 99, 235, 0.1)',
    accentGlow: '#60a5fa',
    accentContrast: '#ffffff',
    glassBg: 'rgba(255, 255, 255, 0.8)',
    glassBorder: 'rgba(15, 23, 42, 0.08)',
    glassBorderStrong: 'rgba(15, 23, 42, 0.16)',
    glassHover: 'rgba(15, 23, 42, 0.05)',
    glassShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
    glassShadowStrong: '0 24px 58px rgba(15, 23, 42, 0.1)',
    glassShadowDrag: '0 34px 86px rgba(15, 23, 42, 0.14)',
    overlayBg: 'rgba(241, 245, 249, 0.6)',
    modalHeaderBg: 'rgba(255, 255, 255, 0.4)',
    subtleTint: 'rgba(15, 23, 42, 0.05)',
    subtleTintStrong: 'rgba(15, 23, 42, 0.1)',
    highlight: 'rgba(255, 255, 255, 0.28)',
    highlightSoft: 'rgba(255, 255, 255, 0.12)',
    success: '#10b981',
    successSoft: 'rgba(16, 185, 129, 0.1)',
    gold: '#fbbf24',
    goldSoft: 'rgba(251, 191, 36, 0.1)',
    goldLight: '#fde68a',
    error: '#ef4444',
    errorSoft: 'rgba(239, 68, 68, 0.1)',
    errorSoftStrong: 'rgba(239, 68, 68, 0.2)',
    errorGlow: 'rgba(239, 68, 68, 0.4)',
    errorGlowStrong: 'rgba(239, 68, 68, 0.6)',
    errorDeep: '#991b1b',
    errorDeeper: '#7f1d1d',
    errorMuted: '#dc7f7f',
    warning: '#f59e0b',
    warningSoft: 'rgba(245, 158, 11, 0.1)',
    mapBase: '#ffffff',
    mapSea: '#e2e8f0',
    mapBorder: '#cbd5e1',
    mapBorderMuted: '#94a3b8',
    gridDot: 'rgba(15, 23, 42, 0.2)',
    graticule: '#64748b',
    atmosphere: '#b0e2ff',
    globeEmissive: '#dbeafe',
    globeSpecular: '#dbeafe',
    globeInnerGlow: '#93c5fd',
    lightingRim: '#60a5fa',
    lightingFill: '#dbeafe',
    lightingGround: '#e2e8f0',
    lightingStudio: '#e0f2fe',
    lightingLeft: '#ffffff',
    lightingRight: '#bfdbfe',
    departmentLabelBg: 'rgba(255, 255, 255, 0.92)',
    departmentLabelBorder: 'rgba(15, 23, 42, 0.14)',
    departmentLabelDotShadow: '0 2px 8px rgba(0, 0, 0, 0.28)',
    departmentLabelShadow: '0 8px 20px rgba(0, 0, 0, 0.18)',
    departmentLabelInsetShadow: '0 0 0 1px rgba(255, 255, 255, 0.1) inset',
    beefDiagramBody: '#f8fafc',
    beefDiagramGlow: 'rgba(239, 68, 68, 0.12)',
    beefMapShadow: 'rgba(15, 23, 42, 0.14)',
    beefCutIdle: '#fee2e2',
    beefCutLine: '#991b1b',
    beefLabelBg: '#ffffff',
    decorGlowPrimary: 'rgba(255, 255, 255, 0.7)',
    decorGlowPrimaryEnd: 'rgba(241, 245, 249, 0)',
    decorGlowSecondary: 'rgba(255, 255, 255, 0.5)',
    decorGlowSecondaryEnd: 'rgba(241, 245, 249, 0)'
  },
  dark: {
    bg: '#020617',
    bgElevated: '#020617',
    bgGradientStart: '#020617',
    bgGradientEnd: '#020617',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    textInverse: '#020617',
    ink: '#020617',
    paper: '#ffffff',
    black: '#000000',
    accent: '#f8fafc',
    accentHover: '#ffffff',
    accentSoft: 'rgba(248, 250, 252, 0.1)',
    accentGlow: '#60a5fa',
    accentContrast: '#020617',
    glassBg: 'rgba(15, 23, 42, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    glassBorderStrong: 'rgba(255, 255, 255, 0.2)',
    glassHover: 'rgba(255, 255, 255, 0.05)',
    glassShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
    glassShadowStrong: '0 24px 58px rgba(0, 0, 0, 0.34)',
    glassShadowDrag: '0 34px 86px rgba(0, 0, 0, 0.44)',
    overlayBg: 'rgba(2, 6, 23, 0.8)',
    modalHeaderBg: 'rgba(15, 23, 42, 0.4)',
    subtleTint: 'rgba(255, 255, 255, 0.05)',
    subtleTintStrong: 'rgba(255, 255, 255, 0.1)',
    highlight: 'rgba(255, 255, 255, 0.12)',
    highlightSoft: 'rgba(255, 255, 255, 0.04)',
    success: '#10b981',
    successSoft: 'rgba(16, 185, 129, 0.1)',
    gold: '#fbbf24',
    goldSoft: 'rgba(251, 191, 36, 0.1)',
    goldLight: '#fde68a',
    error: '#ef4444',
    errorSoft: 'rgba(239, 68, 68, 0.1)',
    errorSoftStrong: 'rgba(239, 68, 68, 0.2)',
    errorGlow: 'rgba(239, 68, 68, 0.4)',
    errorGlowStrong: 'rgba(239, 68, 68, 0.6)',
    errorDeep: '#991b1b',
    errorDeeper: '#7f1d1d',
    errorMuted: '#991b1b',
    warning: '#f59e0b',
    warningSoft: 'rgba(245, 158, 11, 0.1)',
    mapBase: '#2a3a4f',
    mapSea: '#0a1425',
    mapBorder: '#334155',
    mapBorderMuted: '#1e293b',
    gridDot: 'rgba(255, 255, 255, 0.15)',
    graticule: '#d3d3d3',
    atmosphere: '#3a76f0',
    globeEmissive: '#0ea5e9',
    globeSpecular: '#67e8f9',
    globeInnerGlow: '#38bdf8',
    lightingRim: '#7dd3fc',
    lightingFill: '#93c5fd',
    lightingGround: '#020617',
    lightingStudio: '#b9d8ff',
    lightingLeft: '#dbeafe',
    lightingRight: '#93c5fd',
    departmentLabelBg: 'rgba(2, 6, 23, 0.82)',
    departmentLabelBorder: 'rgba(255, 255, 255, 0.18)',
    departmentLabelDotShadow: '0 2px 8px rgba(0, 0, 0, 0.28)',
    departmentLabelShadow: '0 8px 20px rgba(0, 0, 0, 0.18)',
    departmentLabelInsetShadow: '0 0 0 1px rgba(255, 255, 255, 0.1) inset',
    beefDiagramBody: '#1e293b',
    beefDiagramGlow: 'rgba(239, 68, 68, 0.1)',
    beefMapShadow: 'rgba(0, 0, 0, 0.44)',
    beefCutIdle: '#4a1a1a',
    beefCutLine: '#fca5a5',
    beefLabelBg: '#020617',
    decorGlowPrimary: 'rgba(58, 118, 240, 0.1)',
    decorGlowPrimaryEnd: 'rgba(2, 6, 23, 0)',
    decorGlowSecondary: 'rgba(139, 92, 246, 0.06)',
    decorGlowSecondaryEnd: 'rgba(2, 6, 23, 0)'
  }
};

export const GLOBE_TRANSPARENT_BACKGROUND = 'rgba(0, 0, 0, 0)';

export const getOpaqueThreeColor = (color, fallback = THEME.dark.paper) => {
  if (typeof color !== 'string') return fallback;
  const normalized = color.trim();
  if (!normalized || normalized === 'transparent') return fallback;

  const rgbaMatch = normalized.match(/^rgba\((.+)\)$/i);
  if (rgbaMatch) {
    const channels = rgbaMatch[1].split(',').map(channel => channel.trim());
    if (channels.length >= 3) {
      return `rgb(${channels.slice(0, 3).join(', ')})`;
    }
    return fallback;
  }

  if (
    normalized.startsWith('#') ||
    normalized.startsWith('rgb(') ||
    normalized.startsWith('hsl(') ||
    normalized.startsWith('hsla(')
  ) {
    return normalized;
  }

  return fallback;
};

export const THEME_OVERRIDES = {
  glass: {},
  lowpoly: {
    light: {
      mapBase: '#d9e2ec',
      mapSea: '#bcccdc',
      mapBorder: '#829ab1',
      graticule: 'rgba(98, 125, 152, 0.2)',
      globeInnerGlow: 'rgba(188, 204, 220, 0.3)'
    },
    dark: {
      mapBase: '#102a43',
      mapSea: '#07162c',
      mapBorder: '#1f3a52',
      graticule: 'rgba(31, 58, 82, 0.25)',
      globeInnerGlow: 'rgba(31, 58, 82, 0.3)'
    }
  },
  synthwave: {
    light: {
      bg: '#0f051d',
      bgElevated: '#1c0b34',
      bgGradientStart: '#0f051d',
      bgGradientEnd: '#1c0b34',
      textMain: '#00f0ff',
      textMuted: '#ff007f',
      accent: '#ff007f',
      accentHover: '#ff3399',
      glassBg: 'rgba(28, 11, 52, 0.8)',
      glassBorder: 'rgba(0, 240, 255, 0.35)',
      mapBase: '#1f0d3d',
      mapSea: '#06010f',
      mapBorder: '#ff007f',
      mapBorderMuted: '#3d0a66',
      gridDot: 'rgba(255, 0, 127, 0.25)',
      graticule: '#ff007f',
      atmosphere: '#ff007f',
      globeEmissive: '#06010f',
      globeSpecular: '#ff007f',
      globeInnerGlow: '#ff007f',
      lightingRim: '#ff007f',
      lightingFill: '#1f0d3d',
      decorGlowPrimary: 'rgba(255, 0, 127, 0.25)',
      decorGlowPrimaryEnd: 'rgba(15, 5, 29, 0)',
      decorGlowSecondary: 'rgba(0, 240, 255, 0.2)',
      decorGlowSecondaryEnd: 'rgba(15, 5, 29, 0)'
    },
    dark: {
      bg: '#0f051d',
      bgElevated: '#1c0b34',
      bgGradientStart: '#0f051d',
      bgGradientEnd: '#1c0b34',
      textMain: '#00f0ff',
      textMuted: '#ff007f',
      accent: '#ff007f',
      accentHover: '#ff3399',
      glassBg: 'rgba(28, 11, 52, 0.8)',
      glassBorder: 'rgba(0, 240, 255, 0.35)',
      mapBase: '#1f0d3d',
      mapSea: '#06010f',
      mapBorder: '#ff007f',
      mapBorderMuted: '#3d0a66',
      gridDot: 'rgba(255, 0, 127, 0.25)',
      graticule: '#ff007f',
      atmosphere: '#ff007f',
      globeEmissive: '#06010f',
      globeSpecular: '#ff007f',
      globeInnerGlow: '#ff007f',
      lightingRim: '#ff007f',
      lightingFill: '#1f0d3d',
      decorGlowPrimary: 'rgba(255, 0, 127, 0.25)',
      decorGlowPrimaryEnd: 'rgba(15, 5, 29, 0)',
      decorGlowSecondary: 'rgba(0, 240, 255, 0.2)',
      decorGlowSecondaryEnd: 'rgba(15, 5, 29, 0)'
    }
  },
  vintage: {
    light: {
      bg: '#f4ecd8',
      bgElevated: '#ebdcb9',
      bgGradientStart: '#f4ecd8',
      bgGradientEnd: '#ebdcb9',
      textMain: '#332211',
      textMuted: '#7c654e',
      accent: '#8b5a2b',
      accentHover: '#5c3a1a',
      glassBg: 'rgba(244, 236, 216, 0.9)',
      glassBorder: 'rgba(139, 90, 43, 0.22)',
      mapBase: '#fdfaf2',
      mapSea: '#dfd3b6',
      mapBorder: '#8b5a2b',
      mapBorderMuted: '#c4b595',
      gridDot: 'rgba(139, 90, 43, 0.15)',
      graticule: '#8b5a2b',
      atmosphere: '#dfd3b6',
      globeEmissive: '#dfd3b6',
      globeSpecular: '#dfd3b6',
      globeInnerGlow: '#8b5a2b',
      lightingRim: '#ebdcb9',
      lightingFill: '#dfd3b6',
      decorGlowPrimary: 'rgba(139, 90, 43, 0.15)',
      decorGlowPrimaryEnd: 'rgba(244, 236, 216, 0)',
      decorGlowSecondary: 'rgba(124, 101, 78, 0.08)',
      decorGlowSecondaryEnd: 'rgba(244, 236, 216, 0)'
    },
    dark: {
      bg: '#1f160e',
      bgElevated: '#2d2015',
      bgGradientStart: '#1f160e',
      bgGradientEnd: '#2d2015',
      textMain: '#dfd3b6',
      textMuted: '#b0a080',
      accent: '#bfae8f',
      accentHover: '#dfd3b6',
      glassBg: 'rgba(45, 32, 21, 0.85)',
      glassBorder: 'rgba(191, 174, 143, 0.2)',
      mapBase: '#2a1e14',
      mapSea: '#120d09',
      mapBorder: '#b0a080',
      mapBorderMuted: '#3d2b1d',
      gridDot: 'rgba(176, 160, 128, 0.15)',
      graticule: '#b0a080',
      atmosphere: '#120d09',
      globeEmissive: '#120d09',
      globeSpecular: '#2a1e14',
      globeInnerGlow: '#b0a080',
      lightingRim: '#2d2015',
      lightingFill: '#120d09',
      decorGlowPrimary: 'rgba(176, 160, 128, 0.1)',
      decorGlowPrimaryEnd: 'rgba(31, 22, 14, 0)',
      decorGlowSecondary: 'rgba(45, 32, 21, 0.15)',
      decorGlowSecondaryEnd: 'rgba(31, 22, 14, 0)'
    }
  },
  blueprint: {
    light: {
      bg: '#001122',
      bgElevated: '#002244',
      bgGradientStart: '#001122',
      bgGradientEnd: '#002244',
      textMain: '#00ffff',
      textMuted: '#00aaff',
      accent: '#00ffff',
      accentHover: '#80ffff',
      glassBg: 'rgba(0, 34, 68, 0.85)',
      glassBorder: 'rgba(0, 255, 255, 0.3)',
      mapBase: '#001e3d',
      mapSea: '#000b14',
      mapBorder: '#00ffff',
      mapBorderMuted: '#003366',
      gridDot: 'rgba(0, 255, 255, 0.2)',
      graticule: '#0088ff',
      atmosphere: '#0088ff',
      globeEmissive: '#000b14',
      globeSpecular: '#0088ff',
      globeInnerGlow: '#00ffff',
      lightingRim: '#00ffff',
      lightingFill: '#001e3d',
      decorGlowPrimary: 'rgba(0, 255, 255, 0.25)',
      decorGlowPrimaryEnd: 'rgba(0, 17, 34, 0)',
      decorGlowSecondary: 'rgba(0, 170, 255, 0.15)',
      decorGlowSecondaryEnd: 'rgba(0, 17, 34, 0)'
    },
    dark: {
      bg: '#001122',
      bgElevated: '#002244',
      bgGradientStart: '#001122',
      bgGradientEnd: '#002244',
      textMain: '#00ffff',
      textMuted: '#00aaff',
      accent: '#00ffff',
      accentHover: '#80ffff',
      glassBg: 'rgba(0, 34, 68, 0.85)',
      glassBorder: 'rgba(0, 255, 255, 0.3)',
      mapBase: '#001e3d',
      mapSea: '#000b14',
      mapBorder: '#00ffff',
      mapBorderMuted: '#003366',
      gridDot: 'rgba(0, 255, 255, 0.2)',
      graticule: '#0088ff',
      atmosphere: '#0088ff',
      globeEmissive: '#000b14',
      globeSpecular: '#0088ff',
      globeInnerGlow: '#00ffff',
      lightingRim: '#00ffff',
      lightingFill: '#001e3d',
      decorGlowPrimary: 'rgba(0, 255, 255, 0.25)',
      decorGlowPrimaryEnd: 'rgba(0, 17, 34, 0)',
      decorGlowSecondary: 'rgba(0, 170, 255, 0.15)',
      decorGlowSecondaryEnd: 'rgba(0, 17, 34, 0)'
    }
  }
};

export const GLOBE_STYLE = {
  lighting: {
    sideOpacity: {
      light: 0.8,
      dark: 0.55
    },
    capOpacity: {
      light: 0.9,
      dark: 0.6
    },
    selectedSideOpacity: {
      light: 0.9,
      dark: 0.7
    },
    sideDarken: {
      selectedLight: 0.08,
      selectedDark: 0.12,
      foundLight: 0.06,
      foundDark: 0.08,
      baseLight: 0.04,
      baseDark: 0.06
    },
    capPulseToPaper: {
      light: 0.16,
      dark: 0.28
    },
    selectedStrokeGlow: {
      light: 0.42,
      dark: 0.5
    },
    selectedEmissiveBoost: {
      light: 0.08,
      dark: 0.1
    },
    strokeDarken: {
      light: 0.28,
      dark: 0.2
    },
    graticuleOpacity: {
      light: 0.24,
      dark: 0.08
    },
    material: {
      capEmissiveLight: 0.18,
      capEmissiveDark: 0.24,
      sideEmissiveLight: 0.05,
      sideEmissiveDark: 0.08,
      capShininessLight: 7,
      capShininessDark: 8,
      sideShininessLight: 2,
      sideShininessDark: 3
    }
  },
  overlay: {
    darkOpacity: 0.68,
    lightOpacity: 0.48
  }
};

export const CONTINENT_COLORS = {
  light: {
    "Europe": "#7AABF0",
    "Americas": "#F5A8A8",
    "Asia": "#FAE8A0",
    "Africa": "#A8EBC0",
    "Oceania": "#E0B8F5",
    "Antarctic": "#DDE4F0",
    "Boeuf": "#FCA5A5",
    "Unknown": "#cbd5e1"
  },
  dark: {
    "Europe": "#3A6AAC",
    "Americas": "#AC3A3A",
    "Asia": "#9C8020",
    "Africa": "#2A8A50",
    "Oceania": "#6E3A9C",
    "Antarctic": "#2A3A5A",
    "Boeuf": "#991B1B",
    "Unknown": "#64748b"
  }
};

export const CONTINENT_COLORS_LABELS = {
  light: {
    "Europe": "#1A3D7A",
    "Americas": "#8C2020",
    "Asia": "#7A6000",
    "Africa": "#1A5C35",
    "Oceania": "#5A1A8C",
    "Antarctic": "#3A4A6A",
    "Boeuf": "#991B1B",
    "Unknown": "#1e293b"
  },
  dark: {
    "Europe": "#A8C8F5",
    "Americas": "#F5A8A8",
    "Asia": "#FAE8A0",
    "Africa": "#A8EBC0",
    "Oceania": "#E0B8F5",
    "Antarctic": "#DDE4F0",
    "Boeuf": "#FCA5A5",
    "Unknown": "#94a3b8"
  }
};

export const LOW_POLY_TERRAIN_COLORS = {
  light: {
    Europe: '#6fa66a',
    Americas: '#9b7a4a',
    Asia: '#b7a35d',
    Africa: '#c6a45b',
    Oceania: '#67a88b',
    Antarctic: '#d8eef2',
    France: '#78a95f',
    Unknown: '#8aa071'
  },
  dark: {
    Europe: '#315f3c',
    Americas: '#6c4f32',
    Asia: '#71652f',
    Africa: '#7a5a2a',
    Oceania: '#2f6b58',
    Antarctic: '#7ea9b8',
    France: '#3f6f38',
    Unknown: '#455f42'
  }
};

export const CONTINENT_COLORS_ATTENUATED = {
  light: {
    "Europe": "#B3CDFF",
    "Americas": "#FFD1D1",
    "Asia": "#FFF4D1",
    "Africa": "#D1F5DD",
    "Oceania": "#F0D1FF",
    "Antarctic": "#F0F4FF",
    "Boeuf": "#FEE2E2",
    "Unknown": "#e2e8f0"
  },
  dark: {
    "Europe": "#1A2D4A",
    "Americas": "#4A1A1A",
    "Asia": "#4A3D0A",
    "Africa": "#123D26",
    "Oceania": "#2D1A4A",
    "Antarctic": "#121A2D",
    "Boeuf": "#4A1A1A",
    "Unknown": "#334155"
  }
};

export const STYLE_TOKENS = {
  radius: {
    sm: '10px',
    md: '14px',
    lg: '20px',
    xl: '30px',
    full: '9999px'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px'
  },
  transition: {
    fast: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    emphasized: '0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    layout: '220ms cubic-bezier(0.2, 0.9, 0.2, 1)'
  },
  blur: {
    sm: 'blur(4px)',
    md: 'blur(12px)',
    lg: 'blur(16px)',
    glass: 'blur(24px) saturate(200%)',
    glassCompact: 'blur(12px) saturate(140%)'
  },
  size: {
    controlSm: '32px',
    controlMd: '40px',
    controlLg: '44px',
    islandWidth: '500px'
  }
};

export const getThemeCssVariables = (systemTheme = 'dark', globeTheme = 'glass') => {
  const baseTheme = THEME[systemTheme] || THEME.dark;
  const overrides = THEME_OVERRIDES[globeTheme]?.[systemTheme] || {};
  
  // Merge theme overrides
  const theme = {
    ...baseTheme,
    ...overrides
  };

  return {
    '--bg-color': theme.bg,
    '--bg-elevated': theme.bgElevated,
    '--bg-gradient-start': theme.bgGradientStart,
    '--bg-gradient-end': theme.bgGradientEnd,
    '--text-main': theme.textMain,
    '--text-muted': theme.textMuted,
    '--text-inverse': theme.textInverse,
    '--accent': theme.accent,
    '--accent-hover': theme.accentHover,
    '--accent-soft': theme.accentSoft,
    '--accent-glow': theme.accentGlow,
    '--accent-contrast': theme.accentContrast,
    '--success': theme.success,
    '--success-soft': theme.successSoft,
    '--gold': theme.gold,
    '--gold-soft': theme.goldSoft,
    '--gold-light': theme.goldLight,
    '--warning': theme.warning,
    '--warning-soft': theme.warningSoft,
    '--error': theme.error,
    '--error-soft': theme.errorSoft,
    '--error-soft-strong': theme.errorSoftStrong,
    '--error-glow': theme.errorGlow,
    '--error-glow-strong': theme.errorGlowStrong,
    '--glass-bg': theme.glassBg,
    '--glass-border': theme.glassBorder,
    '--glass-border-strong': theme.glassBorderStrong,
    '--glass-hover': theme.glassHover,
    '--glass-shadow': theme.glassShadow,
    '--glass-shadow-strong': theme.glassShadowStrong,
    '--glass-shadow-drag': theme.glassShadowDrag,
    '--glass-blur': STYLE_TOKENS.blur.glass,
    '--glass-blur-compact': STYLE_TOKENS.blur.glassCompact,
    '--overlay-bg': theme.overlayBg,
    '--modal-header-bg': theme.modalHeaderBg,
    '--subtle-tint': theme.subtleTint,
    '--subtle-tint-strong': theme.subtleTintStrong,
    '--highlight': theme.highlight,
    '--highlight-soft': theme.highlightSoft,
    '--map-border': theme.mapBorder,
    '--grid-dot': theme.gridDot,
    '--beef-diagram-body': theme.beefDiagramBody,
    '--beef-diagram-glow': theme.beefDiagramGlow,
    '--beef-map-shadow': theme.beefMapShadow,
    '--beef-cut-idle': theme.beefCutIdle,
    '--beef-cut-line': theme.beefCutLine,
    '--beef-label-bg': theme.beefLabelBg,
    '--department-label-border': theme.departmentLabelBorder,
    '--department-label-dot-shadow': theme.departmentLabelDotShadow,
    '--department-label-shadow': theme.departmentLabelShadow,
    '--department-label-inset-shadow': theme.departmentLabelInsetShadow,
    '--decor-glow-primary': theme.decorGlowPrimary,
    '--decor-glow-primary-end': theme.decorGlowPrimaryEnd,
    '--decor-glow-secondary': theme.decorGlowSecondary,
    '--decor-glow-secondary-end': theme.decorGlowSecondaryEnd,
    '--theme-dot-glass': '#0ea5e9',
    '--theme-dot-lowpoly': '#10b981',
    '--theme-dot-synthwave': '#ff007f',
    '--theme-dot-vintage': '#bfae8f',
    '--theme-dot-blueprint': '#00ffff',
    '--radius-sm': STYLE_TOKENS.radius.sm,
    '--radius-md': STYLE_TOKENS.radius.md,
    '--radius-lg': STYLE_TOKENS.radius.lg,
    '--radius-xl': STYLE_TOKENS.radius.xl,
    '--radius-full': STYLE_TOKENS.radius.full,
    '--spacing-xs': STYLE_TOKENS.spacing.xs,
    '--spacing-sm': STYLE_TOKENS.spacing.sm,
    '--spacing-md': STYLE_TOKENS.spacing.md,
    '--spacing-lg': STYLE_TOKENS.spacing.lg,
    '--spacing-xl': STYLE_TOKENS.spacing.xl,
    '--transition-fast': STYLE_TOKENS.transition.fast,
    '--transition-normal': STYLE_TOKENS.transition.normal,
    '--transition-emphasized': STYLE_TOKENS.transition.emphasized,
    '--transition-layout': STYLE_TOKENS.transition.layout,
    '--control-sm': STYLE_TOKENS.size.controlSm,
    '--control-md': STYLE_TOKENS.size.controlMd,
    '--control-lg': STYLE_TOKENS.size.controlLg,
    '--island-width': STYLE_TOKENS.size.islandWidth
  };
};
