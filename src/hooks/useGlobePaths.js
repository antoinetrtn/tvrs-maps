import { useMemo } from "react";
import * as THREE from "three";
import { riversMountainsDataMap } from "../data/riversMountainsData";

const smoothedRiversCache = {};

const getSmoothedRiverPath = (riverKey, pathCoords) => {
  if (smoothedRiversCache[riverKey]) return smoothedRiversCache[riverKey];
  if (!pathCoords || pathCoords.length < 2) return pathCoords;

  const points = pathCoords.map(
    ([lat, lng]) => new THREE.Vector3(lat, lng, 0.006),
  );
  const curve = new THREE.CatmullRomCurve3(points);
  const smoothPoints = curve.getPoints(60);
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
  isLearnRivers,
  gameDataMap,
  foundSet,
  isHomeScreen,
  UI_COLORS,
  selectedCountry,
  isError,
}) {
  const riversBasePathsData = useMemo(() => {
    if (mode !== "rivers_mountains" && !isLearnRivers) return [];
    const paths = [];
    const dataMap = isLearnRivers ? riversMountainsDataMap : gameDataMap;
    Object.keys(dataMap).forEach((k) => {
      const data = dataMap[k];
      if (!data || data.type !== "river" || !data.path) return;
      const isFound = foundSet.has(k) || mode === "learn" || isHomeScreen;
      paths.push({
        admin: k,
        coords: getSmoothedRiverPath(k, data.path),
        color: isFound ? UI_COLORS.riverActive : UI_COLORS.riverInactive,
        width: isFound ? 1.4 : 0.75,
        dashLength: isFound ? 1 : 0.06,
        dashGap: isFound ? 0 : 0.04,
        dashAnimateTime: isFound ? 2000 : 6000,
      });
    });
    return paths;
  }, [gameDataMap, foundSet, mode, isHomeScreen, UI_COLORS, isLearnRivers]);

  const riversSelectedPathData = useMemo(() => {
    if ((mode !== "rivers_mountains" && !isLearnRivers) || !selectedCountry)
      return [];
    const dataMap = isLearnRivers ? riversMountainsDataMap : gameDataMap;
    const data = dataMap[selectedCountry];
    if (!data || data.type !== "river" || !data.path) return [];
    const isFound =
      foundSet.has(selectedCountry) || mode === "learn" || isHomeScreen;
    const color = isFound
      ? isError
        ? UI_COLORS.error
        : UI_COLORS.riverSelectedFound
      : isError
        ? UI_COLORS.errorGlowStrong
        : UI_COLORS.riverSelectedUnfound;

    const smoothedPath = getSmoothedRiverPath(selectedCountry, data.path);

    return [
      {
        admin: selectedCountry,
        coords: smoothedPath.map((p) => [p[0], p[1], p[2] + 0.001]),
        color,
        width: isFound ? 2.4 : 1.9,
        dashLength: 1,
        dashGap: 0,
        dashAnimateTime: 0,
      },
      {
        admin: `${selectedCountry}_core`,
        coords: smoothedPath.map((p) => [p[0], p[1], p[2] + 0.002]),
        color: UI_COLORS.paper,
        width: isFound ? 0.9 : 0.65,
        dashLength: 0.25,
        dashGap: 0.15,
        dashAnimateTime: 800,
      },
    ];
  }, [
    gameDataMap,
    foundSet,
    mode,
    isHomeScreen,
    selectedCountry,
    isError,
    UI_COLORS,
    isLearnRivers,
  ]);

  const globePathsData = useMemo(
    () => [...riversBasePathsData, ...riversSelectedPathData],
    [riversBasePathsData, riversSelectedPathData],
  );

  return {
    globePathsData,
  };
}
