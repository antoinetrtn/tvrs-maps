import { GLITCH_EFFECT_SETTINGS } from "../config/designSystem";
import { FOUND_SURFACE_GREEN } from "./foundGreenPalette";

export { FOUND_SURFACE_GREEN };
export const FOUND_HIGHLIGHT = GLITCH_EFFECT_SETTINGS.selectionHighlight;

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

/** Unfound land tint — same continental shades in learn and play. */
export function resolveRegionalLandColor(
  region,
  { globeTheme, regionColorsLabels, regionColorsAttenuated, fallbackAccent, fallbackRegionColor }
) {
  const isSatellite = globeTheme === "satellite";
  return isSatellite
    ? regionColorsLabels[region] ||
        regionColorsAttenuated[region] ||
        fallbackRegionColor ||
        fallbackAccent
    : regionColorsAttenuated[region] || fallbackRegionColor;
}

export function resolveGhostCountryColor(d, countryDataMap, opts) {
  const admin = d?.properties?.ADMIN || d?.properties?.code || d?.properties?.name;
  const reg = countryDataMap[admin]?.region || d?.properties?.region || "Americas";
  return resolveRegionalLandColor(reg, opts);
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
  const isSelected = admin === selectedCountry;
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
  const isSelected = admin === selectedCountry;

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
