import { useEffect, useRef } from "react";

import { disposeBiomeCache } from "../render/LowPolyBiomes";
import { useGlobeAnimationLoop } from "./useGlobeAnimationLoop";

/** Wires globe animation loop + biome cache lifecycle. */
export function useGlobeSceneAnimation({
  foundList,
  globeEl,
  isLight,
  UI_COLORS,
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
  modeTransitionRef,
  gameDataMap,
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
    modeTransitionRef,
    gameDataMap,
  });

  // The biome geometries/materials are shared and keyed by theme/colour, so they stay
  // valid while the player finds countries. Disposing them on every `foundList`
  // change forced a GPU re-upload (and shader re-link) after each answer in
  // Mountains & Rivers. Release them only when a game is reset (list emptied) or
  // when the globe unmounts.
  const foundCount = foundList.length;
  const previousFoundCountRef = useRef(foundCount);
  useEffect(() => {
    if (previousFoundCountRef.current > 0 && foundCount === 0) disposeBiomeCache();
    previousFoundCountRef.current = foundCount;
  }, [foundCount]);
  useEffect(() => disposeBiomeCache, []);
}
