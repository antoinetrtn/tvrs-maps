/**
 * Centralized per-mode game configuration.
 *
 * Everything that must stay homogeneous across modes (extrusion height, what is
 * revealed before a feature is found, relief sizing, the reveal/scramble rule)
 * lives here so a single mode can't drift visually from the others.
 */

export const PLAY_MODES = ["countries", "capitals", "departments", "us_states", "rivers_mountains"];
const LEARN_SUB_MODES = PLAY_MODES;
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
    // Metropolitan France incl. Corsica; used to auto-frame any viewport.
    bounds: { latMin: 41.3, latMax: 51.1, lngMin: -5.2, lngMax: 9.6 },
    targetCheck: "name",
  },
  us_states: {
    key: "us_states",
    hasCustomGeometry: true,
    geometryKey: "usStatesData",
    ghostExclusions: ["United States of America"],
    viewPoint: { lat: 38.0, lng: -97.0, altitude: { mobile: 0.85, desktop: 0.6 } },
    // Contiguous United States (Alaska/Hawaii are reached by panning).
    bounds: { latMin: 24.5, latMax: 49.4, lngMin: -124.8, lngMax: -66.9 },
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
  base: 0.0012,
  // Selection stays flat: the raised walls glitched and hid the outline face-on; the
  // outline is now drawn in pixels on the surface (selectionOutline.js).
  selected: 0.0012,
  // Regional maps are seen from very close: a department is only ~1° wide, so
  // the world-scale lift turned small areas into pillars and made the whole
  // map look embossed. Keep the regional relief flat and subtle.
  departmentBase: 0.0003,
  departmentSelected: 0.0003,
  // Ghost countries (dimmed world around a regional map) are tessellated by the
  // original Delaunay: worst cap dip at 1° is 0.044 (Greenland) < 0.0005 × 100.
  ghostCountry: 0.0005,
  // Layer cross-fade: the outgoing regional features stay above the new layer while they
  // dissolve; the world France / USA stay under the incoming departments / states.
  exitingRegional: 0.0016,
  parentBackdrop: 0.0001,
};

/**
 * Max cap triangulation step (degrees) per polygon layer. A cap is made of flat
 * triangles, so it dips below its vertices by ≈ 0.0125 × step² globe units (the
 * regional layers, built by RefinedConicPolygonGeometry, have a hard bound of
 * 100 × (1 − cos(step/√3)): 0.012 at 1.5°, 0.046 at 3°). The sea sphere pokes
 * through any cap that dips deeper than its altitude × 100: 0.03 for regional
 * maps, 0.05 for ghost countries, 0.12 for the world. Each layer therefore gets
 * a step that keeps it under its own margin, instead of the 3° mobile profile.
 * Verified on the real GeoJSON by src/tests/polygonCapSag.test.js.
 */
export const POLYGON_CAP_RESOLUTION = { world: 2, regional: 1.5, ghost: 1 };

/** Cap triangulation step for a polygon: the perf profile's, capped per layer. */
export const getPolygonCapResolution = ({ baseResolution = 1.5, isGhost, isRegional }) => {
  if (isGhost) return Math.min(baseResolution, POLYGON_CAP_RESOLUTION.ghost);
  if (isRegional) return Math.min(baseResolution, POLYGON_CAP_RESOLUTION.regional);
  return Math.min(baseResolution, POLYGON_CAP_RESOLUTION.world);
};

/** Same, decided from the feature's own flags (stable through mode switches). */
export const getFeatureCapResolution = (d, baseResolution) =>
  getPolygonCapResolution({
    baseResolution,
    isGhost: Boolean(d.isGhostCountry),
    isRegional: Boolean(
      d.isDepartmentFeature || d.isEnteringDepartmentFeature || d.isExitingDepartmentFeature
    ),
  });

export const getPolygonAltitudeFor = ({ isDepartmentMode, isGhostCountry, isSelected }) => {
  if (isDepartmentMode && isGhostCountry) return POLYGON_ALTITUDE.ghostCountry;
  if (isSelected)
    return isDepartmentMode ? POLYGON_ALTITUDE.departmentSelected : POLYGON_ALTITUDE.selected;
  return isDepartmentMode ? POLYGON_ALTITUDE.departmentBase : POLYGON_ALTITUDE.base;
};

/** Shader dissolve when deselecting a country (ms). Kept in sync with polygon altitude tween. */
export const GLITCH_SELECTION_TRANSITION_MS = 360;
/**
 * First deselect-fade value, just above the shader's transitionActive threshold (0.006):
 * a fade of 0 reads as "still selected" and showed one flat umber frame on deselect.
 */
export const DESELECT_FADE_START = 0.01;

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
