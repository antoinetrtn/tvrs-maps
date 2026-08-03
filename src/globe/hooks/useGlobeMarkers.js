import { useCallback, useMemo } from "react";
import * as THREE from "three";

import {
  getOpaqueThreeColor,
  getThemeRegionColor,
  getThemeRegionColorAttenuated,
  GLOBE_STYLE,
} from "../../config/designSystem";
import { countryDataMap } from "../../data/gameData";
import { getCanonicalPosition, getLngLatDistance, getMobileRenderRadius } from "../../utils/utils";
import { isSameAdmin } from "../render/polygonColorResolver";

const _lerpColor1 = new THREE.Color();
const _lerpColor2 = new THREE.Color();

export function useGlobeMarkers({
  mode,
  isDepartmentMode,
  isRiversMountainsMode,
  isHomeScreen,
  isEndScreen,
  selectedCountry,
  foundSet,
  countriesWithGeometry,
  cameraPOV,
  zoomLevel,
  perfProfile,
  UI_COLORS,
  isPerfectScore,
  isError,
  isLight,
  globeTheme,
  theme,
  canonicalPositions = {},
  gameDataMap,
}) {
  const lerpColor = useCallback((a, b, amount) => {
    try {
      const colorA = getOpaqueThreeColor(a);
      const colorB = getOpaqueThreeColor(b);
      _lerpColor1.set(colorA);
      _lerpColor2.set(colorB);
      _lerpColor1.lerp(_lerpColor2, Math.max(0, Math.min(1, amount)));
      return `#${_lerpColor1.getHexString()}`;
    } catch {
      return getOpaqueThreeColor(a);
    }
  }, []);

  const getRegionSurfaceColor = useCallback(
    (region) => {
      return getThemeRegionColor(globeTheme, theme, region) || UI_COLORS.success;
    },
    [globeTheme, theme, UI_COLORS]
  );

  const markersData = useMemo(() => {
    if (isDepartmentMode || isRiversMountainsMode || isHomeScreen) return [];

    return Object.entries(countryDataMap)
      .filter(([admin, data]) => {
        if (data.lat === undefined || data.lng === undefined) return false;
        return !countriesWithGeometry.has(admin);
      })
      .map(([admin, data]) => {
        const canonical = canonicalPositions[admin] || getCanonicalPosition(data);
        return {
          admin,
          lat: canonical ? canonical.lat : data.lat,
          lng: canonical ? canonical.lng : data.lng,
          region: data.region,
        };
      });
  }, [countriesWithGeometry, isDepartmentMode, isRiversMountainsMode, canonicalPositions]);

  const visibleMarkersData = useMemo(() => {
    if (!perfProfile?.cullOffscreenCountries || isHomeScreen || isEndScreen) {
      return markersData;
    }

    const pov = cameraPOV;
    const renderRadius = getMobileRenderRadius(zoomLevel);

    return markersData.filter((marker) => {
      if (isSameAdmin(marker.admin, selectedCountry, gameDataMap)) return true;
      const distToCenter = getLngLatDistance(marker.lng, marker.lat, pov.lng, pov.lat);
      return distToCenter <= renderRadius + 12;
    });
  }, [
    cameraPOV,
    isEndScreen,
    isHomeScreen,
    markersData,
    perfProfile?.cullOffscreenCountries,
    selectedCountry,
    zoomLevel,
    gameDataMap,
  ]);

  const getPointColor = useCallback(
    (d) => {
      const isSelected = isSameAdmin(d.admin, selectedCountry, gameDataMap);
      if (isDepartmentMode) {
        if (isEndScreen && !foundSet.has(d.admin)) return UI_COLORS.error;
        if (foundSet.has(d.admin)) return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        if (isSelected) return isError ? UI_COLORS.error : UI_COLORS.accent;
        return UI_COLORS.mapBorderMuted;
      }

      const isFound = foundSet.has(d.admin) || mode === "learn";
      const region = d.region || "Unknown";

      if (isEndScreen) {
        if (foundSet.has(d.admin)) {
          return isPerfectScore ? UI_COLORS.gold : UI_COLORS.success;
        }
        return UI_COLORS.error;
      }

      if (isFound) {
        const baseColor = getRegionSurfaceColor(region);
        if (isSelected) {
          if (isError) return UI_COLORS.error;
          return lerpColor(
            baseColor,
            UI_COLORS.paper,
            0.5 * GLOBE_STYLE.lighting.capPulseToPaper[isLight ? "light" : "dark"]
          );
        }
        return baseColor;
      }

      if (isSelected) {
        if (isError) return UI_COLORS.error;
        const baseColor =
          getThemeRegionColorAttenuated(globeTheme, theme, region) || UI_COLORS.accent;
        const targetColor = getThemeRegionColor(globeTheme, theme, region) || UI_COLORS.accent;
        return lerpColor(baseColor, targetColor, 0.3);
      }

      return UI_COLORS.mapBase;
    },
    [
      UI_COLORS,
      foundSet,
      isError,
      selectedCountry,
      mode,
      isDepartmentMode,
      isEndScreen,
      isPerfectScore,
      getRegionSurfaceColor,
      globeTheme,
      isLight,
      lerpColor,
      theme,
    ]
  );

  const getPointRadius = useCallback(
    (d) => {
      const isSelected = isSameAdmin(d.admin, selectedCountry, gameDataMap);
      return isDepartmentMode ? (isSelected ? 0.12 : 0.055) : isSelected ? 0.22 : 0.12;
    },
    [isDepartmentMode, selectedCountry, gameDataMap]
  );

  const getPointAltitude = useCallback(
    (d) => {
      if (selectedCountry && isSameAdmin(d.admin, selectedCountry, gameDataMap)) return 0.01;
      return 0.0015;
    },
    [selectedCountry, gameDataMap]
  );

  const getPointColorWrapped = useCallback(
    (d) => getOpaqueThreeColor(getPointColor(d)),
    [getPointColor]
  );

  return {
    markersData,
    visibleMarkersData,
    getPointColorWrapped,
    getPointRadius,
    getPointAltitude,
  };
}
