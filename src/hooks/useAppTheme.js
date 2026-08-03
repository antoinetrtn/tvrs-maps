import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_GLOBE_THEME,
  getThemeCssVariables,
  isValidGlobeTheme,
} from "../config/designSystem";
import { BREAKPOINTS, STORAGE_KEYS } from "../config/gameConstants";

const uiScale = (w = BREAKPOINTS.desktop) =>
  w >= 1800 ? 0.78 : w >= 1400 ? 0.84 : w >= 1100 ? 0.9 : w >= 900 ? 0.95 : w < 520 ? 0.88 : 1;

/**
 * UI theme (dark/light chrome) + globe theme state, and the CSS-variable
 * style object applied to both .app-container and document.documentElement.
 */
export function useAppTheme(viewportWidth) {
  const [globeTheme, setGlobeThemeRaw] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.globeTheme);
      if (cached && isValidGlobeTheme(cached)) return cached;
    } catch {}
    return DEFAULT_GLOBE_THEME;
  });

  const [theme, setThemeRaw] = useState(() => {
    return "dark";
  });

  const setTheme = useCallback((t) => {
    setThemeRaw(t);
    try {
      localStorage.setItem(STORAGE_KEYS.uiTheme, t);
    } catch {}
  }, []);

  const setGlobeTheme = useCallback((t) => {
    const validTheme = t === "satellite" ? "satellite" : "blackout";
    setGlobeThemeRaw(validTheme);
    const targetUiTheme = "dark";
    setThemeRaw(targetUiTheme);
    try {
      localStorage.setItem(STORAGE_KEYS.globeTheme, validTheme);
      localStorage.setItem(STORAGE_KEYS.uiTheme, targetUiTheme);
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
