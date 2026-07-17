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
  successFlashMs: 380, // success pixel-resolve flash before auto-advancing (drives uSuccessDuration)
  flashMs: 500, // error / "already found" warning flash
  focusGlobeClickMs: 80, // delay before re-focusing input after a globe click
  focusKeyboardMs: 50, // delay before re-focusing input during navigation
};

// --- Layout breakpoints ------------------------------------------------------
// Kept in sync with the CSS media queries. `desktop` is the HUD/keyboard cutoff,
// `mobile` separates phone from tablet for the performance profile.
// --- Auto-navigation ---------------------------------------------------------
// After a correct guess the focus advances to a nearby unfound target. Instead
// of always the single nearest (fully deterministic tours), it picks among the
// closest few with a proximity bias so runs differ while staying coherent.
export const AUTO_NAVIGATION = {
  candidatePool: 3,
  weights: [0.6, 0.25, 0.15],
};

// --- Game start view ---------------------------------------------------------
// Camera anchors a new run can land on (varied instead of always Europe),
// jittered so two runs on the same region still differ.
export const GAME_START_VIEWPOINTS = [
  { lat: 30, lng: 10 }, // Europe / Afrique du Nord
  { lat: 10, lng: 20 }, // Afrique
  { lat: 25, lng: -95 }, // Amérique du Nord
  { lat: -15, lng: -60 }, // Amérique du Sud
  { lat: 25, lng: 90 }, // Asie
  { lat: -20, lng: 140 }, // Océanie
];
export const GAME_START_VIEW_JITTER_DEG = 8;

export const BREAKPOINTS = {
  mobile: 768,
  desktop: 1024,
};

/** Width reserved on the right for the data panel (panel + gutters). */
export function getDataPanelLayoutWidth(viewportWidth) {
  if (viewportWidth < BREAKPOINTS.desktop) return 0;
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
  /** Scales globe accent lights on mobile — keeps the look, saves GPU vs full desktop. */
  mobileLightScale: 0.9,
  /** Fresnel atmosphere sphere segments (width × height). */
  innerGlowSegments: { mobile: 32, desktop: 48 },
  /** Min ms between non-urgent globe animation frames. */
  animationFrameMs: { mobile: 40, desktop: 33 },
};
