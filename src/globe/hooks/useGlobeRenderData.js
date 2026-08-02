import { useMemo } from "react";

import { countryDataMap } from "../../data/gameData";
import {
  getCanonicalPosition,
  getFeatureAdmin,
  getFeaturePolygons,
  getLngLatBounds,
  getLngLatDistance,
  getMobileRenderRadius,
  getRenderGeometry,
} from "../../utils/utils";

export function useGlobeRenderData({
  isDepartmentMode = false,
  isUsStatesMode = false,
  isHomeScreen,
  isEndScreen,
  countriesData,
  departmentsData,
  usStatesData = [],
  gameDataMap,
  selectedCountry,
  cameraPOV,
  zoomLevel,
  perfProfile,
}) {
  const selectableCountriesData = useMemo(() => {
    if (isDepartmentMode)
      return departmentsData.filter((feature) => gameDataMap[getFeatureAdmin(feature)]);
    if (isUsStatesMode)
      return usStatesData.filter((feature) => gameDataMap[getFeatureAdmin(feature)]);
    return countriesData.filter((feature) => countryDataMap[getFeatureAdmin(feature)]);
  }, [countriesData, departmentsData, usStatesData, gameDataMap, isDepartmentMode, isUsStatesMode]);

  const worldCountriesRenderData = useMemo(() => {
    return countriesData.map((feature) => ({
      ...feature,
      renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
    }));
  }, [countriesData]);

  const baseRenderCountriesData = useMemo(() => {
    return selectableCountriesData.map((feature) => ({
      ...feature,
      renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
    }));
  }, [selectableCountriesData]);

  const renderCountriesData = useMemo(() => {
    if (isHomeScreen) return worldCountriesRenderData;
    if (!isDepartmentMode && !isUsStatesMode) return baseRenderCountriesData;

    const exclusions = isDepartmentMode ? ["France"] : ["United States of America"];
    const exclusionSet = new Set(exclusions);

    const ghostWorld = countriesData
      .filter((feature) => !exclusionSet.has(getFeatureAdmin(feature)))
      .map((feature) => ({
        ...feature,
        isGhostCountry: true,
        renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
      }));

    return [
      ...ghostWorld,
      ...baseRenderCountriesData.map((feature) => ({
        ...feature,
        isDepartmentFeature: true,
      })),
    ];
  }, [
    isHomeScreen,
    worldCountriesRenderData,
    baseRenderCountriesData,
    countriesData,
    isDepartmentMode,
    isUsStatesMode,
  ]);

  const selectableFeatureIndex = useMemo(() => {
    return selectableCountriesData
      .map((feature) => {
        const polygons = getFeaturePolygons(feature);
        return {
          admin: getFeatureAdmin(feature),
          bounds: getLngLatBounds(polygons),
          polygons,
        };
      })
      .filter((entry) => entry.admin && entry.polygons.length);
  }, [selectableCountriesData]);

  const countrySizes = useMemo(() => {
    const sizes = {};
    selectableFeatureIndex.forEach((entry) => {
      const b = entry.bounds;
      sizes[entry.admin] = Math.max(b.maxLng - b.minLng, b.maxLat - b.minLat);
    });
    return sizes;
  }, [selectableFeatureIndex]);

  const visibleRenderCountriesData = useMemo(() => {
    if (!perfProfile?.cullOffscreenCountries || isHomeScreen || isEndScreen) {
      return renderCountriesData;
    }

    const pov = cameraPOV;
    const renderRadius = getMobileRenderRadius(zoomLevel);

    return renderCountriesData.filter((feature) => {
      if (feature.isGhostCountry) return true;
      const admin = getFeatureAdmin(feature);
      if (!admin) return false;
      if (admin === selectedCountry) return true;

      const data = countryDataMap[admin];
      if (!data || data.lat === undefined || data.lng === undefined) return true;

      const size = countrySizes[admin] || 1;
      const sizeBuffer = Math.min(70, Math.max(8, size * 0.75));
      const distToCenter = getLngLatDistance(data.lng, data.lat, pov.lng, pov.lat);

      return distToCenter <= renderRadius + sizeBuffer;
    });
  }, [
    cameraPOV,
    cameraPOV?.lat,
    cameraPOV?.lng,
    countrySizes,
    isEndScreen,
    isHomeScreen,
    perfProfile?.cullOffscreenCountries,
    renderCountriesData,
    selectedCountry,
    zoomLevel,
  ]);

  const countriesWithGeometry = useMemo(() => {
    const set = new Set();
    const list = isDepartmentMode ? departmentsData : isUsStatesMode ? usStatesData : countriesData;
    list.forEach((feature) => {
      const admin = getFeatureAdmin(feature);
      if (admin) set.add(admin);
    });
    return set;
  }, [countriesData, departmentsData, usStatesData, isDepartmentMode, isUsStatesMode]);

  // GLOBAL SHAPE-BASED POSITIONS: for every feature that has geometry,
  // compute the true centroid from the rendered polygons.
  // Also for rivers/mountains: derive from their path shape.
  // This rule ensures points/labels/camera always target the exact visual shape.
  const canonicalPositions = useMemo(() => {
    const map = {};
    selectableFeatureIndex.forEach((entry) => {
      if (!entry.admin) return;
      const pos = getCanonicalPosition({}, entry.polygons);
      if (pos) {
        map[entry.admin] = pos;
      }
    });
    // Path-based (rivers, mountain ranges) — use midpoint of the shape path
    Object.keys(gameDataMap || {}).forEach((k) => {
      if (!map[k]) {
        const d = gameDataMap[k];
        if (d && Array.isArray(d.path) && d.path.length) {
          const pos = getCanonicalPosition(d);
          if (pos) map[k] = pos;
        }
      }
    });
    return map;
  }, [selectableFeatureIndex, gameDataMap]);

  return {
    isDepartmentMode,
    selectableCountriesData,
    baseRenderCountriesData,
    renderCountriesData,
    selectableFeatureIndex,
    countrySizes,
    visibleRenderCountriesData,
    countriesWithGeometry,
    canonicalPositions,
  };
}
