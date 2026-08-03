import { GLITCH_EFFECT_SETTINGS, GLOBE_STYLE } from "../../config/designSystem";
import { countryDataMap } from "../../data/gameData";
import { getFeatureAdmin } from "../../utils/utils";
import { FOUND_SURFACE_GREEN } from "./foundGreenPalette";

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

export function resolveGhostCountryColor(d, countryDataMapOpts, opts) {
  return opts?.fallbackRegionColor || GLOBE_STYLE.base.mapBase;
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
    return UI_COLORS.error;
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
  const isEndMissed = isEndScreen && !isFound;
  const playSelectedShader = isPlay && isIsolated && (isError || isSuccess || !isFound);
  const homeSelectedShader = isHomeScreen && isIsolated;
  const isPrevShader = isPrevTransitioning && !isFound;

  const useShader =
    (kind === "cap" || kind === "side") &&
    (playSelectedShader || homeSelectedShader || isPrevShader || isEndMissed);

  return {
    useShader,
    isSelectionHighlight: false,
  };
}

export function getTransitionState(modeTransitionRef) {
  if (!modeTransitionRef?.current?.active) return null;
  const trans = modeTransitionRef.current;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const elapsed = now - trans.startTime;
  if (elapsed >= trans.duration) {
    trans.active = false;
    return null;
  }
  const tRaw = Math.min(1, Math.max(0, elapsed / trans.duration));
  const progress = tRaw * tRaw * (3 - 2 * tRaw);
  const isEnteringRegional = trans.toDept || trans.toUs;
  return {
    progress,
    isEnteringRegional,
    isExitingRegional: !isEnteringRegional,
  };
}

export function resolveModeTransitionColor({
  d,
  transState,
  countryDataMap: _cdm,
  gameDataMap,
  globeTheme: _gt,
  theme: _th,
  REGION_COLORS_LABELS: _r1,
  REGION_COLORS_ATTENUATED: _r2,
  UI_COLORS,
  getRegionSurfaceColor,
  getFeatureMonochromeShade,
  lerpColor,
}) {
  const { progress, isExitingRegional } = transState;
  const admin = getFeatureAdmin(d);

  if (d.isGhostCountry) {
    const ghostColor = UI_COLORS.mapBase;
    const worldColor = UI_COLORS.mapBase;
    const lerpFactor = isExitingRegional ? progress : 1 - progress;
    return lerpColor(ghostColor, worldColor, lerpFactor);
  }

  if (d.isParentCountryFeature) {
    const worldColor = UI_COLORS.mapBase;
    const lerpFactor = isExitingRegional ? progress : 1 - progress;
    return lerpColor(UI_COLORS.mapSea, worldColor, lerpFactor);
  }

  if (d.isEnteringDepartmentFeature) {
    const regionCode = gameDataMap[admin]?.region || d.properties?.region || "Americas";
    const baseColor = getRegionSurfaceColor(regionCode);
    const deptColor = getFeatureMonochromeShade(admin, baseColor, lerpColor, UI_COLORS);
    return lerpColor(UI_COLORS.mapSea, deptColor, progress);
  }

  if (d.isExitingDepartmentFeature) {
    const regionCode = gameDataMap[admin]?.region || d.properties?.region || "Americas";
    const baseColor = getRegionSurfaceColor(regionCode);
    const deptColor = getFeatureMonochromeShade(admin, baseColor, lerpColor, UI_COLORS);
    return lerpColor(UI_COLORS.mapSea, deptColor, 1 - progress);
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

  if (d.isEnteringDepartmentFeature) {
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

  if (d.isEnteringDepartmentFeature) {
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
    const base = isFound ? (isPerfectScore ? UI_COLORS.gold : UI_COLORS.success) : UI_COLORS.error;
    if (kind === "cap") {
      return base;
    }
    const sideDarken = GLOBE_STYLE.lighting.sideDarken;
    const darken = isLight ? sideDarken.baseLight : sideDarken.baseDark;
    return lerpColor(base, UI_COLORS.black, darken);
  }

  let base = isFound ? resolveFoundCountryColor() : UI_COLORS.mapBase;
  if (_isRegionalMode && !isFound && _grlc) {
    const regionCode = _gdm[_admin]?.region || _d?.properties?.region || "Americas";
    const regColor = _grlc(regionCode);
    base = _gfms(_admin, regColor, lerpColor, UI_COLORS);
  }

  if (kind === "cap") {
    return base;
  }
  return lerpColor(base, UI_COLORS.black, isLight ? 0.04 : 0.08);
}
