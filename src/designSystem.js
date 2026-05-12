/**
 * Design System - Colors & Style Tokens
 */

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
    decorGlowPrimary: 'rgba(58, 118, 240, 0.1)',
    decorGlowPrimaryEnd: 'rgba(2, 6, 23, 0)',
    decorGlowSecondary: 'rgba(139, 92, 246, 0.06)',
    decorGlowSecondaryEnd: 'rgba(2, 6, 23, 0)'
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
    "Unknown": "#cbd5e1"
  },
  dark: {
    "Europe": "#3A6AAC",
    "Americas": "#AC3A3A",
    "Asia": "#9C8020",
    "Africa": "#2A8A50",
    "Oceania": "#6E3A9C",
    "Antarctic": "#2A3A5A",
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
    "Unknown": "#1e293b"
  },
  dark: {
    "Europe": "#A8C8F5",
    "Americas": "#F5A8A8",
    "Asia": "#FAE8A0",
    "Africa": "#A8EBC0",
    "Oceania": "#E0B8F5",
    "Antarctic": "#DDE4F0",
    "Unknown": "#94a3b8"
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
    "Unknown": "#e2e8f0"
  },
  dark: {
    "Europe": "#1A2D4A",
    "Americas": "#4A1A1A",
    "Asia": "#4A3D0A",
    "Africa": "#123D26",
    "Oceania": "#2D1A4A",
    "Antarctic": "#121A2D",
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

export const getThemeCssVariables = (themeName = 'dark') => {
  const theme = THEME[themeName] || THEME.dark;

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
    '--decor-glow-primary': theme.decorGlowPrimary,
    '--decor-glow-primary-end': theme.decorGlowPrimaryEnd,
    '--decor-glow-secondary': theme.decorGlowSecondary,
    '--decor-glow-secondary-end': theme.decorGlowSecondaryEnd,
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
