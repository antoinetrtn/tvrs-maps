import { useEffect, useRef } from "react";

import { perfTracker } from "../../utils/perfTracker";
import { applyPolygonFeedbackUniforms } from "../render/applyPolygonFeedbackUniforms";
import { loopHasWork } from "../render/globeLoopWork";
import {
  getAnimatedPolygonMaterialCount,
  polygonGlitchUniforms,
} from "../render/polygonGlitchShader";
import {
  checkNeedsSharedTime,
  getCachedMaterialSafe,
  handleSelectionChangeMaterials,
  handleTransitioningPreviousCountry,
  hasShaderOnSelected,
  isUrgentAnimation,
  shouldThrottleFrame,
  syncSelectedMaterials,
  updateGraticuleStylesIfNeeded,
  updateInnerGlow,
} from "./animationLoopHelpers";
import { useGlobeShaderClock } from "./useGlobeShaderClock";

export function useGlobeAnimationLoop({
  globeEl,
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
  mode = "countries",
  selectedCountry,
  isError,
  isSuccess,
  isEndScreen,
  transitioningPreviousCountryState,
  _transitioningIncomingCountryState,
  selectionTransitionStartRef,
  transitioningPreviousCountryRef,
  transitioningIncomingCountryRef,
  setTransitioningPreviousCountryState,
  setTransitioningIncomingCountryState,
  foundSet,
  getBaseColorForCountryAndKind,
  lerpColor,
  globeMaterial,
  GLOBE_STYLE,
  countriesData,
  departmentsData,
  globeFeedbackRef,
  globeFeedbackApplierRef,
  modeTransitionRef,
  gameDataMap,
}) {
  const animFrameIdRef = useRef(null);
  const animateSceneRef = useRef(null);
  const sceneWaitTimeoutRef = useRef(null);
  const transitionColorsPrimedRef = useRef(null);
  const lastAnimFrameTimeRef = useRef(0);
  const needsGraticuleStyleRef = useRef(true);
  const graticuleStyleUntilRef = useRef(0);
  const lastGraticuleStyleTimeRef = useRef(0);
  const prevSelectedCountryRef = useRef(null);
  // Read by useGlobeShaderClock (time uniforms advance per rendered frame).
  const needsSharedTimeRef = useRef(false);
  const globeMaterialRef = useRef(globeMaterial);
  globeMaterialRef.current = globeMaterial;

  const selectedCountryRef = useRef(null);
  const isErrorRef = useRef(false);
  const isSuccessRef = useRef(false);

  const kickLoop = () => {
    if (animFrameIdRef.current == null && sceneWaitTimeoutRef.current == null) {
      animateSceneRef.current?.();
    }
  };

  selectedCountryRef.current = selectedCountry;
  isErrorRef.current = isError;
  isSuccessRef.current = isSuccess;

  useEffect(() => {
    needsGraticuleStyleRef.current = true;
    graticuleStyleUntilRef.current = performance.now() + 400;
    styleGlobeGraticules();
    updateGlobeLighting();

    const clearScheduledFrame = () => {
      if (animFrameIdRef.current != null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (sceneWaitTimeoutRef.current != null) {
        clearTimeout(sceneWaitTimeoutRef.current);
        sceneWaitTimeoutRef.current = null;
      }
    };

    const scheduleFrame = () => {
      clearScheduledFrame();
      animFrameIdRef.current = requestAnimationFrame(animateScene);
    };

    const animateScene = () => {
      animFrameIdRef.current = null;
      const scene = globeEl.current?.scene?.();
      if (!scene) {
        sceneWaitTimeoutRef.current = setTimeout(() => {
          sceneWaitTimeoutRef.current = null;
          scheduleFrame();
        }, 50);
        return;
      }

      const time = performance.now();
      const currentSelectedCountry = selectedCountryRef.current;
      const imperativeFeedback = globeFeedbackRef?.current;
      const currentIsError = isErrorRef.current || Boolean(imperativeFeedback?.isError);
      const currentIsSuccess = isSuccessRef.current || Boolean(imperativeFeedback?.isSuccess);

      const isUrgentAnim = isUrgentAnimation(
        currentIsError,
        currentIsSuccess,
        transitioningPreviousCountryRef?.current,
        modeTransitionRef?.current?.active
      );

      if (shouldThrottleFrame(time, lastAnimFrameTimeRef.current, isUrgentAnim, perfProfile)) {
        scheduleFrame();
        return;
      }

      const frameDelta = lastAnimFrameTimeRef.current ? time - lastAnimFrameTimeRef.current : 16.67;
      lastAnimFrameTimeRef.current = time;

      const renderer = globeEl.current?.renderer?.();
      const drawCalls = renderer?.info?.render?.calls ?? 0;
      const triangles = renderer?.info?.render?.triangles ?? 0;
      perfTracker.recordFrame(frameDelta, drawCalls, triangles);

      const timeSec = time / 1000;

      const capMat = getCachedMaterialSafe(
        polygonMaterialCacheRef.current.cap,
        currentSelectedCountry,
        gameDataMap
      );
      const sideMat = getCachedMaterialSafe(
        polygonMaterialCacheRef.current.side,
        currentSelectedCountry,
        gameDataMap
      );
      const selectedHasShader = hasShaderOnSelected(currentSelectedCountry, capMat, sideMat);
      const hasAnimatedShaders = getAnimatedPolygonMaterialCount() > 0;
      const needsSharedTime = checkNeedsSharedTime(
        hasAnimatedShaders,
        currentIsError,
        currentIsSuccess,
        transitioningPreviousCountryRef?.current,
        selectedHasShader
      );

      needsSharedTimeRef.current = needsSharedTime;
      if (needsSharedTime) {
        polygonGlitchUniforms.uTime.value = timeSec;
      }
      polygonGlitchUniforms.uSelectStart.value = (selectionTransitionStartRef?.current ?? 0) / 1000;

      updateGraticuleStylesIfNeeded(
        time,
        needsGraticuleStyleRef,
        lastGraticuleStyleTimeRef,
        graticuleStyleUntilRef,
        styleGlobeGraticules,
        updateGlobeLighting
      );

      const glowSettled = updateInnerGlow(
        globeLightingRef.current,
        targetGlowColorRef.current,
        targetGlowPowerRef.current,
        targetGlowCoefRef.current
      );

      handleSelectionChangeMaterials(
        prevSelectedCountryRef,
        currentSelectedCountry,
        polygonMaterialCacheRef,
        gameDataMap,
        mode,
        globeLightingEnabled,
        GLOBE_STYLE
      );

      const hasSelectedCountry = Boolean(currentSelectedCountry);

      syncSelectedMaterials(
        capMat,
        sideMat,
        currentSelectedCountry,
        currentIsError,
        currentIsSuccess,
        foundSet
      );

      handleTransitioningPreviousCountry({
        time,
        mode,
        selectionTransitionStartRef,
        transitioningPreviousCountryRef,
        setTransitioningPreviousCountryState,
        polygonMaterialCacheRef,
        gameDataMap,
        transitionColorsPrimedRef,
        getBaseColorForCountryAndKind,
        foundSet,
      });

      const hasWork = loopHasWork({
        needsSharedTime,
        hasSelectedCountry,
        currentIsError,
        currentIsSuccess,
        modeTransitionRef,
        transitioningPreviousCountryRef,
        glowSettled,
        needsGraticuleStyleRef,
      });

      // Idle: stop polling; state changes (selection/feedback/data/theme) re-kick.
      if (hasWork && !document.hidden) {
        scheduleFrame();
      }
    };

    animateSceneRef.current = animateScene;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearScheduledFrame();
      } else if (animFrameIdRef.current == null && sceneWaitTimeoutRef.current == null) {
        scheduleFrame();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (animFrameIdRef.current == null && sceneWaitTimeoutRef.current == null) {
      scheduleFrame();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearScheduledFrame();
    };
  }, [
    UI_COLORS,
    styleGlobeGraticules,
    updateGlobeLighting,
    globeLightingEnabled,
    perfProfile?.isMobile,
    globeEl,
    targetGlowColorRef,
    targetGlowPowerRef,
    targetGlowCoefRef,
    globeLightingRef,
    globeMaterial,
    polygonMaterialCacheRef,
    sharedMaterialsRef,
    transitioningPreviousCountryRef,
    transitioningIncomingCountryRef,
    selectionTransitionStartRef,
    setTransitioningPreviousCountryState,
    setTransitioningIncomingCountryState,
    foundSet,
    getBaseColorForCountryAndKind,
    lerpColor,
    GLOBE_STYLE,
    mode,
  ]);

  useGlobeShaderClock({
    globeEl,
    globeMaterialRef,
    needsSharedTimeRef,
  });

  useEffect(() => {
    if (!globeFeedbackApplierRef) return undefined;
    globeFeedbackApplierRef.current = (admin, { isError = false, isSuccess = false }) => {
      applyPolygonFeedbackUniforms({
        polygonMaterialCacheRef,
        admin,
        isError,
        isSuccess,
      });
      kickLoop();
    };
    return () => {
      globeFeedbackApplierRef.current = null;
    };
  }, [globeFeedbackApplierRef, polygonMaterialCacheRef]);

  useEffect(() => {
    kickLoop();
  }, [selectedCountry, isError, isSuccess, isEndScreen, transitioningPreviousCountryState]);

  useEffect(() => {
    if (
      (countriesData && countriesData.length > 0) ||
      (departmentsData && departmentsData.length > 0)
    ) {
      needsGraticuleStyleRef.current = true;
      graticuleStyleUntilRef.current = performance.now() + 500;
      updateGlobeLighting();
      styleGlobeGraticules();
      kickLoop();
    }
  }, [countriesData, departmentsData, updateGlobeLighting, styleGlobeGraticules]);

  const handleGlobeReady = () => {
    needsGraticuleStyleRef.current = true;
    graticuleStyleUntilRef.current = performance.now() + 400;
    kickLoop();
    styleGlobeGraticules();
    updateGlobeLighting();
  };

  return {
    handleGlobeReady,
  };
}
