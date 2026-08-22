import * as THREE from "three";

import { GLITCH_EFFECT_SETTINGS } from "../../config/designSystem";
import { FEEDBACK_TIMING } from "../../config/gameConstants";
import { departmentsDataMap } from "../../data/departmentsData";
import { countryDataMap } from "../../data/gameData";
import { usStatesDataMap } from "../../data/usStatesData";
import { getFoundGreenThreeColor } from "./foundGreenPalette";
import {
  GLITCH_FRAGMENT_BODY,
  GLITCH_FRAGMENT_DECLARATIONS,
  GLITCH_VERTEX_BODY,
  GLITCH_VERTEX_DECLARATIONS,
} from "./globeShaders";

const capitalVectorCache = new Map();
export function getCapitalVector3(admin, canonicalPositions) {
  if (!admin) return new THREE.Vector3(0, 1, 0);
  const cacheKey = `${admin}`;
  if (capitalVectorCache.has(cacheKey)) {
    return capitalVectorCache.get(cacheKey);
  }
  const canonical = canonicalPositions?.[admin];
  const data = countryDataMap[admin] || departmentsDataMap[admin] || usStatesDataMap[admin];

  const useLat = canonical && typeof canonical.lat === "number" ? canonical.lat : data?.lat;
  const useLng = canonical && typeof canonical.lng === "number" ? canonical.lng : data?.lng;

  const vec = new THREE.Vector3(0, 1, 0);
  if (typeof useLat === "number" && typeof useLng === "number") {
    const radLat = useLat * (Math.PI / 180);
    const radLng = useLng * (Math.PI / 180);
    vec
      .set(
        -Math.cos(radLat) * Math.cos(radLng),
        Math.sin(radLat),
        Math.cos(radLat) * Math.sin(radLng)
      )
      .normalize();
  }
  capitalVectorCache.set(cacheKey, vec);
  return vec;
}

/** Shared GPU uniforms — one write per frame updates every polygon glitch shader. */
export const polygonGlitchUniforms = {
  uTime: { value: 0 },
  uFoundGreen: { value: getFoundGreenThreeColor().clone() },
  // Screen-noise DPR compensation: referencePixelRatio / renderer pixel ratio.
  uPixelScale: { value: 1 },
  // Success flash timeline — stamped (in uTime seconds) when a guess lands.
  uSuccessStart: { value: -10 },
  uSuccessDuration: { value: FEEDBACK_TIMING.successFlashMs / 1000 },
};

const animatedPolygonMaterials = new Set();

export function registerAnimatedPolygonMaterial(material) {
  if (material) animatedPolygonMaterials.add(material);
}

export function unregisterAnimatedPolygonMaterial(material) {
  animatedPolygonMaterials.delete(material);
}

export function clearAnimatedPolygonMaterials() {
  animatedPolygonMaterials.clear();
}

export function getAnimatedPolygonMaterialCount() {
  return animatedPolygonMaterials.size;
}

export function syncPolygonShaderUniforms(
  shader,
  {
    admin,
    selectedCountry,
    isError,
    isSuccess,
    isFound,
    isLearnSelected,
    isIncomingTransitioning,
    kind,
    getBaseColorForCountryAndKind,
    isIsolated,
    isSatellite,
  }
) {
  if (!shader) return;
  const isSelected = isIsolated !== undefined ? isIsolated : admin === selectedCountry;
  if (shader.uniforms.uIsError) {
    shader.uniforms.uIsError.value = isSelected && isError ? 1.0 : 0.0;
  }
  if (shader.uniforms.uIsSuccess) {
    shader.uniforms.uIsSuccess.value = isSelected && isSuccess ? 1.0 : 0.0;
  }
  if (shader.uniforms.uIsFound) {
    shader.uniforms.uIsFound.value = isFound || isLearnSelected ? 1.0 : 0.0;
  }
  if (shader.uniforms.uIsSatellite) {
    shader.uniforms.uIsSatellite.value = isSatellite ? 1.0 : 0.0;
  }
  if (shader.uniforms.uFadeProgress && isSelected) {
    shader.uniforms.uFadeProgress.value = 0.0;
  }
  if (shader.uniforms.uCapitalPos) {
    shader.uniforms.uCapitalPos.value.copy(getCapitalVector3(admin));
  }
  if (shader.uniforms.uTargetColor) {
    shader.uniforms.uTargetColor.value.set(getBaseColorForCountryAndKind(admin, kind));
  }
  if (shader.uniforms.uSelectInTransition) {
    shader.uniforms.uSelectInTransition.value = isIncomingTransitioning ? 1.0 : 0.0;
  }
}

export function attachPolygonGlitchShader(
  material,
  {
    admin,
    kind,
    selectedCountry,
    isError,
    isSuccess,
    isSelectionHighlight,
    isLight,
    isBlackoutTheme,
    isFound,
    isIncomingTransitioning,
    getBaseColorForCountryAndKind,
    isIsolated,
    isSatellite,
  }
) {
  const isSelected = isIsolated !== undefined ? isIsolated : admin === selectedCountry;
  material.customProgramCacheKey = () => `shader-cap-glitch-v10-${kind}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = polygonGlitchUniforms.uTime;
    shader.uniforms.uPixelScale = polygonGlitchUniforms.uPixelScale;
    shader.uniforms.uSuccessStart = polygonGlitchUniforms.uSuccessStart;
    shader.uniforms.uSuccessDuration = polygonGlitchUniforms.uSuccessDuration;
    shader.uniforms.uSideShade = { value: GLITCH_EFFECT_SETTINGS.sideShadeFactor };
    shader.uniforms.uFadeProgress = { value: 0.0 };
    shader.uniforms.uCapitalPos = { value: getCapitalVector3(admin).clone() };
    shader.uniforms.uTargetColor = {
      value: new THREE.Color(getBaseColorForCountryAndKind(admin, kind)),
    };
    shader.uniforms.uFoundGreen = polygonGlitchUniforms.uFoundGreen;
    shader.uniforms.uIsError = {
      value: isSelected && isError ? 1.0 : 0.0,
    };
    shader.uniforms.uIsSuccess = {
      value: isSelected && isSuccess ? 1.0 : 0.0,
    };
    shader.uniforms.uIsSelection = {
      value: isSelected && isSelectionHighlight ? 1.0 : 0.0,
    };
    shader.uniforms.uIsLight = { value: isLight ? 1.0 : 0.0 };
    shader.uniforms.uTheme = { value: isBlackoutTheme ? 1.0 : 0.0 };
    shader.uniforms.uIsSide = { value: kind === "side" ? 1.0 : 0.0 };
    shader.uniforms.uIsFound = { value: isFound ? 1.0 : 0.0 };
    shader.uniforms.uIsSatellite = { value: isSatellite ? 1.0 : 0.0 };
    shader.uniforms.uSelectInTransition = {
      value: isIncomingTransitioning ? 1.0 : 0.0,
    };
    material.userData.shader = shader;
    registerAnimatedPolygonMaterial(material);

    shader.vertexShader = GLITCH_VERTEX_DECLARATIONS + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      `#include <begin_vertex>`,
      `#include <begin_vertex>
      ${GLITCH_VERTEX_BODY}
    `
    );
    shader.vertexShader = shader.vertexShader.replace(
      `#include <project_vertex>`,
      `#include <project_vertex>
      if (length(position) < 10.0) {
        gl_Position = vec4(9999.0, 9999.0, 9999.0, 1.0);
      }
    `
    );

    shader.fragmentShader = GLITCH_FRAGMENT_DECLARATIONS + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <dithering_fragment>`,
      GLITCH_FRAGMENT_BODY
    );
  };
}
