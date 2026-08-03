import { useEffect, useMemo, useRef } from "react";

import { departmentsDataMap } from "../../data/departmentsData";
import { countryDataMap } from "../../data/gameData";
import { usStatesDataMap } from "../../data/usStatesData";
import {
  getCanonicalPosition,
  getFeatureAdmin,
  getFeaturePolygons,
  getLngLatBounds,
  getLngLatDistance,
  getMobileRenderRadius,
  getRenderGeometry,
} from "../../utils/utils";

function buildTransitionRenderData(trans, countriesData, departmentsData, usStatesData) {
  const activeDept = trans.toDept || trans.fromDept;
  const activeUs = trans.toUs || trans.fromUs;

  const exclusions = [];
  if (activeDept) exclusions.push("France");
  if (activeUs) exclusions.push("United States of America");
  const exclusionSet = new Set(exclusions);

  const ghostWorld = countriesData
    .filter((feature) => !exclusionSet.has(getFeatureAdmin(feature)))
    .map((feature) => ({
      ...feature,
      isGhostCountry: true,
      renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
    }));

  const parentFeatures = countriesData
    .filter((feature) => exclusionSet.has(getFeatureAdmin(feature)))
    .map((feature) => ({
      ...feature,
      isParentCountryFeature: true,
      renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
    }));

  const exitingRegionalData = [];
  const enteringRegionalData = [];

  if (trans.fromDept) {
    exitingRegionalData.push(
      ...departmentsData
        .filter((feature) => departmentsDataMap[getFeatureAdmin(feature)])
        .map((feature) => ({
          ...feature,
          isExitingDepartmentFeature: true,
          renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
        }))
    );
  } else if (trans.toDept) {
    enteringRegionalData.push(
      ...departmentsData
        .filter((feature) => departmentsDataMap[getFeatureAdmin(feature)])
        .map((feature) => ({
          ...feature,
          isEnteringDepartmentFeature: true,
          renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
        }))
    );
  }

  if (trans.fromUs) {
    exitingRegionalData.push(
      ...usStatesData
        .filter((feature) => usStatesDataMap[getFeatureAdmin(feature)])
        .map((feature) => ({
          ...feature,
          isExitingDepartmentFeature: true,
          renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
        }))
    );
  } else if (trans.toUs) {
    enteringRegionalData.push(
      ...usStatesData
        .filter((feature) => usStatesDataMap[getFeatureAdmin(feature)])
        .map((feature) => ({
          ...feature,
          isEnteringDepartmentFeature: true,
          renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
        }))
    );
  }

  return [...ghostWorld, ...parentFeatures, ...exitingRegionalData, ...enteringRegionalData];
}

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
  const modeTransitionRef = useRef({
    active: false,
    fromDept: false,
    fromUs: false,
    toDept: false,
    toUs: false,
    startTime: 0,
    duration: 500,
  });

  const prevModeRef = useRef({ isDepartmentMode, isUsStatesMode });

  useEffect(() => {
    const prev = prevModeRef.current;
    if (prev.isDepartmentMode !== isDepartmentMode || prev.isUsStatesMode !== isUsStatesMode) {
      modeTransitionRef.current = {
        active: true,
        fromDept: prev.isDepartmentMode,
        fromUs: prev.isUsStatesMode,
        toDept: isDepartmentMode,
        toUs: isUsStatesMode,
        startTime: typeof performance !== "undefined" ? performance.now() : Date.now(),
        duration: 500,
      };
      prevModeRef.current = { isDepartmentMode, isUsStatesMode };
    }
  }, [isDepartmentMode, isUsStatesMode]);

  const selectableCountriesData = useMemo(() => {
    if (isDepartmentMode)
      return departmentsData.filter((feature) => departmentsDataMap[getFeatureAdmin(feature)]);
    if (isUsStatesMode)
      return usStatesData.filter((feature) => usStatesDataMap[getFeatureAdmin(feature)]);
    return countriesData.filter((feature) => countryDataMap[getFeatureAdmin(feature)]);
  }, [countriesData, departmentsData, usStatesData, isDepartmentMode, isUsStatesMode]);

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
    const trans = modeTransitionRef.current;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (trans.active && now - trans.startTime >= trans.duration) {
      trans.active = false;
    }

    if (trans.active && !isHomeScreen) {
      return buildTransitionRenderData(trans, countriesData, departmentsData, usStatesData);
    }

    if (!isDepartmentMode && !isUsStatesMode) return worldCountriesRenderData;

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
    worldCountriesRenderData,
    baseRenderCountriesData,
    countriesData,
    departmentsData,
    usStatesData,
    isDepartmentMode,
    isUsStatesMode,
    isHomeScreen,
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

  const canonicalPositions = useMemo(() => {
    const map = {};
    selectableFeatureIndex.forEach((entry) => {
      if (!entry.admin) return;
      const pos = getCanonicalPosition({}, entry.polygons);
      if (pos) {
        map[entry.admin] = pos;
      }
    });
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
    modeTransitionRef,
  };
}
