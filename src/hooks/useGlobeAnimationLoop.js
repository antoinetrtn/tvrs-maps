import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getFeatureAdmin } from "../utils";

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
  selectedCountry,
  isError,
  isSuccess,
  isEndScreen,
  transitioningPreviousCountryState,
  selectionTransitionStartRef,
  transitioningPreviousCountryRef,
  setTransitioningPreviousCountryState,
  foundSet,
  getBaseColorForCountryAndKind,
  globeMaterial,
  mountainGlitchUniforms,
  GLOBE_STYLE,
  countriesData,
  departmentsData,
}) {
  const animFrameIdRef = useRef(null);
  const animateSceneRef = useRef(null);
  const lastAnimFrameTimeRef = useRef(0);
  const needsGraticuleStyleRef = useRef(true);
  const graticuleStyleUntilRef = useRef(0);
  const lastGraticuleStyleTimeRef = useRef(0);
  const prevSelectedCountryRef = useRef(null);
  const selectedStrokeObjRef = useRef(null);

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
      const currentIsError = isErrorRef.current;
      const currentIsSuccess = isSuccessRef.current;
      const currentIsEndScreen = isEndScreenRef.current;

      if (perfProfile?.isMobile && lastAnimFrameTimeRef.current) {
        const elapsed = time - lastAnimFrameTimeRef.current;
        if (elapsed < 30) {
          animFrameIdRef.current = requestAnimationFrame(animateScene);
          return;
        }
      }
      lastAnimFrameTimeRef.current = time;

      if (globeMaterial && globeMaterial.userData.shader) {
        if (globeMaterial.userData.shader.uniforms.uTime) {
          globeMaterial.userData.shader.uniforms.uTime.value = time / 1000;
        }
      }

      mountainGlitchUniforms.uTime.value = time / 1000;
      mountainGlitchUniforms.uIsError.value = currentSelectedCountry && currentIsError ? 1.0 : 0.0;
      mountainGlitchUniforms.uIsSuccess.value = currentSelectedCountry && currentIsSuccess ? 1.0 : 0.0;

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
            }
          });
          [oldCapMat, oldSideMat].forEach((mat, index) => {
            if (!mat) return;
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
            } else {
              if (mat.userData.originalColor) {
                mat.color.copy(mat.userData.originalColor);
              }
            }
          });

          if (selectedStrokeObjRef.current) {
            const mat = selectedStrokeObjRef.current.material;
            if (mat && mat.userData.originalColor) {
              mat.color.copy(mat.userData.originalColor);
            }
            selectedStrokeObjRef.current = null;
          }
        }
        prevSelectedCountryRef.current = currentSelectedCountry;

        if (currentSelectedCountry) {
          scene.traverse((obj) => {
            if (
              obj.userData &&
              getFeatureAdmin(obj.userData) === currentSelectedCountry
            ) {
              const isStroke =
                obj.isLine ||
                obj.type === "LineSegments" ||
                obj.type === "Line" ||
                (obj.material &&
                  (obj.material.type === "LineBasicMaterial" ||
                    obj.material.type === "Line2Material" ||
                    obj.material.type === "ShaderMaterial"));
              if (isStroke) {
                selectedStrokeObjRef.current = obj;
              }
            }
          });
        }
      }

      if (currentSelectedCountry) {
        const pulseVal = Math.sin((time / 1000) * Math.PI * 2) * 0.5 + 0.5;
        const capMat = polygonMaterialCacheRef.current.cap.get(currentSelectedCountry);
        const sideMat =
          polygonMaterialCacheRef.current.side.get(currentSelectedCountry);

        [capMat, sideMat].forEach((mat) => {
          if (mat && mat.userData.shader) {
            const shader = mat.userData.shader;
            if (shader.uniforms.uTime) {
              shader.uniforms.uTime.value = time / 1000;
            }
            if (shader.uniforms.uFadeProgress) {
              shader.uniforms.uFadeProgress.value = 0.0;
            }
            if (shader.uniforms.uIsError) {
              shader.uniforms.uIsError.value = currentIsError ? 1.0 : 0.0;
            }
            if (shader.uniforms.uIsSuccess) {
              shader.uniforms.uIsSuccess.value = currentIsSuccess ? 1.0 : 0.0;
            }
            if (shader.uniforms.uIsLight) {
              shader.uniforms.uIsLight.value = isLight ? 1.0 : 0.0;
            }
            if (shader.uniforms.uTheme) {
              shader.uniforms.uTheme.value = UI_COLORS.isBlackoutTheme ? 1.0 : 0.0;
            }
          }
        });

        [capMat, sideMat].forEach((mat, index) => {
          if (!mat) return;
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

            mat.emissiveIntensity =
              baseEmissiveIntensity + emissiveBoost + 0.15 + pulseVal * 0.35;
          } else {
            if (!mat.userData.originalColor) {
              mat.userData.originalColor = mat.color.clone();
            }
            const paperColor = new THREE.Color(UI_COLORS.paper);
            const lerped = mat.userData.originalColor.clone();
            lerped.lerp(paperColor, pulseVal * 0.25);
            mat.color.copy(lerped);
          }
        });

        if (
          selectedStrokeObjRef.current &&
          selectedStrokeObjRef.current.material
        ) {
          const mat = selectedStrokeObjRef.current.material;
          if (!mat.userData.originalColor) {
            mat.userData.originalColor = mat.color.clone();
          }
          const paperColor = new THREE.Color(UI_COLORS.paper);
          const lerped = mat.userData.originalColor.clone();
          lerped.lerp(paperColor, pulseVal * 0.7);
          mat.color.copy(lerped);
          if (mat.needsUpdate !== undefined) {
            mat.needsUpdate = true;
          }
        }
      }

      const prevCountry = transitioningPreviousCountryRef?.current;
      if (prevCountry) {
        const elapsed = time - selectionTransitionStartRef.current;
        const TRANSITION_DURATION = 600;
        const FADE_DELAY = 100;

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
              mat.dispose();
              sharedMaterialsRef.current.delete(key);
            }
          });
        } else {
          let fadeProgress = 0.0;
          if (elapsed > FADE_DELAY) {
            fadeProgress = (elapsed - FADE_DELAY) / (TRANSITION_DURATION - FADE_DELAY);
          }
          [prevCapMat, prevSideMat].forEach((mat, idx) => {
            if (mat && mat.userData.shader) {
              const shader = mat.userData.shader;
              if (shader.uniforms.uTime) {
                shader.uniforms.uTime.value = time / 1000;
              }
              if (shader.uniforms.uFadeProgress) {
                const isMissedOnEnd = currentIsEndScreen && !foundSet.has(prevCountry);
                shader.uniforms.uFadeProgress.value = isMissedOnEnd ? 0.0 : fadeProgress;
              }
              if (shader.uniforms.uTargetColor) {
                const targetKind = idx === 0 ? "cap" : "side";
                shader.uniforms.uTargetColor.value.copy(
                  new THREE.Color(getBaseColorForCountryAndKind(prevCountry, targetKind))
                );
              }
            }
          });
        }
      }

      if (currentIsEndScreen) {
        polygonMaterialCacheRef.current.cap.forEach((mat) => {
          if (mat && mat.userData.shader && mat.userData.shader.uniforms.uTime) {
            mat.userData.shader.uniforms.uTime.value = time / 1000;
          }
        });
      }

      const hasWork =
        currentSelectedCountry ||
        transitioningPreviousCountryRef?.current ||
        !glowSettled ||
        needsGraticuleStyleRef.current ||
        currentIsEndScreen;

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
    selectionTransitionStartRef,
    setTransitioningPreviousCountryState,
    foundSet,
    getBaseColorForCountryAndKind,
    GLOBE_STYLE,
  ]);

  useEffect(() => {
    if (animFrameIdRef.current == null && animateSceneRef.current) {
      animFrameIdRef.current = requestAnimationFrame(animateSceneRef.current);
    }
  }, [selectedCountry, isError, isSuccess, transitioningPreviousCountryState]);

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
