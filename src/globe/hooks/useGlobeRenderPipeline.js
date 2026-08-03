import { useGlobeRenderData } from "./useGlobeRenderData";

export function useGlobeRenderPipeline({
  isDepartmentMode,
  isUsStatesMode,
  isHomeScreen,
  isEndScreen,
  countriesData,
  departmentsData,
  usStatesData,
  gameDataMap,
  selectedCountry,
  lastCameraPOVRef,
  lastZoomRef,
  perfProfile,
  canonicalRef,
}) {
  const renderDataResult = useGlobeRenderData({
    isDepartmentMode,
    isUsStatesMode,
    isHomeScreen,
    isEndScreen,
    countriesData,
    departmentsData,
    usStatesData,
    gameDataMap,
    selectedCountry,
    cameraPOV: lastCameraPOVRef.current,
    zoomLevel: lastZoomRef.current,
    perfProfile,
  });

  const {
    selectableFeatureIndex,
    countrySizes,
    renderCountriesData,
    visibleRenderCountriesData,
    countriesWithGeometry,
    canonicalPositions = {},
    modeTransitionRef,
  } = renderDataResult;

  canonicalRef.current = canonicalPositions;

  // Keep polygonsData reference stable across screen transitions to prevent 3D mesh destruction/flashing
  const polygonsData = renderCountriesData;

  return {
    selectableFeatureIndex,
    countrySizes,
    renderCountriesData,
    visibleRenderCountriesData,
    countriesWithGeometry,
    canonicalPositions,
    polygonsData,
    modeTransitionRef,
  };
}
