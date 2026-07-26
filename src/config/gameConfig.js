/**
 * Centralized per-mode game configuration.
 *
 * Everything that must stay homogeneous across modes (extrusion height, what is
 * revealed before a feature is found, relief sizing, the reveal/scramble rule)
 * lives here so a single mode can't drift visually from the others.
 */

const PLAY_MODES = ["countries", "capitals", "departments", "rivers_mountains", "us_states"];
const LEARN_SUB_MODES = ["countries", "capitals", "rivers_mountains", "departments", "us_states"];
export const DEFAULT_LEARN_SUB_MODE = "countries";

const GAME_MODES_CONFIG = {
  countries: {
    key: "countries",
    hasCustomGeometry: false,
    ghostExclusions: [],
    viewPoint: null,
    targetCheck: "name",
  },
  capitals: {
    key: "capitals",
    hasCustomGeometry: false,
    ghostExclusions: [],
    viewPoint: null,
    targetCheck: "capital",
  },
  departments: {
    key: "departments",
    hasCustomGeometry: true,
    geometryKey: "departmentsData",
    ghostExclusions: ["France"],
    viewPoint: { lat: 46.5, lng: 2.6, altitude: { mobile: 0.48, desktop: 0.3 } },
    targetCheck: "name",
  },
  us_states: {
    key: "us_states",
    hasCustomGeometry: true,
    geometryKey: "usStatesData",
    ghostExclusions: ["United States of America"],
    viewPoint: { lat: 38.0, lng: -97.0, altitude: { mobile: 0.85, desktop: 0.6 } },
    targetCheck: "name",
  },
  rivers_mountains: {
    key: "rivers_mountains",
    hasCustomGeometry: false,
    ghostExclusions: [],
    viewPoint: null,
    targetCheck: "name",
  },
};

export function getActiveModeConfig(mode, learnSubMode = DEFAULT_LEARN_SUB_MODE) {
  const activeMode = mode === "learn" ? learnSubMode : mode;
  return GAME_MODES_CONFIG[activeMode] || GAME_MODES_CONFIG.countries;
}

const LEARN_LABEL_LIMITS = { mobile: 6, tablet: 10, desktop: 16 };

/** Max labels on the globe in learn — names are always visible, keep the view sparse. */
export function getLearnLabelLimit({ isMobile, maxLabels } = {}) {
  if (isMobile) return LEARN_LABEL_LIMITS.mobile;
  if (typeof maxLabels === "number" && maxLabels <= 8) return LEARN_LABEL_LIMITS.tablet;
  return LEARN_LABEL_LIMITS.desktop;
}

export const isValidLearnSubMode = (subMode) => LEARN_SUB_MODES.includes(subMode);

// A real quiz round (not learn / home / end screen): answers are hidden until found.
export const isPlayMode = (mode, { isHomeScreen = false, isEndScreen = false } = {}) =>
  PLAY_MODES.includes(mode) && !isHomeScreen && !isEndScreen;

/** In play mode, only the active target + last validated country stay on the globe. */
export function getPlayVisibleCountryKeys(selectedCountry, foundList = []) {
  const keys = [];
  if (selectedCountry) keys.push(selectedCountry);
  const lastFound = foundList[foundList.length - 1];
  if (lastFound && lastFound !== selectedCountry) keys.push(lastFound);
  return [...new Set(keys)];
}

/** France department polygons (play mode or learn sub-mode). */
export const isDepartmentView = (mode, { learnSubMode = DEFAULT_LEARN_SUB_MODE } = {}) =>
  mode === "departments" || (mode === "learn" && learnSubMode === "departments");

/** US States polygons (play mode or learn sub-mode). */
export const isUsStatesView = (mode, { learnSubMode = DEFAULT_LEARN_SUB_MODE } = {}) =>
  mode === "us_states" || (mode === "learn" && learnSubMode === "us_states");

/** Rivers & mountains in learn sub-mode. */
export const isLearnRiversMountainsView = (mode, { learnSubMode = DEFAULT_LEARN_SUB_MODE } = {}) =>
  mode === "learn" && learnSubMode === "rivers_mountains";

/**
 * Whether a feature's NAME should be scrambled (hidden) right now. Uniform across
 * every guessable mode — countries, capitals, departments and rivers/mountains all
 * scramble the answer until it is found.
 */
export const shouldScrambleLabel = (
  mode,
  { isFound, isHomeScreen = false, isEndScreen = false, isSelected = false, isLearn = false } = {}
) => {
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
  base: 0.005,
  selected: 0.009,
  departmentBase: 0.005,
  departmentSelected: 0.007,
  ghostCountry: 0.003,
};

export const getPolygonAltitudeFor = ({ isDepartmentMode, isGhostCountry, isSelected }) => {
  if (isDepartmentMode && isGhostCountry) return POLYGON_ALTITUDE.ghostCountry;
  if (isSelected)
    return isDepartmentMode ? POLYGON_ALTITUDE.departmentSelected : POLYGON_ALTITUDE.selected;
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
  mountainScale: 0.62, // found: stable, geographically-representative size
  targetHintScale: 0.5, // unfound: neutral, still clearly visible/clickable
};

/** Shader dissolve when deselecting a country (ms). Kept in sync with polygon altitude tween. */
export const GLITCH_SELECTION_TRANSITION_MS = 360;

/**
 * Smooth 0→1 dissolve curve (smootherstep). The previous version lingered in a
 * heavy-glitch hold, then burst with a sine stutter and snapped to the target —
 * which read as a brutal, jittery deselect. A monotonic S-curve dissolves the
 * country gracefully; the digital character now comes only from the shader's
 * noise threshold, not from a jerky timeline.
 */
export const getDeselectGlitchFadeProgress = (
  elapsedMs,
  durationMs = GLITCH_SELECTION_TRANSITION_MS
) => {
  const t = Math.min(1, Math.max(0, elapsedMs / Math.max(1, durationMs)));
  return t * t * t * (t * (t * 6 - 15) + 10);
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
