import { useEffect } from "react";

import { disposeBiomeCache } from "../utils/LowPolyBiomes";
import { useGlobeAnimationLoop } from "./useGlobeAnimationLoop";

/** Wires globe animation loop + biome cache lifecycle. */
export function useGlobeSceneAnimation({
  foundList,
  globeEl,
  isLight,
  UI_COLORS,
  globeTheme,
  globeLightingEnabled,
  perfProfile,
  globeLightingRef,
  targetGlowColorRef,
  targetGlowPowerRef,
  targetGlowCoefRef,
  styleGlobeGraticules,
  updateGlobeLighting,
  polygonMaterialCacheRef,
  sharedMaterialsRef,
  mode,
  selectedCountry,
  isError,
  isSuccess,
  isEndScreen,
  selectionTransition,
  foundSet,
  getBaseColorForCountryAndKind,
  lerpColor,
  globeMaterial,
  mountainGlitchUniforms,
  mountainGlitchActive = false,
  GLOBE_STYLE,
  countriesData,
  departmentsData,
  globeFeedbackRef,
  globeFeedbackApplierRef,
}) {
  const {
    transitioningPreviousCountryRef,
    transitioningIncomingCountryRef,
    selectionTransitionStartRef,
  } = selectionTransition.refs;
  const { transitioningPreviousCountryState, transitioningIncomingCountryState } =
    selectionTransition.state;
  const { setTransitioningPreviousCountryState, setTransitioningIncomingCountryState } =
    selectionTransition.setters;

  useGlobeAnimationLoop({
    globeEl,
    isLight,
    UI_COLORS,
    globeTheme,
    globeLightingEnabled,
    perfProfile,
    globeLightingRef,
    targetGlowColorRef,
    targetGlowPowerRef,
    targetGlowCoefRef,
    styleGlobeGraticules,
    updateGlobeLighting,
    polygonMaterialCacheRef,
    sharedMaterialsRef,
    mode,
    selectedCountry,
    isError,
    isSuccess,
    isEndScreen,
    transitioningPreviousCountryState,
    transitioningIncomingCountryState,
    selectionTransitionStartRef,
    transitioningPreviousCountryRef,
    transitioningIncomingCountryRef,
    setTransitioningPreviousCountryState,
    setTransitioningIncomingCountryState,
    foundSet,
    getBaseColorForCountryAndKind,
    lerpColor,
    globeMaterial,
    mountainGlitchUniforms,
    mountainGlitchActive,
    GLOBE_STYLE,
    countriesData,
    departmentsData,
    globeFeedbackRef,
    globeFeedbackApplierRef,
  });

  useEffect(() => {
    if (foundList.length === 0) disposeBiomeCache();
    return () => disposeBiomeCache();
  }, [foundList]);
}
