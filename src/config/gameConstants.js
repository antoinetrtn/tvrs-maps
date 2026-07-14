/**
 * ==========================================
 * GAME CONSTANTS — tunable, non-visual values
 * ==========================================
 *
 * Single home for the "magic numbers" and string literals that used to live
 * inline across App.jsx / GameHUD.jsx. Visual/theme tokens live in designSystem.js;
 * per-mode gameplay rules live in gameConfig.js. Anything here is a knob you can
 * safely tweak without hunting through component bodies.
 */

// --- Modes -------------------------------------------------------------------
// 'learn' is intentionally NOT in gameConfig.PLAY_MODES (it never scores/scrambles).
export const DEFAULT_MODE = "countries";

// --- Timing ------------------------------------------------------------------
export const DEFAULT_GAME_DURATION_SEC = 15 * 60; // 15 minutes

// Home-screen showcase: how often the auto-targeted demo country rotates.
export const HOME_AUTOROTATE_INTERVAL_MS = 5500;

// Mobile soft-keyboard open/close debounce.
export const KEYBOARD_CLOSE_DELAY_MS = 180;

/**
 * Transient input-feedback durations (popup success/error/warning flashes and
 * focus re-assertion delays). Grouped so the whole guessing UX can be retuned
 * in one place.
 */
export const FEEDBACK_TIMING = {
  successHoldMs: 600, // success flash before auto-advancing (free search)
  successHoldFocusedMs: 400, // success flash when a country is already focused
  flashMs: 500, // error / "already found" warning flash
  focusGlobeClickMs: 80, // delay before re-focusing input after a globe click
  focusKeyboardMs: 50, // delay before re-focusing input during navigation
};

// --- Layout breakpoints ------------------------------------------------------
// Kept in sync with the CSS media queries. `desktop` is the HUD/keyboard cutoff,
// `mobile` separates phone from tablet for the performance profile.
export const BREAKPOINTS = {
  mobile: 768,
  desktop: 1024,
};

/** Width reserved on the right for the data panel (panel + gutters). */
export function getDataPanelLayoutWidth(viewportWidth) {
  if (viewportWidth < 769) return 0;
  const panel = Math.min(380, Math.round(viewportWidth * 0.34));
  return panel + 32;
}

// --- Persistence -------------------------------------------------------------
export const STORAGE_KEYS = {
  globeTheme: "tvrs-globe-theme",
};

// --- Remote data sources -----------------------------------------------------
export const DATA_URLS = {
  countriesGeoJson: "/data/countries-50m-low.json",
  departmentsGeoJson: "/data/departements-1000m.geojson",
};

// --- Performance profile -----------------------------------------------------
// Caps and per-device tuning consumed by App's perfProfile memo.
export const PERFORMANCE = {
  maxPixelRatio: { mobile: 1.25, tablet: 1.5, desktop: 2.0 },
  maxLabels: { mobile: 4, tablet: 8, desktop: 20 },
  polygonCapCurvatureResolution: { mobile: 3.0, tablet: 2.5, desktop: 2.0 },
};
