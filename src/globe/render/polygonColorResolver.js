import { GLITCH_EFFECT_SETTINGS, GLOBE_STYLE } from "../../config/designSystem";
import { countryDataMap } from "../../data/gameData";
import { getFeatureAdmin } from "../../utils/utils";
import { FOUND_SURFACE_GREEN } from "./foundGreenPalette";
import { stepProgress } from "./modeTransition";

export { FOUND_SURFACE_GREEN };
export const FOUND_HIGHLIGHT = GLITCH_EFFECT_SETTINGS.selectionHighlight;

export const isSameAdmin = (a, b, dataMap = countryDataMap) => {
  if (!a || !b) return false;
  if (a === b) return true;
  const bData = dataMap?.[b] || countryDataMap[b];
  if (bData && (bData.admin === a || bData.name_en === a || bData.name_fr === a)) return true;
  const aData = dataMap?.[a] || countryDataMap[a];
  if (aData && (aData.admin === b || aData.name_en === b || aData.name_fr === b)) return true;
  return false;
};

export const getCachedMaterial = (cacheMap, adminKey, gameDataMap = countryDataMap) => {
  if (!adminKey) return null;
  const mat = cacheMap.get(adminKey);
  if (mat) return mat;
  for (const [key, val] of cacheMap.entries()) {
    if (isSameAdmin(key, adminKey, gameDataMap)) {
      return val;
    }
  }
  return null;
};

/** Found country cap — exact DS green, no mapBase lerp. */
export function resolveFoundCountryColor() {
  return FOUND_SURFACE_GREEN;
}

/** Dark edge visible on bright found fill. */
export function resolveFoundCountryStroke({ isLight, isSelected = false, UI_COLORS, lerpColor }) {
  if (isSelected) {
    return lerpColor(FOUND_SURFACE_GREEN, UI_COLORS.black, isLight ? 0.78 : 0.72);
  }
  return lerpColor(FOUND_SURFACE_GREEN, UI_COLORS.black, isLight ? 0.58 : 0.5);
}

export function mutedFoundGreen(_mapBase, _lerpColor) {
  return resolveFoundCountryColor();
}

export function getFeatureMonochromeShade(adminKey, baseHex, lerpColorFn, UI_COLORS_REF) {
  if (!adminKey || typeof adminKey !== "string") return baseHex;
  let hash = 0;
  for (let i = 0; i < adminKey.length; i++) {
    hash = (hash * 37 + adminKey.charCodeAt(i)) & 0x7fffffff;
  }
  const factor = (hash % 19) / 100 - 0.09;
  if (factor > 0) {
    return lerpColorFn(baseHex, UI_COLORS_REF.paper, factor * 0.85);
  }
  return lerpColorFn(baseHex, UI_COLORS_REF.black, Math.abs(factor) * 0.85);
}

export function resolveRegionalLandColor(
  rawRegion,
  {
    globeTheme: _globeTheme,
    regionColorsLabels: _r1,
    regionColorsAttenuated: _r2,
    fallbackAccent: _f1,
    fallbackRegionColor,
  }
) {
  return fallbackRegionColor || GLOBE_STYLE.base.mapBase;
}

/** Share of the sea tone mixed into the rest of the world while a regional layer is played. */
export const GHOST_DIM_AMOUNT = 0.62;
/** Satellite: the dark veil laid over the imagery outside the played region. */
export const GHOST_VEIL_OPACITY = 0.58;

/**
 * Rest-of-the-world tone in regional modes (US states, departments): the
 * attenuated region colour pulled toward the sea so the played region is the
 * only land that reads. Satellite shows imagery, so the ghosts become a dark
 * veil instead (see GHOST_VEIL_OPACITY).
 */
export function resolveGhostCountryColor(d, countryDataMapOpts, opts) {
  const base = opts?.fallbackRegionColor || GLOBE_STYLE.base.mapBase;
  if (opts?.isSatellite && opts?.veilColor) return opts.veilColor;
  if (opts?.lerpColor && opts?.mapSea) return opts.lerpColor(base, opts.mapSea, GHOST_DIM_AMOUNT);
  return base;
}

/**
 * Satellite shows imagery instead of coloured land, so the rest of the world is
 * dimmed by a dark veil: full while a regional layer is played, stepped in or out
 * during the layer transition. 0 = no veil.
 */
export function resolveGhostVeil({ d, isRegionalMode, globeTheme, transState = null }) {
  if (globeTheme !== "satellite") return 0;
  if (isRegionalMode) {
    if (!d.isGhostCountry) return 0;
    const fadingIn = transState && transState.isEnteringRegional;
    return fadingIn
      ? Math.round(GHOST_VEIL_OPACITY * transState.progress * 100) / 100
      : GHOST_VEIL_OPACITY;
  }
  // Back to the world layer: the veil of the former ghost countries steps out.
  if (transState?.isExitingRegional && !d.isParentCountryFeature && !d.isExitingDepartmentFeature) {
    return Math.round(GHOST_VEIL_OPACITY * (1 - transState.progress) * 100) / 100;
  }
  return 0;
}

export function resolvePolygonStrokeWidth({
  admin,
  isGhostCountry,
  selectedCountry,
  isRegionalMode,
  foundSet,
  mode,
  isLight,
  globeLightingEnabled,
  perfProfile,
  UI_COLORS,
}) {
  const strokeScale = perfProfile?.isMobile ? 0.94 : 1;
  const isSelected = isSameAdmin(admin, selectedCountry);
  if (isRegionalMode && isGhostCountry) return 0.15 * strokeScale;
  if (isSelected) {
    const isGreenFill = foundSet.has(admin) || mode === "learn";
    return (isGreenFill ? 14 : 7.5) * strokeScale;
  }
  if (isRegionalMode) return 1.1 * strokeScale;
  if (foundSet.has(admin)) {
    return (0.95 + (isLight ? 0.15 : 0.25)) * strokeScale;
  }
  const thickness =
    Number(UI_COLORS.strokeWidthDesktop) || Number(UI_COLORS.strokeWidthMobile) || 0.75;
  if (!UI_COLORS.isBlackoutTheme && (isLight || globeLightingEnabled)) {
    return (thickness + 0.2) * strokeScale;
  }
  return thickness * strokeScale;
}

export function shouldUseRegionalUnfoundLand({ isEndScreen, isFound, isSelected }) {
  return !isEndScreen && !isFound && !isSelected;
}

const END_MISSED_ERROR_TINT = {
  light: 0.16,
  dark: 0.2,
};

/**
 * End screen: missed countries stay on a quiet, flat land surface with a
 * subtle warm tint instead of running the TV static shader across the globe.
 */
export function resolveEndMissedColor({ mapBase, UI_COLORS, lerpColor, isLight = false }) {
  const base = mapBase || UI_COLORS?.mapBase;
  if (!UI_COLORS?.error || typeof lerpColor !== "function") {
    return base;
  }
  const amount = isLight ? END_MISSED_ERROR_TINT.light : END_MISSED_ERROR_TINT.dark;
  return lerpColor(base, UI_COLORS.error, amount);
}

export function resolveCountryCapColor({
  admin,
  region: _region,
  mode: _mode,
  foundSet,
  selectedCountry,
  isError,
  isSuccess: _isSuccess,
  isEndScreen,
  isPerfectScore,
  isLearn,
  isLight: _isLight = false,
  UI_COLORS,
  lerpColor: _lerpColor,
  mapBase,
}) {
  const isFound = foundSet.has(admin);
  const isSelected = isSameAdmin(admin, selectedCountry);

  if (isEndScreen) {
    if (isFound) return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
    return resolveEndMissedColor({
      mapBase,
      UI_COLORS,
      lerpColor: _lerpColor,
      isLight: _isLight,
    });
  }

  if (isLearn) {
    if (isSelected) {
      if (isError) return UI_COLORS.error;
      return FOUND_HIGHLIGHT;
    }
    return mapBase;
  }

  if (isFound) {
    if (isSelected) {
      if (isError) return UI_COLORS.error;
      return resolveFoundCountryColor();
    }
    return resolveFoundCountryColor();
  }

  if (isSelected) {
    if (isError) return UI_COLORS.error;
    return mapBase;
  }

  return mapBase;
}

export function resolvePolygonShaderMode({
  admin,
  kind,
  mode,
  foundSet,
  isIsolated,
  isPrevTransitioning,
  isEndScreen,
  isHomeScreen,
  isError = false,
  isSuccess = false,
}) {
  const isFound = foundSet.has(admin);
  const isLearn = mode === "learn";
  const isPlay = !isLearn && !isHomeScreen && !isEndScreen;
  const playSelectedShader = isPlay && isIsolated && (isError || isSuccess || !isFound);
  const homeSelectedShader = isHomeScreen && isIsolated;
  const isPrevShader = !isEndScreen && isPrevTransitioning && !isFound;

  const useShader =
    (kind === "cap" || kind === "side") &&
    (playSelectedShader || homeSelectedShader || isPrevShader);

  return {
    useShader,
    isSelectionHighlight: false,
  };
}

// `_step` is the render-step counter: passing it makes accessor memoization explicit.
export function getTransitionState(modeTransitionRef, _step = 0) {
  if (!modeTransitionRef?.current?.active) return null;
  const trans = modeTransitionRef.current;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const elapsed = now - trans.startTime;
  if (elapsed >= trans.duration) {
    trans.active = false;
    return null;
  }
  const progress = stepProgress(elapsed / trans.duration);
  const isEnteringRegional = (trans.toDept || trans.toUs) && !(trans.fromDept || trans.fromUs);
  const isExitingRegional = (trans.fromDept || trans.fromUs) && !(trans.toDept || trans.toUs);
  return {
    progress,
    isEnteringRegional,
    isExitingRegional,
    fromDept: trans.fromDept,
    fromUs: trans.fromUs,
    toDept: trans.toDept,
    toUs: trans.toUs,
  };
}

export function resolveModeTransitionColor({
  d,
  transState,
  countryDataMap: cdm = countryDataMap,
  gameDataMap,
  globeTheme: _gt,
  theme: _th,
  REGION_COLORS_LABELS: _r1,
  REGION_COLORS_ATTENUATED: _r2,
  UI_COLORS,
  getRegionSurfaceColor,
  getRegionSurfaceColorDimmed,
  getGhostColor,
  getFeatureMonochromeShade,
  lerpColor,
}) {
  const { progress, isExitingRegional, fromDept, fromUs, toDept, toUs } = transState;
  const admin = getFeatureAdmin(d);

  if (d.isGhostCountry) {
    const region = cdm?.[admin]?.region || d.properties?.region || "Americas";
    const worldColor = getRegionSurfaceColor ? getRegionSurfaceColor(region) : UI_COLORS.mapBase;
    const ghostColor = getGhostColor
      ? getGhostColor(region)
      : getRegionSurfaceColorDimmed
        ? getRegionSurfaceColorDimmed(region)
        : worldColor;

    const isRegionalToRegional = (fromDept || fromUs) && (toDept || toUs);
    if (isRegionalToRegional) return ghostColor;

    const lerpFactor = isExitingRegional ? 1 - progress : progress;
    return lerpColor(worldColor, ghostColor, lerpFactor);
  }

  const regionOf = (fallback) =>
    gameDataMap?.[admin]?.region || cdm?.[admin]?.region || d.properties?.region || fallback;
  const worldColorOf = (region) =>
    getRegionSurfaceColor ? getRegionSurfaceColor(region) : UI_COLORS.mapBase;
  const ghostColorOf = (region) =>
    getGhostColor
      ? getGhostColor(region)
      : getRegionSurfaceColorDimmed
        ? getRegionSurfaceColorDimmed(region)
        : worldColorOf(region);

  // World France / USA while a regional layer takes over: they stay as the backdrop
  // of the incoming departments / states (which start from this very colour).
  if (d.isParentCountryFeature) {
    return isExitingRegional ? null : worldColorOf(regionOf("Europe"));
  }

  if (d.isEnteringDepartmentFeature || d.isDepartmentFeature) {
    const regionCode = regionOf("Americas");
    const getDimmed = getRegionSurfaceColorDimmed || getRegionSurfaceColor;
    const deptColor = getFeatureMonochromeShade(admin, getDimmed(regionCode), lerpColor, UI_COLORS);
    // Regional → regional: the area was dimmed ghost land; from the world it was the world colour.
    const from = fromDept || fromUs ? ghostColorOf(regionCode) : worldColorOf(regionCode);
    return lerpColor(from, deptColor, progress);
  }

  if (d.isExitingDepartmentFeature) {
    const regionCode = regionOf("Americas");
    const getDimmed = getRegionSurfaceColorDimmed || getRegionSurfaceColor;
    const deptColor = getFeatureMonochromeShade(admin, getDimmed(regionCode), lerpColor, UI_COLORS);
    // Dissolves into what takes its place: the world colour, or the dimmed ghost land.
    const to = toDept || toUs ? ghostColorOf(regionCode) : worldColorOf(regionCode);
    return lerpColor(deptColor, to, progress);
  }

  return null;
}

export function resolveModeTransitionStroke({
  d,
  transState,
  gameDataMap: _gdm,
  globeTheme,
  REGION_COLORS_LABELS: _r1,
  UI_COLORS,
  isLight: _isLight,
  lerpColor,
}) {
  const { progress, isExitingRegional } = transState;
  const _admin = getFeatureAdmin(d);

  if (d.isEnteringDepartmentFeature || d.isDepartmentFeature) {
    const baseStroke =
      globeTheme === "satellite" ? UI_COLORS.mapBorder : UI_COLORS.accent || UI_COLORS.paper;
    return lerpColor(UI_COLORS.mapSea, baseStroke, progress);
  }

  if (d.isExitingDepartmentFeature) {
    const baseStroke =
      globeTheme === "satellite" ? UI_COLORS.mapBorder : UI_COLORS.accent || UI_COLORS.paper;
    return lerpColor(UI_COLORS.mapSea, baseStroke, 1 - progress);
  }

  if (d.isParentCountryFeature) {
    const baseStroke = UI_COLORS.mapBorder;
    const fadeFactor = isExitingRegional ? progress : 1 - progress;
    return lerpColor(UI_COLORS.mapSea, baseStroke, fadeFactor);
  }

  return null;
}

export function resolveModeTransitionStrokeWidth({ d, transState, perfProfile, UI_COLORS }) {
  const { progress, isExitingRegional } = transState;

  if (d.isEnteringDepartmentFeature || d.isDepartmentFeature) {
    const strokeScale = perfProfile?.isMobile ? 0.94 : 1;
    const baseWidth = 1.1 * strokeScale;
    return baseWidth * progress;
  }

  if (d.isExitingDepartmentFeature) {
    const strokeScale = perfProfile?.isMobile ? 0.94 : 1;
    const baseWidth = 1.1 * strokeScale;
    return baseWidth * (1 - progress);
  }

  if (d.isParentCountryFeature) {
    const strokeScale = perfProfile?.isMobile ? 0.94 : 1;
    const baseWidth = (Number(UI_COLORS.strokeWidthDesktop) || 0.75) * strokeScale;
    const factor = isExitingRegional ? progress : 1 - progress;
    return baseWidth * factor;
  }

  return null;
}

export function resolveRestingColorForFeature({
  d: _d,
  kind,
  admin: _admin,
  isFound,
  isEndScreen,
  isPerfectScore,
  isRegionalMode: _isRegionalMode,
  globeTheme: _globeTheme,
  isLight,
  UI_COLORS,
  REGION_COLORS_LABELS: _r1,
  REGION_COLORS_ATTENUATED: _r2,
  countryDataMap: _cdm,
  gameDataMap: _gdm,
  getRegionalLandColor: _grlc,
  getFeatureMonochromeShade: _gfms,
  lerpColor,
}) {
  if (isEndScreen) {
    const base = isFound
      ? isPerfectScore
        ? UI_COLORS.gold
        : UI_COLORS.success
      : resolveEndMissedColor({
          mapBase: UI_COLORS.mapBase,
          UI_COLORS,
          lerpColor,
          isLight,
        });
    if (kind === "cap") {
      return base;
    }
    const sideDarken = GLOBE_STYLE.lighting.sideDarken;
    const darken = isLight ? sideDarken.baseLight : sideDarken.baseDark;
    return lerpColor(base, UI_COLORS.black, darken);
  }

  let base = isFound ? resolveFoundCountryColor() : UI_COLORS.mapBase;
  if (_isRegionalMode && !isFound && _grlc) {
    const regionCode =
      _cdm?.[_admin]?.region || _gdm?.[_admin]?.region || _d?.properties?.region || "Americas";
    const regColor = _grlc(regionCode);
    base = _gfms(_admin, regColor, lerpColor, UI_COLORS);
  }

  if (kind === "cap") {
    return base;
  }
  return lerpColor(base, UI_COLORS.black, isLight ? 0.04 : 0.08);
}

/** Conquête: le focus transitoire d'un pays possédé ne masque pas la couleur du propriétaire. */
export function isQuietOwnedFocusFor(overlay, admin, gameDataMap) {
  const id = overlay?.quietFocusId;
  if (!id || !overlay.colors?.[admin]) return false;
  return id === admin || isSameAdmin(admin, id, gameDataMap);
}

/** Conquête: couleur de base (cap / side) d'un pays possédé, cible de la dissolution. */
export function resolveOwnerBaseColor(owner, kind, { lerpColor, UI_COLORS, isLight }) {
  const capColor = lerpColor(owner, UI_COLORS.black, isLight ? 0.32 : 0.16);
  return kind === "side" ? lerpColor(capColor, UI_COLORS.black, isLight ? 0.04 : 0.08) : capColor;
}
