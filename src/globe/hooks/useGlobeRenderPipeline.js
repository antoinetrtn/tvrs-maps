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
  lastCameraPOVRef: _lastCameraPOVRef,
  lastZoomRef: _lastZoomRef,
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
    perfProfile,
  });

  const {
    selectableFeatureIndex,
    countrySizes,
    renderCountriesData,
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
    countriesWithGeometry,
    canonicalPositions,
    polygonsData,
    modeTransitionRef,
  };
}
