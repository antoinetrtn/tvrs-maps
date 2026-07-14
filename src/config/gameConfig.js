/**
 * Centralized per-mode game configuration.
 *
 * Everything that must stay homogeneous across modes (extrusion height, what is
 * revealed before a feature is found, relief sizing, the reveal/scramble rule)
 * lives here so a single mode can't drift visually from the others.
 */

const PLAY_MODES = ['countries', 'capitals', 'departments', 'rivers_mountains'];

// A real quiz round (not learn / home / end screen): answers are hidden until found.
export const isPlayMode = (mode, { isHomeScreen = false, isEndScreen = false } = {}) =>
  PLAY_MODES.includes(mode) && !isHomeScreen && !isEndScreen;

/**
 * Whether a feature's NAME should be scrambled (hidden) right now. Uniform across
 * every guessable mode — countries, capitals, departments and rivers/mountains all
 * scramble the answer until it is found.
 */
export const shouldScrambleLabel = (mode, { isFound, isHomeScreen = false, isEndScreen = false, isSelected = false, isLearn = false } = {}) => {
  if (isLearn) return false; // learn mode reveals everything — never scramble
  if (isHomeScreen) return isSelected; // home showcases a single scrambling target
  if (!isPlayMode(mode, { isHomeScreen, isEndScreen })) return false;
  return !isFound;
};

/**
 * Polygon float / extrusion altitude above the globe surface.
 *
 * Kept low and uniform so no mode looks over-extruded. Department mode is viewed up
 * close (zoomed on France), so its selected extrusion is scaled down to read at the
 * same visual height as a country selected from the world view.
 */
export const POLYGON_ALTITUDE = {
  base: 0.0025,
  selected: 0.008,
  departmentBase: 0.0025,
  departmentSelected: 0.0038,
  ghostCountry: 0.001
};

export const getPolygonAltitudeFor = ({ isDepartmentMode, isGhostCountry, isSelected }) => {
  if (isDepartmentMode && isGhostCountry) return POLYGON_ALTITUDE.ghostCountry;
  if (isSelected) return isDepartmentMode ? POLYGON_ALTITUDE.departmentSelected : POLYGON_ALTITUDE.selected;
  return POLYGON_ALTITUDE.base;
};

/**
 * Rivers & mountains sizing.
 *
 * Every relief feature is rendered so it stays clickable, but its NAME stays hidden
 * (scrambled label, only shown when selected) so the answer isn't given away. Found
 * features are drawn at full representative size, unfound ones at a slightly smaller
 * neutral scale — close enough that finding one no longer makes it pop from a tiny
 * placeholder to full size.
 */
export const RELIEF = {
  mountainScale: 0.62,   // found: stable, geographically-representative size
  targetHintScale: 0.5   // unfound: neutral, still clearly visible/clickable
};

/** Shader dissolve when deselecting a country (ms). Kept in sync with polygon altitude tween. */
export const GLITCH_SELECTION_TRANSITION_MS = 360;

/** Stuttery 0→1 curve: linger in heavy glitch, burst, then snap to target. */
export const getDeselectGlitchFadeProgress = (elapsedMs, durationMs = GLITCH_SELECTION_TRANSITION_MS) => {
  const holdMs = Math.round(durationMs * 0.32);
  const burstMs = Math.round(durationMs * 0.48);
  if (elapsedMs <= holdMs) {
    return (elapsedMs / holdMs) * 0.22;
  }
  if (elapsedMs <= holdMs + burstMs) {
    const burstT = (elapsedMs - holdMs) / burstMs;
    return 0.22 + burstT * 0.48 + Math.sin(burstT * 28.0) * 0.04;
  }
  const settleT =
    (elapsedMs - holdMs - burstMs) /
    Math.max(1, durationMs - holdMs - burstMs);
  return 0.7 + settleT * 0.3;
};

export const DEPARTMENT_MODE_GHOST_COUNTRY_EXCLUSIONS = new Set(["France"]);

export const DEPARTMENT_MODE_FRANCE_VIEW = {
  lat: 46.5,
  lng: 2.6,
  altitude: {
    mobile: 0.48,
    desktop: 0.3,
  },
};

export const GAME_REGIONS = [
  "Europe",
  "Americas",
  "Asia",
  "Africa",
  "Oceania",
  "Antarctic",
  "France",
  "Unknown",
];

/**
 * Two-letter symbolic codes shown inside the small region gauges (HUD).
 * These are abbreviations of the canonical English region keys, not translated
 * copy — they stay identical across languages. Anything not listed falls back to
 * the first two letters of the region name (see getRegionAbbr).
 */
const REGION_ABBR = {
  Americas: "AM",
  Antarctic: "AN",
};

export const getRegionAbbr = (region) =>
  REGION_ABBR[region] || (region || "").substring(0, 2).toUpperCase();
