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
    "Europe": "#86b7f5",
    "Americas": "#7fcc9a",
    "Asia": "#ef9a9a",
    "Africa": "#e8c76c",
    "Oceania": "#c5a0f2",
    "Antarctic": "#d4dde8",
    "Unknown": "#cbd5e1"
  },
  dark: {
    "Europe": "#3b82f6",
    "Americas": "#22c55e",
    "Asia": "#ef4444",
    "Africa": "#eab308",
    "Oceania": "#a855f7",
    "Antarctic": "#94a3b8",
    "Unknown": "#64748b"
  }
};

export const CONTINENT_COLORS_LABELS = {
  light: {
    "Europe": "#1e40af",
    "Americas": "#166534",
    "Asia": "#991b1b",
    "Africa": "#854d0e",
    "Oceania": "#6b21a8",
    "Antarctic": "#334155",
    "Unknown": "#1e293b"
  },
  dark: {
    "Europe": "#93c5fd",
    "Americas": "#86efac",
    "Asia": "#fca5a5",
    "Africa": "#fde047",
    "Oceania": "#d8b4fe",
    "Antarctic": "#cbd5e1",
    "Unknown": "#94a3b8"
  }
};

export const CONTINENT_COLORS_ATTENUATED = {
  light: {
    "Europe": "#b8d4f9",
    "Americas": "#b2e0c2",
    "Asia": "#f5c7c7",
    "Africa": "#f1e1b2",
    "Oceania": "#e2d1f9",
    "Antarctic": "#e8eef4",
    "Unknown": "#e2e8f0"
  },
  dark: {
    "Europe": "#254b8a",
    "Americas": "#1b5e35",
    "Asia": "#7a2d2d",
    "Africa": "#7a6321",
    "Oceania": "#5c3b8a",
    "Antarctic": "#4a545e",
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
