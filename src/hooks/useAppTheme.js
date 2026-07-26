import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_GLOBE_THEME, getThemeCssVariables, GLOBE_THEME_IDS } from "../config/designSystem";
import { BREAKPOINTS, STORAGE_KEYS } from "../config/gameConstants";

// UI theme resolution outside blackout: the persisted user choice
// (STORAGE_KEYS.uiTheme) wins, then the OS preference.
const resolvePreferredUiTheme = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.uiTheme);
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
};

const uiScale = (w = BREAKPOINTS.desktop) =>
  w >= 1800 ? 0.78 : w >= 1400 ? 0.84 : w >= 1100 ? 0.9 : w >= 900 ? 0.95 : w < 520 ? 0.88 : 1;

/**
 * UI theme (dark/light chrome) + globe theme state, and the CSS-variable
 * style object applied to both .app-container and document.documentElement.
 */
export function useAppTheme(viewportWidth) {
  // Blackout globe forces dark chrome; anything else follows the preference.
  const [theme, setThemeRaw] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.globeTheme);
      if (!cached || cached === "blackout") return "dark";
    } catch {}
    return resolvePreferredUiTheme();
  });

  // User-facing setter: persists the choice so it survives reloads.
  const setTheme = useCallback((t) => {
    setThemeRaw(t);
    try {
      localStorage.setItem(STORAGE_KEYS.uiTheme, t);
    } catch {}
  }, []);

  const [globeTheme, setGlobeThemeRaw] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.globeTheme);
      if (cached && GLOBE_THEME_IDS.includes(cached)) return cached;
    } catch {}
    return DEFAULT_GLOBE_THEME;
  });

  const setGlobeTheme = useCallback((t) => {
    setGlobeThemeRaw(t);
    // Blackout forces dark chrome (without erasing the stored preference);
    // leaving blackout restores the user's preferred UI theme.
    setThemeRaw(t === "blackout" ? "dark" : resolvePreferredUiTheme());
    try {
      localStorage.setItem(STORAGE_KEYS.globeTheme, t);
    } catch {}
  }, []);

  const appStyle = useMemo(
    () => getThemeCssVariables(theme, globeTheme, { uiScale: uiScale(viewportWidth) }),
    [theme, globeTheme, viewportWidth]
  );

  // Theme the whole document, not just .app-container: portals mounted on
  // document.body (AuthModal, ConfirmationModal…) and the body background
  // otherwise fall back to the dark :root tokens when the UI theme is light.
  useEffect(() => {
    const rootEl = document.documentElement;
    rootEl.dataset.theme = theme;
    Object.entries(appStyle).forEach(([key, value]) => {
      rootEl.style.setProperty(key, String(value));
    });
  }, [theme, appStyle]);

  return { theme, setTheme, globeTheme, setGlobeTheme, appStyle };
}
