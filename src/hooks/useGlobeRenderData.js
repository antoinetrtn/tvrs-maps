import { useMemo } from "react";
import { countryDataMap } from "../data/gameData";
import {
  DEPARTMENT_MODE_GHOST_COUNTRY_EXCLUSIONS,
} from "../config/gameConfig";
import {
  getFeatureAdmin,
  getRenderGeometry,
  getFeaturePolygons,
  getLngLatBounds,
  getMobileRenderRadius,
  getLngLatDistance,
} from "../utils/utils";

export function useGlobeRenderData({
  mode,
  isHomeScreen,
  isEndScreen,
  countriesData,
  departmentsData,
  gameDataMap,
  selectedCountry,
  cameraPOV,
  zoomLevel,
  perfProfile,
}) {
  const isDepartmentMode = mode === "departments" && !isHomeScreen;

  const selectableCountriesData = useMemo(() => {
    if (isDepartmentMode)
      return departmentsData.filter(
        (feature) => gameDataMap[getFeatureAdmin(feature)],
      );
    return countriesData.filter(
      (feature) => countryDataMap[getFeatureAdmin(feature)],
    );
  }, [countriesData, departmentsData, gameDataMap, isDepartmentMode]);

  const baseRenderCountriesData = useMemo(() => {
    return selectableCountriesData.map((feature) => ({
      ...feature,
      renderGeometry: getRenderGeometry(feature),
    }));
  }, [selectableCountriesData]);

  const renderCountriesData = useMemo(() => {
    if (!isDepartmentMode) return baseRenderCountriesData;

    const ghostWorld = countriesData
      .filter(
        (feature) =>
          !DEPARTMENT_MODE_GHOST_COUNTRY_EXCLUSIONS.has(
            getFeatureAdmin(feature),
          ),
      )
      .map((feature) => ({
        ...feature,
        isGhostCountry: true,
        renderGeometry: getRenderGeometry(feature),
      }));

    return [
      ...ghostWorld,
      ...baseRenderCountriesData.map((feature) => ({
        ...feature,
        isDepartmentFeature: true,
      })),
    ];
  }, [baseRenderCountriesData, countriesData, isDepartmentMode]);

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
      const admin = getFeatureAdmin(feature);
      if (!admin) return false;
      if (admin === selectedCountry) return true;

      const data = countryDataMap[admin];
      if (!data || data.lat === undefined || data.lng === undefined)
        return true;

      const size = countrySizes[admin] || 1;
      const sizeBuffer = Math.min(70, Math.max(8, size * 0.75));
      const distToCenter = getLngLatDistance(
        data.lng,
        data.lat,
        pov.lng,
        pov.lat,
      );

      return distToCenter <= renderRadius + sizeBuffer;
    });
  }, [
    cameraPOV,
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
    const list = isDepartmentMode ? departmentsData : countriesData;
    list.forEach((feature) => {
      const admin = getFeatureAdmin(feature);
      if (admin) set.add(admin);
    });
    return set;
  }, [countriesData, departmentsData, isDepartmentMode]);

  return {
    isDepartmentMode,
    selectableCountriesData,
    baseRenderCountriesData,
    renderCountriesData,
    selectableFeatureIndex,
    countrySizes,
    visibleRenderCountriesData,
    countriesWithGeometry,
  };
}
