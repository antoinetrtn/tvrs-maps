import { useEffect, useMemo } from "react";

import { getThemeCssVariables } from "../config/designSystem";
import { BREAKPOINTS, RETIRED_STORAGE_KEYS } from "../config/gameConstants";

const uiScale = (w = BREAKPOINTS.desktop) =>
  w >= 1800 ? 0.78 : w >= 1400 ? 0.84 : w >= 1100 ? 0.9 : w >= 900 ? 0.95 : w < 520 ? 0.88 : 1;

// The game has one unified nocturnal theme: the UI chrome is always dark.
const THEME = "dark";

/**
 * CSS-variable style object of the unified theme, applied to both
 * .app-container and document.documentElement.
 */
export function useAppTheme(viewportWidth) {
  const appStyle = useMemo(
    () => getThemeCssVariables(THEME, { uiScale: uiScale(viewportWidth) }),
    [viewportWidth]
  );

  // Theme the whole document, not just .app-container: portals mounted on
  // document.body (AuthModal, ConfirmationModal…) and the body background
  // otherwise fall back to the :root first-paint tokens.
  useEffect(() => {
    const rootEl = document.documentElement;
    rootEl.dataset.theme = THEME;
    Object.entries(appStyle).forEach(([key, value]) => {
      rootEl.style.setProperty(key, String(value));
    });
  }, [appStyle]);

  useEffect(() => {
    try {
      RETIRED_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage unavailable (private mode): nothing to clean.
    }
  }, []);

  return { theme: THEME, appStyle };
}
