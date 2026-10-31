import * as THREE from "three";

import { GLITCH_EFFECT_SETTINGS } from "../../config/designSystem";
import { FEEDBACK_TIMING } from "../../config/gameConstants";
import { getCapitalLightsTexture } from "./capitalLightsTexture";
import { DISCOVERY } from "./discoveryTimeline";
import {
  GLITCH_FRAGMENT_BODY,
  GLITCH_FRAGMENT_DECLARATIONS,
  GLITCH_VERTEX_BODY,
  GLITCH_VERTEX_DECLARATIONS,
} from "./globeShaders";
import { getSelectionOutlineTexture, selectionOutlineBox } from "./selectionOutline";
import { attachGlitchNodes } from "./webgpu/glitchNode";

/** Shared GPU uniforms — one write per frame updates every polygon glitch shader. */
export const polygonGlitchUniforms = {
  uTime: { value: 0 },
  // 1 when on Home/End screen (planet-wide city-lights showcase), 0 during active gameplay (blackout -> awaken).
  uShowcaseLights: { value: 1 },
  // 1 when in French Departments or US States regional mode (clean micro-scale hydrography + 1px capital pinpoints).
  uIsRegionalMode: { value: 0 },
  // Screen-noise DPR compensation: referencePixelRatio / renderer pixel ratio.
  uPixelScale: { value: 1 },
  // Deselection tear colours, derived from the globe palette.
  uGlitchTintA: { value: new THREE.Color(0x00ccff) },
  uGlitchTintB: { value: new THREE.Color(0xff00cc) },
  // Success timeline — stamped (in uTime seconds) when a guess lands. uSuccessDuration is
  // the gameplay window (auto-advance) during which the selection shader is still active.
  uSuccessStart: { value: -10 },
  uSuccessDuration: { value: FEEDBACK_TIMING.successFlashMs / 1000 },
  // Progressive discovery reveal (discoveryTimeline.js): start time + land front radius
  // (farthest polygon vertex from the capital) of the latest discovery.
  uRevealStart: { value: -100 },
  uLandRadius: { value: 0.1 },
  // Selection start (uTime seconds): drives the select-in trace/glow ease.
  uSelectStart: { value: -10 },
  // Discovery ignition: a gold wave lights the found country's city pixels outward
  // from its capital (unit direction in world space), over uIgniteDuration seconds.
  uIgniteOrigin: { value: new THREE.Vector3(0, 1, 0) },
  uIgniteStart: { value: -100 },
  uIgniteRadius: { value: 0.1 },
  uIgniteDuration: { value: DISCOVERY.CITY_S },
  // 1 when the user prefers reduced motion: ignition and showcase loops resolve instantly.
  uReducedMotion: { value: 0 },
  // Homepage wake-up progress 0 (blackout) -> 1 (world awake), one-shot per arrival.
  uHomeWake: { value: 1 },
  // Globe camera motion reactivity for magnetic ocean currents.
  uGlobeMotion: { value: 0 },
  uGlobeVelocity: { value: new THREE.Vector2(0, 0) },
};

/**
 * Discovery ignition is per country: each freshly found country gets its own material
 * bound to a per-country holder (own origin, start, radii) so two finds within the
 * reveal window each run their own timeline. Shared materials read the global uniforms
 * with self = 0 (no restart from dark, only a faint spark from a nearby ignition).
 * A country never replays: its timeline is anchored on the stamp time and is only
 * re-stamped by a new correct guess on that same country.
 */
export const igniteState = { admin: null };
const igniteHolders = new Map();

export function getIgniteHolder(admin) {
  let holder = igniteHolders.get(admin);
  if (!holder) {
    holder = {
      self: { value: 0 },
      origin: { value: new THREE.Vector3(0, 1, 0) },
      start: { value: -100 },
      radius: { value: 0.1 },
      duration: { value: polygonGlitchUniforms.uIgniteDuration.value },
      revealStart: { value: -100 },
      landRadius: { value: 0.1 },
    };
    igniteHolders.set(admin, holder);
  }
  return holder;
}

/** Back-compat: the per-country `{ value }` self flag. */
export function getIgniteSelfHolder(admin) {
  return getIgniteHolder(admin).self;
}

/** Copy the latest global ignition stamp into `admin`'s own holder. */
export function markIgnitingCountry(admin) {
  igniteState.admin = admin;
  const h = getIgniteHolder(admin);
  const g = polygonGlitchUniforms;
  h.self.value = 1;
  h.origin.value.copy(g.uIgniteOrigin.value);
  h.start.value = g.uIgniteStart.value;
  h.radius.value = g.uIgniteRadius.value;
  h.duration.value = g.uIgniteDuration.value;
  h.revealStart.value = g.uRevealStart.value;
  h.landRadius.value = g.uLandRadius.value;
}

/** True while `admin`'s own discovery reveal is still running (needs its private material). */
export function isCountryRevealing(admin, time = polygonGlitchUniforms.uTime.value) {
  const h = igniteHolders.get(admin);
  if (!h || h.self.value < 0.5) return false;
  return time < h.revealStart.value + FEEDBACK_TIMING.discoveryRevealMs / 1000 + 0.25;
}

/** Set once country materials are built (homepage wake-up starts then, not on an empty globe). */
export const homeWakeState = { polygonsReady: false };

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
  if (shader.uniforms.uFadeProgress && isSelected) {
    shader.uniforms.uFadeProgress.value = 0.0;
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
    isFound,
    isIncomingTransitioning,
    getBaseColorForCountryAndKind,
    isIsolated,
  }
) {
  const isSelected = isIsolated !== undefined ? isIsolated : admin === selectedCountry;
  if (material.isNodeMaterial) {
    // WebGPU renderer (experimental flag): TSL port with the same uniforms.
    const shader = attachGlitchNodes(material, polygonGlitchUniforms, {
      uSideShade: GLITCH_EFFECT_SETTINGS.sideShadeFactor,
      uFadeProgress: 0,
      uTargetColor: new THREE.Color(getBaseColorForCountryAndKind(admin, kind)),
      uIsError: isSelected && isError ? 1 : 0,
      uIsSuccess: isSelected && isSuccess ? 1 : 0,
      uIsSelection: isSelected && isSelectionHighlight ? 1 : 0,
      uIsSide: kind === "side" ? 1 : 0,
      uIsFound: isFound ? 1 : 0,
      uSelectInTransition: isIncomingTransitioning ? 1 : 0,
    });
    material.userData.shader = shader;
    registerAnimatedPolygonMaterial(material);
    return;
  }
  material.customProgramCacheKey = () => `shader-cap-glitch-v13-${kind}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = polygonGlitchUniforms.uTime;
    shader.uniforms.uPixelScale = polygonGlitchUniforms.uPixelScale;
    shader.uniforms.uGlitchTintA = polygonGlitchUniforms.uGlitchTintA;
    shader.uniforms.uGlitchTintB = polygonGlitchUniforms.uGlitchTintB;
    shader.uniforms.uSuccessStart = polygonGlitchUniforms.uSuccessStart;
    shader.uniforms.uSuccessDuration = polygonGlitchUniforms.uSuccessDuration;
    shader.uniforms.uRevealStart = polygonGlitchUniforms.uRevealStart;
    shader.uniforms.uLandRadius = polygonGlitchUniforms.uLandRadius;
    shader.uniforms.uIgniteOrigin = polygonGlitchUniforms.uIgniteOrigin;
    shader.uniforms.uReducedMotion = polygonGlitchUniforms.uReducedMotion;
    shader.uniforms.uSelectStart = polygonGlitchUniforms.uSelectStart;
    shader.uniforms.uCapitalLightsMap = { value: getCapitalLightsTexture() };
    shader.uniforms.uSelOutlineMap = { value: getSelectionOutlineTexture() };
    shader.uniforms.uSelOutlineBox = selectionOutlineBox;
    shader.uniforms.uSideShade = { value: GLITCH_EFFECT_SETTINGS.sideShadeFactor };
    shader.uniforms.uFadeProgress = { value: 0.0 };
    shader.uniforms.uTargetColor = {
      value: new THREE.Color(getBaseColorForCountryAndKind(admin, kind)),
    };
    shader.uniforms.uIsError = {
      value: isSelected && isError ? 1.0 : 0.0,
    };
    shader.uniforms.uIsSuccess = {
      value: isSelected && isSuccess ? 1.0 : 0.0,
    };
    shader.uniforms.uIsSelection = {
      value: isSelected && isSelectionHighlight ? 1.0 : 0.0,
    };
    shader.uniforms.uIsSide = { value: kind === "side" ? 1.0 : 0.0 };
    shader.uniforms.uIsFound = { value: isFound ? 1.0 : 0.0 };
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
