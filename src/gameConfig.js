/**
 * Centralized per-mode game configuration.
 *
 * Everything that must stay homogeneous across modes (extrusion height, what is
 * revealed before a feature is found, relief sizing, the reveal/scramble rule)
 * lives here so a single mode can't drift visually from the others.
 */

export const PLAY_MODES = ['countries', 'capitals', 'departments', 'rivers_mountains'];

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
 * Rivers & mountains visibility + sizing.
 *
 * A relief feature is only drawn once it is found OR while it is the active target
 * being guessed — exactly like a country keeps its label hidden until found. This
 * stops every answer's shape/location from being given away at once.
 *
 * Mountains use a single representative scale whether found or shown as a hint, so
 * they no longer pop from a tiny placeholder to full size when found.
 */
export const RELIEF = {
  mountainScale: 0.62,   // stable, geographically-representative size
  targetHintScale: 0.5   // selected-but-unfound target (the current question)
};

export const isReliefVisible = ({ isFound, isSelected, isHomeScreen = false, isLearn = false }) =>
  isFound || isSelected || isHomeScreen || isLearn;
