import * as THREE from "three";

import {
  DESELECT_FADE_START,
  getDeselectGlitchFadeProgress,
  GLITCH_SELECTION_TRANSITION_MS,
} from "../../config/gameConfig";
import { PERFORMANCE } from "../../config/gameConstants";
import { isDeselectResettableMaterial } from "../render/globePolygonMaterial";
import { getCachedMaterial } from "../render/polygonColorResolver";
import { syncSelectedCountryShaderUniforms } from "../render/selectionTransitionShader";

const _transitionTargetColor = new THREE.Color();
const GLOW_EPS = 0.001;

export function shouldThrottleFrame(time, lastTime, isUrgentAnim, perfProfile) {
  if (isUrgentAnim || !lastTime) return false;
  const minFrameMs = perfProfile?.isMobile
    ? PERFORMANCE.animationFrameMs.mobile
    : PERFORMANCE.animationFrameMs.desktop;
  return minFrameMs > 0 && time - lastTime < minFrameMs;
}

export function updateInnerGlow(lighting, targetGlowColor, targetGlowPower, targetGlowCoef) {
  if (!lighting?.innerGlow?.material?.uniforms) return true;
  const uniforms = lighting.innerGlow.material.uniforms;
  const colorDelta =
    Math.abs(uniforms.glowColor.value.r - targetGlowColor.r) +
    Math.abs(uniforms.glowColor.value.g - targetGlowColor.g) +
    Math.abs(uniforms.glowColor.value.b - targetGlowColor.b);
  const powerDelta = Math.abs(targetGlowPower - uniforms.power.value);
  const coefDelta = Math.abs(targetGlowCoef - uniforms.coef.value);
  uniforms.glowColor.value.lerp(targetGlowColor, 0.08);
  uniforms.power.value += (targetGlowPower - uniforms.power.value) * 0.08;
  uniforms.coef.value += (targetGlowCoef - uniforms.coef.value) * 0.08;
  return colorDelta < GLOW_EPS && powerDelta < GLOW_EPS && coefDelta < GLOW_EPS;
}

function resetDeselectedMaterialShader(mat, mode) {
  if (!mat?.userData?.shader) return;
  const shader = mat.userData.shader;
  if (shader.uniforms.uIsError) shader.uniforms.uIsError.value = 0.0;
  if (shader.uniforms.uIsSuccess) shader.uniforms.uIsSuccess.value = 0.0;
  if (shader.uniforms.uIsSelection) shader.uniforms.uIsSelection.value = 0.0;
  // Enter the deselect fade on this very frame: at 0 the shader still shows the
  // flat selection umber (the new selection restarted uSelectStart) for a frame.
  if (mode !== "learn" && shader.uniforms.uFadeProgress) {
    shader.uniforms.uFadeProgress.value = DESELECT_FADE_START;
  }
}

function resetDeselectedMaterialEmissive(mat, isCap, oldAdmin, globeLightingEnabled, GLOBE_STYLE) {
  if (!isDeselectResettableMaterial(mat)) return;
  if (!mat.userData.shader && mat.userData.admin !== oldAdmin) return;

  if (globeLightingEnabled) {
    const baseEmissiveIntensity = isCap
      ? GLOBE_STYLE.lighting.material.capEmissive
      : GLOBE_STYLE.lighting.material.sideEmissive;
    const emissiveBoost = 0.18;
    mat.emissiveIntensity = baseEmissiveIntensity + emissiveBoost;
  } else if (mat.userData.originalColor) {
    mat.color.copy(mat.userData.originalColor);
  }
}

function resetDeselectedCountryMaterials(
  oldCapMat,
  oldSideMat,
  oldAdmin,
  mode,
  globeLightingEnabled,
  GLOBE_STYLE
) {
  resetDeselectedMaterialShader(oldCapMat, mode);
  resetDeselectedMaterialShader(oldSideMat, mode);
  resetDeselectedMaterialEmissive(oldCapMat, true, oldAdmin, globeLightingEnabled, GLOBE_STYLE);
  resetDeselectedMaterialEmissive(oldSideMat, false, oldAdmin, globeLightingEnabled, GLOBE_STYLE);
}

function syncSelectedCountryMaterial(
  mat,
  isCap,
  currentSelectedCountry,
  isError,
  isSuccess,
  isFound
) {
  if (!mat || mat.userData.admin !== currentSelectedCountry) return;
  mat.userData.kind = isCap ? "cap" : "side";
  syncSelectedCountryShaderUniforms({
    shader: mat.userData.shader,
    isError,
    isSuccess,
    isFound,
  });
}

export function updateGraticuleStylesIfNeeded(
  time,
  needsGraticuleStyleRef,
  lastGraticuleStyleTimeRef,
  graticuleStyleUntilRef,
  styleGlobeGraticules,
  updateGlobeLighting
) {
  if (!needsGraticuleStyleRef.current) return;
  if (time - lastGraticuleStyleTimeRef.current > 120) {
    styleGlobeGraticules();
    updateGlobeLighting();
    lastGraticuleStyleTimeRef.current = time;
  }
  if (time > graticuleStyleUntilRef.current) {
    needsGraticuleStyleRef.current = false;
  }
}

export function handleSelectionChangeMaterials(
  prevSelectedCountryRef,
  currentSelectedCountry,
  polygonMaterialCacheRef,
  gameDataMap,
  mode,
  globeLightingEnabled,
  GLOBE_STYLE
) {
  if (prevSelectedCountryRef.current === currentSelectedCountry) return;
  const oldAdmin = prevSelectedCountryRef.current;
  if (oldAdmin) {
    const oldCapMat = getCachedMaterial(polygonMaterialCacheRef.current.cap, oldAdmin, gameDataMap);
    const oldSideMat = getCachedMaterial(
      polygonMaterialCacheRef.current.side,
      oldAdmin,
      gameDataMap
    );
    resetDeselectedCountryMaterials(
      oldCapMat,
      oldSideMat,
      oldAdmin,
      mode,
      globeLightingEnabled,
      GLOBE_STYLE
    );
  }
  prevSelectedCountryRef.current = currentSelectedCountry;
}

export function getCachedMaterialSafe(cache, admin, gameDataMap) {
  return admin ? getCachedMaterial(cache, admin, gameDataMap) : null;
}

export function isUrgentAnimation(isError, isSuccess, prevTransitioning, modeTransitionActive) {
  return isError || isSuccess || Boolean(prevTransitioning) || Boolean(modeTransitionActive);
}

export function hasShaderOnSelected(currentSelectedCountry, capMat, sideMat) {
  return (
    Boolean(currentSelectedCountry) &&
    (Boolean(capMat?.userData?.shader) || Boolean(sideMat?.userData?.shader))
  );
}

export function checkNeedsSharedTime(
  hasAnimatedShaders,
  isError,
  isSuccess,
  prevTransitioning,
  selectedHasShader
) {
  return (
    hasAnimatedShaders && (isError || isSuccess || Boolean(prevTransitioning) || selectedHasShader)
  );
}

export function syncSelectedMaterials(
  capMat,
  sideMat,
  currentSelectedCountry,
  currentIsError,
  currentIsSuccess,
  foundSet
) {
  if (!currentSelectedCountry) return;
  const isFound = foundSet.has(currentSelectedCountry);
  syncSelectedCountryMaterial(
    capMat,
    true,
    currentSelectedCountry,
    currentIsError,
    currentIsSuccess,
    isFound
  );
  syncSelectedCountryMaterial(
    sideMat,
    false,
    currentSelectedCountry,
    currentIsError,
    currentIsSuccess,
    isFound
  );
}

function finishTransitionFade(mat) {
  if (mat?.userData?.shader?.uniforms?.uFadeProgress) {
    mat.userData.shader.uniforms.uFadeProgress.value = 1.0;
  }
}

function primeTargetColorForMaterial(mat, prevCountry, kind, getBaseColorForCountryAndKind) {
  if (mat?.userData?.shader?.uniforms?.uTargetColor) {
    mat.userData.shader.uniforms.uTargetColor.value.copy(
      _transitionTargetColor.set(getBaseColorForCountryAndKind(prevCountry, kind))
    );
  }
}

function applyTransitionShaderProgress(mat, fadeProgress, isFound) {
  if (!mat?.userData?.shader) return;
  const shader = mat.userData.shader;
  if (shader.uniforms.uFadeProgress) {
    shader.uniforms.uFadeProgress.value = fadeProgress;
  }
  if (shader.uniforms.uSelectInTransition) {
    shader.uniforms.uSelectInTransition.value = 0.0;
  }
  if (shader.uniforms.uIsFound) {
    shader.uniforms.uIsFound.value = isFound ? 1.0 : 0.0;
  }
}

export function handleTransitioningPreviousCountry(
  time,
  mode,
  selectionTransitionStartRef,
  transitioningPreviousCountryRef,
  setTransitioningPreviousCountryState,
  polygonMaterialCacheRef,
  gameDataMap,
  transitionColorsPrimedRef,
  getBaseColorForCountryAndKind,
  foundSet
) {
  const prevCountry = mode !== "learn" ? transitioningPreviousCountryRef?.current : null;
  if (!prevCountry) {
    transitionColorsPrimedRef.current = null;
    return;
  }

  const elapsed = time - selectionTransitionStartRef.current;
  const TRANSITION_DURATION = GLITCH_SELECTION_TRANSITION_MS;

  const prevCapMat = getCachedMaterial(
    polygonMaterialCacheRef.current.cap,
    prevCountry,
    gameDataMap
  );
  const prevSideMat = getCachedMaterial(
    polygonMaterialCacheRef.current.side,
    prevCountry,
    gameDataMap
  );

  if (elapsed >= TRANSITION_DURATION) {
    if (transitioningPreviousCountryRef) {
      transitioningPreviousCountryRef.current = null;
    }
    if (setTransitioningPreviousCountryState) {
      setTransitioningPreviousCountryState(null);
    }
    finishTransitionFade(prevCapMat);
    finishTransitionFade(prevSideMat);
    return;
  }

  if (transitionColorsPrimedRef.current !== prevCountry) {
    transitionColorsPrimedRef.current = prevCountry;
    primeTargetColorForMaterial(prevCapMat, prevCountry, "cap", getBaseColorForCountryAndKind);
    primeTargetColorForMaterial(prevSideMat, prevCountry, "side", getBaseColorForCountryAndKind);
  }

  const fadeProgress = Math.min(
    1,
    Math.max(DESELECT_FADE_START, getDeselectGlitchFadeProgress(elapsed, TRANSITION_DURATION))
  );
  const isFound = foundSet.has(prevCountry);
  applyTransitionShaderProgress(prevCapMat, fadeProgress, isFound);
  applyTransitionShaderProgress(prevSideMat, fadeProgress, isFound);
}
