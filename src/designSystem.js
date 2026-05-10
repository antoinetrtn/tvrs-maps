/**
 * Design System - Colors & Style Tokens
 */

export const THEME = {
  light: {
    bg: '#f8fafc',
    textMain: '#0f172a',
    textMuted: '#64748b',
    accent: '#334155',
    accentHover: '#1e293b',
    accentSoft: 'rgba(51, 65, 85, 0.1)',
    glassBg: 'rgba(255, 255, 255, 0.8)',
    glassBorder: 'rgba(15, 23, 42, 0.08)',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    mapBase: '#e2e8f0',
    mapSea: '#cbd5e1',
    mapBorder: '#94a3b8'
  },
  dark: {
    bg: '#020617',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    accent: '#f8fafc',
    accentHover: '#ffffff',
    accentSoft: 'rgba(248, 250, 252, 0.1)',
    glassBg: 'rgba(15, 23, 42, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    mapBase: '#1e293b',
    mapSea: '#0f172a',
    mapBorder: '#334155'
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
    normal: '0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }
};
