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
  } = renderDataResult;

  canonicalRef.current = canonicalPositions;

  const polygonsData =
    perfProfile?.cullOffscreenCountries && !isHomeScreen && !isEndScreen
      ? visibleRenderCountriesData
      : renderCountriesData;

  return {
    selectableFeatureIndex,
    countrySizes,
    renderCountriesData,
    visibleRenderCountriesData,
    countriesWithGeometry,
    canonicalPositions,
    polygonsData,
  };
}
