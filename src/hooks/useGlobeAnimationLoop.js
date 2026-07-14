import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getFeatureAdmin } from "../utils/utils";
import {
  GLITCH_SELECTION_TRANSITION_MS,
  getDeselectGlitchFadeProgress,
} from "../config/gameConfig";
import { applyPolygonFeedbackUniforms } from "../utils/applyPolygonFeedbackUniforms";
import { getFoundGreenThreeColor } from "../utils/foundGreenPalette";
import {
  getAnimatedPolygonMaterialCount,
  polygonGlitchUniforms,
  unregisterAnimatedPolygonMaterial,
} from "../utils/polygonGlitchShader";
import { syncSelectedCountryShaderUniforms } from "../utils/selectionTransitionShader";

const _transitionTargetColor = new THREE.Color();

export function useGlobeAnimationLoop({
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
  mode = "countries",
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
  GLOBE_STYLE,
  countriesData,
  departmentsData,
  globeFeedbackRef,
  globeFeedbackApplierRef,
}) {
  const animFrameIdRef = useRef(null);
  const animateSceneRef = useRef(null);
  const lastAnimFrameTimeRef = useRef(0);
  const needsGraticuleStyleRef = useRef(true);
  const graticuleStyleUntilRef = useRef(0);
  const lastGraticuleStyleTimeRef = useRef(0);
  const prevSelectedCountryRef = useRef(null);

  const selectedCountryRef = useRef(null);
  const isErrorRef = useRef(false);
  const isSuccessRef = useRef(false);
  const isEndScreenRef = useRef(false);

  selectedCountryRef.current = selectedCountry;
  isErrorRef.current = isError;
  isSuccessRef.current = isSuccess;
  isEndScreenRef.current = isEndScreen;

  useEffect(() => {
    needsGraticuleStyleRef.current = true;
    graticuleStyleUntilRef.current = performance.now() + 400;
    styleGlobeGraticules();
    updateGlobeLighting();

    const animateScene = () => {
      const scene = globeEl.current?.scene?.();
      if (!scene) {
        animFrameIdRef.current = requestAnimationFrame(animateScene);
        return;
      }

      const time = performance.now();
      const currentSelectedCountry = selectedCountryRef.current;
      const imperativeFeedback = globeFeedbackRef?.current;
      const currentIsError =
        isErrorRef.current || !!imperativeFeedback?.isError;
      const currentIsSuccess =
        isSuccessRef.current || !!imperativeFeedback?.isSuccess;
      const currentIsEndScreen = isEndScreenRef.current;

      const isUrgentAnim =
        currentIsError ||
        currentIsSuccess ||
        !!transitioningPreviousCountryRef?.current;
      const minFrameMs = isUrgentAnim ? 0 : perfProfile?.isMobile ? 30 : 33;
      if (minFrameMs > 0 && lastAnimFrameTimeRef.current) {
        const elapsed = time - lastAnimFrameTimeRef.current;
        if (elapsed < minFrameMs) {
          animFrameIdRef.current = requestAnimationFrame(animateScene);
          return;
        }
      }
      lastAnimFrameTimeRef.current = time;

      const timeSec = time / 1000;

      if (globeMaterial && globeMaterial.userData.shader) {
        if (globeMaterial.userData.shader.uniforms.uTime) {
          globeMaterial.userData.shader.uniforms.uTime.value = timeSec;
        }
      }

      const capMat = currentSelectedCountry
        ? polygonMaterialCacheRef.current.cap.get(currentSelectedCountry)
        : null;
      const sideMat = currentSelectedCountry
        ? polygonMaterialCacheRef.current.side.get(currentSelectedCountry)
        : null;
      const selectedHasShader =
        !!currentSelectedCountry &&
        (!!capMat?.userData?.shader || !!sideMat?.userData?.shader);
      const hasAnimatedShaders = getAnimatedPolygonMaterialCount() > 0;
      const needsSharedTime =
        hasAnimatedShaders &&
        (currentIsEndScreen ||
          currentIsError ||
          currentIsSuccess ||
          !!transitioningPreviousCountryRef?.current ||
          selectedHasShader);

      if (needsSharedTime) {
        polygonGlitchUniforms.uTime.value = timeSec;
      }
      if (currentIsError || currentIsSuccess) {
        polygonGlitchUniforms.uFoundGreen.value.copy(getFoundGreenThreeColor());
      }

      mountainGlitchUniforms.uTime.value = timeSec;
      mountainGlitchUniforms.uIsError.value = currentSelectedCountry && currentIsError ? 1.0 : 0.0;
      mountainGlitchUniforms.uIsSuccess.value = currentSelectedCountry && currentIsSuccess ? 1.0 : 0.0;
      if (currentIsError || currentIsSuccess) {
        mountainGlitchUniforms.uFoundGreen.value.copy(getFoundGreenThreeColor());
      }

      if (needsGraticuleStyleRef.current) {
        if (time - lastGraticuleStyleTimeRef.current > 120) {
          styleGlobeGraticules();
          updateGlobeLighting();
          lastGraticuleStyleTimeRef.current = time;
        }
        if (time > graticuleStyleUntilRef.current) {
          needsGraticuleStyleRef.current = false;
        }
      }

      let glowSettled = true;
      const lighting = globeLightingRef.current;
      if (lighting?.innerGlow?.material?.uniforms) {
        const uniforms = lighting.innerGlow.material.uniforms;
        const target = targetGlowColorRef.current;
        const colorDelta =
          Math.abs(uniforms.glowColor.value.r - target.r) +
          Math.abs(uniforms.glowColor.value.g - target.g) +
          Math.abs(uniforms.glowColor.value.b - target.b);
        const powerDelta = Math.abs(
          targetGlowPowerRef.current - uniforms.power.value,
        );
        const coefDelta = Math.abs(
          targetGlowCoefRef.current - uniforms.coef.value,
        );
        uniforms.glowColor.value.lerp(target, 0.08);
        uniforms.power.value +=
          (targetGlowPowerRef.current - uniforms.power.value) * 0.08;
        uniforms.coef.value +=
          (targetGlowCoefRef.current - uniforms.coef.value) * 0.08;
        const GLOW_EPS = 0.001;
        glowSettled =
          colorDelta < GLOW_EPS &&
          powerDelta < GLOW_EPS &&
          coefDelta < GLOW_EPS;
      }

      if (prevSelectedCountryRef.current !== currentSelectedCountry) {
        const oldAdmin = prevSelectedCountryRef.current;
        if (oldAdmin) {
          const oldCapMat = polygonMaterialCacheRef.current.cap.get(oldAdmin);
          const oldSideMat = polygonMaterialCacheRef.current.side.get(oldAdmin);

          [oldCapMat, oldSideMat].forEach((mat) => {
            if (mat && mat.userData.shader) {
              const shader = mat.userData.shader;
              if (shader.uniforms.uIsError) shader.uniforms.uIsError.value = 0.0;
              if (shader.uniforms.uIsSuccess) shader.uniforms.uIsSuccess.value = 0.0;
              if (shader.uniforms.uIsSelection) shader.uniforms.uIsSelection.value = 0.0;
            }
          });
          [oldCapMat, oldSideMat].forEach((mat, index) => {
            if (!mat || mat.userData.isFoundCap) return;
            if (!mat.userData.shader && mat.userData.admin !== oldAdmin) return;
            const isCap = index === 0;

            if (globeLightingEnabled) {
              const baseEmissiveIntensity = isCap
                ? isLight
                  ? GLOBE_STYLE.lighting.material.capEmissiveLight
                  : GLOBE_STYLE.lighting.material.capEmissiveDark
                : isLight
                  ? GLOBE_STYLE.lighting.material.sideEmissiveLight
                  : GLOBE_STYLE.lighting.material.sideEmissiveDark;
              const emissiveBoost = !isLight ? 0.18 : 0.05;
              mat.emissiveIntensity = baseEmissiveIntensity + emissiveBoost;
            } else if (mat.userData.originalColor) {
              mat.color.copy(mat.userData.originalColor);
            }
          });
        }
        prevSelectedCountryRef.current = currentSelectedCountry;

      }

      const needsSelectedShaderSync =
        !!currentSelectedCountry && (currentIsError || currentIsSuccess);

      if (needsSelectedShaderSync) {
        [capMat, sideMat].forEach((mat, matIndex) => {
          if (!mat || mat.userData.admin !== currentSelectedCountry) return;
          mat.userData.kind = matIndex === 0 ? "cap" : "side";
          syncSelectedCountryShaderUniforms({
            shader: mat.userData.shader,
            isLight,
            isBlackoutTheme: UI_COLORS.isBlackoutTheme,
            isError: currentIsError,
            isSuccess: currentIsSuccess,
            isFound: foundSet.has(currentSelectedCountry),
          });
        });
      }

      const prevCountry =
        mode !== "learn" ? transitioningPreviousCountryRef?.current : null;
      if (prevCountry) {
        const elapsed = time - selectionTransitionStartRef.current;
        const TRANSITION_DURATION = GLITCH_SELECTION_TRANSITION_MS;

        const prevCapMat = polygonMaterialCacheRef.current.cap.get(prevCountry);
        const prevSideMat = polygonMaterialCacheRef.current.side.get(prevCountry);
        if (elapsed >= TRANSITION_DURATION) {
          if (transitioningPreviousCountryRef) {
            transitioningPreviousCountryRef.current = null;
          }
          if (setTransitioningPreviousCountryState) {
            setTransitioningPreviousCountryState(null);
          }
          [prevCapMat, prevSideMat].forEach((mat) => {
            if (mat && mat.userData.shader) {
              const shader = mat.userData.shader;
              if (shader.uniforms.uFadeProgress) {
                const isMissedOnEnd = currentIsEndScreen && !foundSet.has(prevCountry);
                shader.uniforms.uFadeProgress.value = isMissedOnEnd ? 0.0 : 1.0;
              }
            }
          });

          const isMobileStr = perfProfile?.isMobile ? "mobile" : "desktop";
          ["cap", "side"].forEach((kind) => {
            const key = `shader-${prevCountry}-${kind}-${isMobileStr}-${globeTheme}`;
            const mat = sharedMaterialsRef.current.get(key);
            if (mat) {
              unregisterAnimatedPolygonMaterial(mat);
              mat.dispose();
              sharedMaterialsRef.current.delete(key);
            }
            polygonMaterialCacheRef.current[kind]?.delete(prevCountry);
          });
        } else {
          const fadeProgress = Math.min(
            1,
            Math.max(0, getDeselectGlitchFadeProgress(elapsed, TRANSITION_DURATION)),
          );

          [prevCapMat, prevSideMat].forEach((mat, idx) => {
            if (mat && mat.userData.shader) {
              const shader = mat.userData.shader;
              if (shader.uniforms.uFadeProgress) {
                const isMissedOnEnd = currentIsEndScreen && !foundSet.has(prevCountry);
                shader.uniforms.uFadeProgress.value = isMissedOnEnd ? 0.0 : fadeProgress;
              }
              if (shader.uniforms.uTargetColor) {
                const targetKind = idx === 0 ? "cap" : "side";
                shader.uniforms.uTargetColor.value.copy(
                  _transitionTargetColor.set(
                    getBaseColorForCountryAndKind(prevCountry, targetKind),
                  ),
                );
              }
              if (shader.uniforms.uSelectInTransition) {
                shader.uniforms.uSelectInTransition.value = 0.0;
              }
              if (shader.uniforms.uIsFound) {
                shader.uniforms.uIsFound.value = foundSet.has(prevCountry) ? 1.0 : 0.0;
              }
            }
          });
        }
      }

      const hasWork =
        needsSharedTime ||
        needsSelectedShaderSync ||
        transitioningPreviousCountryRef?.current ||
        !glowSettled ||
        needsGraticuleStyleRef.current;

      if (hasWork) {
        animFrameIdRef.current = requestAnimationFrame(animateScene);
      } else {
        animFrameIdRef.current = null;
      }
    };

    animateSceneRef.current = animateScene;

    if (animFrameIdRef.current == null) {
      animFrameIdRef.current = requestAnimationFrame(animateScene);
    }

    return () => {
      if (animFrameIdRef.current != null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [
    globeTheme,
    isLight,
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
    mountainGlitchUniforms,
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

  useEffect(() => {
    if (!globeFeedbackApplierRef) return undefined;
    globeFeedbackApplierRef.current = (admin, { isError = false, isSuccess = false }) => {
      applyPolygonFeedbackUniforms({
        polygonMaterialCacheRef,
        admin,
        isError,
        isSuccess,
        mountainGlitchUniforms,
      });
      if (animFrameIdRef.current == null && animateSceneRef.current) {
        animFrameIdRef.current = requestAnimationFrame(animateSceneRef.current);
      }
    };
    return () => {
      globeFeedbackApplierRef.current = null;
    };
  }, [globeFeedbackApplierRef, polygonMaterialCacheRef, mountainGlitchUniforms]);

  useEffect(() => {
    if (animFrameIdRef.current == null && animateSceneRef.current) {
      animFrameIdRef.current = requestAnimationFrame(animateSceneRef.current);
    }
  }, [selectedCountry, isError, isSuccess, isEndScreen, transitioningPreviousCountryState]);

  useEffect(() => {
    if ((countriesData && countriesData.length > 0) || (departmentsData && departmentsData.length > 0)) {
      needsGraticuleStyleRef.current = true;
      graticuleStyleUntilRef.current = performance.now() + 500;
      updateGlobeLighting();
      styleGlobeGraticules();
      if (animFrameIdRef.current == null && animateSceneRef.current) {
        animFrameIdRef.current = requestAnimationFrame(animateSceneRef.current);
      }
    }
  }, [countriesData, departmentsData, updateGlobeLighting, styleGlobeGraticules]);

  const handleGlobeReady = () => {
    needsGraticuleStyleRef.current = true;
    graticuleStyleUntilRef.current = performance.now() + 400;
    if (animFrameIdRef.current == null && animateSceneRef.current) {
      animFrameIdRef.current = requestAnimationFrame(animateSceneRef.current);
    }
    styleGlobeGraticules();
    updateGlobeLighting();
  };

  return {
    handleGlobeReady,
  };
}
