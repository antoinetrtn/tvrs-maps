import { useMemo } from "react";
import * as THREE from "three";

import { RIVER_CONFIG } from "../../config/designSystem";
import { RIVER_ALTITUDE } from "../../config/gameConfig";

const smoothedRiversCache = {};

export const getSmoothedRiverPath = (riverKey, pathCoords) => {
  if (smoothedRiversCache[riverKey]) return smoothedRiversCache[riverKey];
  if (!pathCoords || pathCoords.length < 2) return pathCoords;

  const points = pathCoords.map(([lat, lng]) => new THREE.Vector3(lat, lng, RIVER_ALTITUDE.base));
  const curve = new THREE.CatmullRomCurve3(points);
  const smoothPoints = curve.getPoints(RIVER_CONFIG.smoothingPoints);
  const result = smoothPoints.map((p) => [p.x, p.y, p.z]);

  smoothedRiversCache[riverKey] = result;
  return result;
};

export const pathPointsAccessor = (d) => d.coords;
export const pathPointLatAccessor = (d) => d[0];
export const pathPointLngAccessor = (d) => d[1];
export const pathPointAltAccessor = (d) => d[2];
export const pathColorAccessor = (d) => d.color;
export const pathWidthAccessor = (d) => d.width;
export const pathDashLengthAccessor = (d) => d.dashLength;
export const pathDashGapAccessor = (d) => d.dashGap;
export const pathDashAnimateTimeAccessor = (d) => d.dashAnimateTime;

export function useGlobePaths({
  mode,
  isRiversMountainsMode,
  gameDataMap,
  foundSet,
  selectedCountry,
  isError,
  isSuccess,
}) {
  const riversBasePathsData = useMemo(() => {
    if (!isRiversMountainsMode) return [];
    const paths = [];
    const dataMap = gameDataMap;
    Object.keys(dataMap).forEach((k) => {
      const data = dataMap[k];
      if (!data || data.type !== "river" || !data.path) return;
      const isFound = foundSet.has(k) || mode === "learn";
      paths.push({
        admin: k,
        coords: getSmoothedRiverPath(k, data.path),
        color: isFound ? RIVER_CONFIG.colors.active : RIVER_CONFIG.colors.inactive,
        width: isFound ? RIVER_CONFIG.widths.baseFound : RIVER_CONFIG.widths.baseUnfound,
        dashLength: RIVER_CONFIG.dash.baseLength,
        dashGap: RIVER_CONFIG.dash.baseGap,
        dashAnimateTime: RIVER_CONFIG.dash.baseAnimateTime,
      });
    });
    return paths;
  }, [gameDataMap, foundSet, mode, isRiversMountainsMode]);

  const riversSelectedPathData = useMemo(() => {
    if (!isRiversMountainsMode || !selectedCountry) return [];
    const dataMap = gameDataMap;
    const data = dataMap[selectedCountry];
    if (!data || data.type !== "river" || !data.path) return [];
    const isFound = foundSet.has(selectedCountry) || mode === "learn";

    let color;
    if (isSuccess) {
      color = RIVER_CONFIG.colors.success;
    } else if (isError) {
      color = isFound ? RIVER_CONFIG.colors.error : RIVER_CONFIG.colors.errorGlow;
    } else {
      color = isFound ? RIVER_CONFIG.colors.selectedFound : RIVER_CONFIG.colors.selectedUnfound;
    }

    const smoothedPath = getSmoothedRiverPath(selectedCountry, data.path);

    return [
      {
        admin: selectedCountry,
        coords: smoothedPath.map((p) => [p[0], p[1], RIVER_ALTITUDE.selectedOuter]),
        color,
        width: isFound ? RIVER_CONFIG.widths.selectedFound : RIVER_CONFIG.widths.selectedUnfound,
        dashLength: RIVER_CONFIG.dash.selectedOuterLength,
        dashGap: RIVER_CONFIG.dash.selectedOuterGap,
        dashAnimateTime: RIVER_CONFIG.dash.selectedOuterAnimateTime,
      },
      {
        admin: `${selectedCountry}_core`,
        coords: smoothedPath.map((p) => [p[0], p[1], RIVER_ALTITUDE.selectedCore]),
        color: RIVER_CONFIG.colors.core,
        width: isFound ? RIVER_CONFIG.widths.coreFound : RIVER_CONFIG.widths.coreUnfound,
        dashLength: RIVER_CONFIG.dash.coreLength,
        dashGap: RIVER_CONFIG.dash.coreGap,
        dashAnimateTime: RIVER_CONFIG.dash.coreAnimateTime,
      },
    ];
  }, [gameDataMap, foundSet, mode, selectedCountry, isError, isSuccess, isRiversMountainsMode]);

  const globePathsData = useMemo(
    () => [...riversBasePathsData, ...riversSelectedPathData],
    [riversBasePathsData, riversSelectedPathData]
  );

  return {
    globePathsData,
  };
}
