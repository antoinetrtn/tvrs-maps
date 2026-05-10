/**
 * Design System - Colors & Style Tokens
 */

export const THEME = {
  light: {
    bg: '#f8fafc',
    textMain: '#0f172a',
    textMuted: '#64748b',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentSoft: 'rgba(37, 99, 235, 0.1)',
    glassBg: 'rgba(255, 255, 255, 0.85)',
    glassBorder: 'rgba(15, 23, 42, 0.1)',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#eab308',
    mapBase: '#d9ecff',
    mapSea: '#a5c9f5',
    mapBorder: '#86aede'
  },
  dark: {
    bg: '#020205',
    textMain: '#ffffff',
    textMuted: '#94a3b8',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    accentSoft: 'rgba(59, 130, 246, 0.15)',
    glassBg: 'rgba(15, 23, 42, 0.75)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#eab308',
    mapBase: '#193456',
    mapSea: '#0a1a3a',
    mapBorder: '#31598d'
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
