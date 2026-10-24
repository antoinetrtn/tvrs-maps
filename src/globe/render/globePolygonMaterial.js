import * as THREE from "three";

import { GLITCH_EFFECT_SETTINGS } from "../../config/designSystem";
import { countryDataMap } from "../../data/gameData";
import { getGlobePrefs } from "../globePrefs";
import { getFoundCapEmissiveIntensity } from "./foundGreenPalette";
import { isGlobeWebGPU } from "./globeRendererFlag";
import { GLSL_BAYER_4X4_FN } from "./globeShaders";
import { resolvePolygonShaderMode } from "./polygonColorResolver";
import { applySatelliteVisibility, resolvePolygonEmissiveProps } from "./polygonEmissiveProps";
import {
  attachPolygonGlitchShader,
  polygonGlitchUniforms,
  syncPolygonShaderUniforms,
} from "./polygonGlitchShader";
import {
  countryBorderOutputNode,
  toDitheredLineBasicNodeMaterial,
} from "./webgpu/lineMaterialSwap";
import { countryGrainOutputNode, createPhongMaterial } from "./webgpu/surfaceNodes";

/** Wireframe found caps are opaque lines; filled caps keep their own state. */
function applyFoundMeshStyle(material, isMeshFound) {
  if (material.wireframe !== isMeshFound) {
    material.wireframe = isMeshFound;
    material.needsUpdate = true;
  }
  if (!isMeshFound) return;
  material.visible = true;
  if (material.transparent) material.needsUpdate = true;
  material.transparent = false;
  material.opacity = 1;
}

export function applyCountrySurfaceGrainShader(shader) {
  shader.uniforms.uPixelScale = polygonGlitchUniforms.uPixelScale;
  shader.vertexShader = `
    varying vec3 vDitherWorldNormal;
    varying vec3 vDitherWorldPos;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;
    uniform float uPixelScale;
    ${shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vDitherWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vDitherWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vWorldPos = vDitherWorldPos;
      vViewDir = cameraPosition - vDitherWorldPos;
      `
    )}
  `;
  shader.fragmentShader = `
    varying vec3 vDitherWorldNormal;
    varying vec3 vDitherWorldPos;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;
    uniform float uPixelScale;
    ${GLSL_BAYER_4X4_FN}
    ${shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      vec3 sphereNormal = normalize(vDitherWorldPos);
      vec3 geomNormal = normalize(vDitherWorldNormal);
      float isSideWall = step(abs(dot(geomNormal, sphereNormal)), 0.55);

      vec3 viewDir = normalize(cameraPosition - vDitherWorldPos);
      vec3 wNorm = sphereNormal;
      float ndv = clamp(dot(wNorm, viewDir), 0.0, 1.0);
      vec3 keyLightDir = normalize(vec3(-0.45, 0.55, 0.70));
      float keyLight = clamp(dot(wNorm, keyLightDir), 0.0, 1.0);
      float litLevel = clamp(ndv * 0.68 + keyLight * 0.32, 0.0, 1.0);
      float shadeFactor = mix(0.76, 1.08, smoothstep(0.05, 0.95, litLevel));

      vec2 sphereCoord = sphereNormal.xz * 420.0 + vec2(sphereNormal.y * 310.0, sphereNormal.x * 190.0);
      vec2 sphereCell = floor(sphereCoord);
      vec2 sphereFrac = smoothstep(0.0, 1.0, fract(sphereCoord));
      float g00 = fract(sin(dot(sphereCell, vec2(12.9898, 78.233))) * 43758.5453);
      float g10 = fract(sin(dot(sphereCell + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
      float g01 = fract(sin(dot(sphereCell + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
      float g11 = fract(sin(dot(sphereCell + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
      float microGrain = (mix(mix(g00, g10, sphereFrac.x), mix(g01, g11, sphereFrac.x), sphereFrac.y) - 0.5) * 0.018;

      vec3 capRgb = gl_FragColor.rgb * shadeFactor + vec3(microGrain);
      vec3 sideRgb = gl_FragColor.rgb * 0.84;
      gl_FragColor.rgb = mix(capRgb, sideRgb, isSideWall);
      `
    )}
  `;
}

export function applyCountryBorderDitherShader(shader) {
  shader.uniforms.uPixelScale = polygonGlitchUniforms.uPixelScale;
  shader.vertexShader = `
    varying vec3 vBorderWorldPos;
    uniform float uPixelScale;
    ${shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vBorderWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      `
    )}
  `;
  shader.fragmentShader = `
    varying vec3 vBorderWorldPos;
    uniform float uPixelScale;
    ${GLSL_BAYER_4X4_FN}
    ${shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      vec3 borderDir = normalize(vBorderWorldPos);
      float borderLat = asin(clamp(borderDir.y, -1.0, 1.0));
      float borderLng = atan(borderDir.z, borderDir.x);
      float bayer = bayer4x4(floor(vec2(borderLng * 180.0, borderLat * 180.0)));
      float arcPhase = dot(vBorderWorldPos, vec3(0.24, 0.36, 0.48));
      float borderStep = step(0.35, fract(arcPhase + bayer * 0.35));
      gl_FragColor.rgb *= mix(0.92, 1.12, borderStep);
      `
    )}
  `;
}

export function stylePolygonBorderLine(lineObj) {
  if (!lineObj?.material) return;
  const mat = lineObj.material;
  if (Array.isArray(mat)) {
    mat.forEach((m) => {
      if (!m) return;
      if (!m.transparent) {
        m.transparent = true;
        m.needsUpdate = true;
      }
      if (m.userData?.hasBorderDither) return;
      m.userData.hasBorderDither = true;
      if (m.isNodeMaterial) {
        m.outputNode = countryBorderOutputNode();
      } else if (isGlobeWebGPU()) {
        // Handled per array element if ever encountered
        m.onBeforeCompile = applyCountryBorderDitherShader;
      } else {
        m.onBeforeCompile = applyCountryBorderDitherShader;
      }
    });
    return;
  }
  if (!mat.transparent) {
    mat.transparent = true;
    mat.needsUpdate = true;
  }
  if (mat.userData?.hasBorderDither) return;
  mat.userData.hasBorderDither = true;
  if (mat.isNodeMaterial) {
    mat.outputNode = countryBorderOutputNode();
  } else if (isGlobeWebGPU()) {
    lineObj.material = toDitheredLineBasicNodeMaterial(mat);
  } else {
    mat.onBeforeCompile = applyCountryBorderDitherShader;
  }
}

/**
 * Only glitch-shader materials are re-based when their country is deselected.
 * Plain materials (Learn highlight, found caps, regional lands) keep the exact
 * look they were cached with: the old deselect reset dimmed a cached highlight
 * (emissive 1 → 0.26) for the frames before the new material was applied, then
 * re-selecting that country brought it back dark.
 */
export const isDeselectResettableMaterial = (material) =>
  Boolean(material?.userData?.isGlitchShaderCap) && !material.userData.isFoundCap;

export function getPolygonMaterialForFeature({
  d,
  kind,
  color,
  admin,
  selectedCountry,
  showFoundOnGlobe,
  isHighlightedOnGlobe,
  isLearnSelected,
  isFound,
  mode,
  foundSet,
  isEndScreen,
  isHomeScreen,
  isError,
  isSuccess,
  transitioningPreviousCountryState,
  transitioningIncomingCountryState,
  isDepartmentMode,
  globeTheme,
  isLight,
  globeLightingEnabled,
  perfProfile,
  UI_COLORS,
  safeColor,
  sharedMaterialsRef,
  getBaseColorForCountryAndKind,
  mapBase: _mapBase,
  lerpColor: _lerpColor,
  restingColor,
  ownerTint = false, // Conquête: owned country must stay visible over textures
  foundStyle = getGlobePrefs().foundStyle, // Settings: "mesh" = found caps as a line mesh
  ghostVeil = 0, // Satellite regional modes: opacity of the dark veil over the rest of the world
}) {
  const isSameAdmin = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const cData = countryDataMap[b];
    if (cData && (cData.admin === a || cData.name_en === a || cData.name_fr === a)) return true;
    const aData = countryDataMap[a];
    if (aData && (aData.admin === b || aData.name_en === b || aData.name_fr === b)) return true;
    return false;
  };
  const isIsolated = isSameAdmin(admin, selectedCountry);
  const isPrevTransitioning = isSameAdmin(admin, transitioningPreviousCountryState);
  const isIncomingTransitioning = isSameAdmin(admin, transitioningIncomingCountryState);
  const shaderMode = resolvePolygonShaderMode({
    admin,
    kind,
    mode,
    foundSet,
    isIsolated,
    isPrevTransitioning,
    isIncomingTransitioning,
    isEndScreen,
    isHomeScreen,
    isError,
    isSuccess,
  });
  const isShaderCap = shaderMode.useShader;
  const isSelectionHighlight = shaderMode.isSelectionHighlight && !isError && !isSuccess;
  const isMobileStr = perfProfile?.isMobile ? "mobile" : "desktop";

  const colorToUse = isShaderCap ? restingColor : color;
  const showFoundOnGlobeToUse = isShaderCap ? isFound || isLearnSelected : showFoundOnGlobe;
  const isHighlightedOnGlobeToUse = isShaderCap ? isFound || isLearnSelected : isHighlightedOnGlobe;

  const { emissiveHex, emissiveIntensity, specularHex, shininess } = resolvePolygonEmissiveProps({
    color: colorToUse,
    kind,
    isIsolated,
    showFoundOnGlobe: showFoundOnGlobeToUse,
    isHighlightedOnGlobe: isHighlightedOnGlobeToUse,
    isDepartmentMode,
    isGhostCountry: d.isGhostCountry,
    isGhostVeil: ghostVeil > 0 && kind === "cap",
    globeLightingEnabled,
    isLight,
    UI_COLORS,
  });

  const isFoundCapMaterial = showFoundOnGlobe && kind === "cap" && !isShaderCap;
  const look = `${color}-${emissiveHex}-${emissiveIntensity}-${specularHex}-${shininess}-${isMobileStr}-${globeTheme}`;
  // "Maillage" style: found caps drawn as their triangulation wireframe (the
  // satellite look before PR 144), in every theme. The selected country keeps its
  // filled highlight.
  const isMeshFound =
    foundStyle === "mesh" && kind === "cap" && (isFound || showFoundOnGlobe) && !isIsolated;
  const meshSuffix = isMeshFound ? "-mesh" : "";
  let cacheKey = `${kind}-${look}${ownerTint ? "-owner" : ""}${meshSuffix}`;
  if (isShaderCap) cacheKey = `shader-${admin}-${kind}-${isMobileStr}-${globeTheme}${meshSuffix}`;
  else if (isFoundCapMaterial) cacheKey = `found-cap-${isMobileStr}-${globeTheme}${meshSuffix}`;
  else if (ghostVeil > 0) cacheKey = `ghost-veil-${kind}-${look}-${ghostVeil}`;
  else if (isDepartmentMode) cacheKey = `dept-${admin}-${kind}-${look}`;
  else if (isIsolated) cacheKey = `iso-${admin}-${kind}-${look}`;

  let material = sharedMaterialsRef.current.get(cacheKey);

  if (!material) {
    material = createPhongMaterial({
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      depthWrite: true,
    });

    const isFoundCap = showFoundOnGlobe && kind === "cap" && !isShaderCap;
    if (isFoundCap) {
      material.color.set(0x000000);
      material.emissive.set(safeColor(colorToUse));
      material.emissiveIntensity = getFoundCapEmissiveIntensity();
      material.specular.set(0x000000);
      material.shininess = 0;
      material.toneMapped = false;
      material.userData.isFoundCap = true;
    } else {
      material.color.set(safeColor(colorToUse));
      material.emissive.set(safeColor(emissiveHex));
      material.emissiveIntensity = emissiveIntensity;
      material.specular.set(safeColor(specularHex));
      material.shininess = shininess;
    }
    material.flatShading = false;

    const isSatellite = globeTheme === "satellite";
    const shaderNeedsOpaque =
      isShaderCap && (isSuccess || isFound || isLearnSelected || isIsolated);

    if (isSatellite) {
      applySatelliteVisibility(material, {
        opaque: shaderNeedsOpaque || isLearnSelected,
        found: showFoundOnGlobe,
        transitioning: isPrevTransitioning || isIncomingTransitioning,
        ownerTint,
        veil: kind === "cap" ? ghostVeil : 0,
      });
    }

    if (isShaderCap) {
      if (kind === "cap") {
        material.toneMapped = false;
        if (isFound || isLearnSelected || isIsolated || (!isSatellite && isPrevTransitioning)) {
          material.transparent = false;
          material.opacity = 1.0;
        } else {
          material.transparent = true;
          material.opacity = 1.0;
        }
      } else if (kind === "side") {
        if (isSuccess || isFound || isLearnSelected) {
          material.transparent = false;
          material.opacity = 1.0;
        } else {
          material.transparent = true;
          material.opacity = GLITCH_EFFECT_SETTINGS.sideWallOpacity;
        }
      }
      attachPolygonGlitchShader(material, {
        admin,
        kind,
        selectedCountry,
        isError,
        isSuccess,
        isSelectionHighlight,
        isLight,
        isBlackoutTheme: UI_COLORS.isBlackoutTheme,
        isFound: isFound || isLearnSelected,
        isIncomingTransitioning,
        getBaseColorForCountryAndKind,
        isIsolated,
        isSatellite,
      });
    } else {
      if (material.isNodeMaterial) material.outputNode = countryGrainOutputNode();
      else material.onBeforeCompile = applyCountrySurfaceGrainShader;
    }

    material.userData.isIsolated = isIsolated;
    material.userData.isGlitchShaderCap = isShaderCap;
    material.userData.isShared = !isFoundCapMaterial && !(isDepartmentMode || isIsolated);
    material.userData.admin = admin;
    sharedMaterialsRef.current.set(cacheKey, material);
  } else if (isShaderCap) {
    const isSatellite = globeTheme === "satellite";
    const shaderNeedsOpaque =
      isShaderCap && (isSuccess || isFound || isLearnSelected || isIsolated);
    const oldTransparent = material.transparent;

    if (isSatellite) {
      applySatelliteVisibility(material, {
        opaque: shaderNeedsOpaque || isLearnSelected,
        found: showFoundOnGlobe,
        transitioning: isPrevTransitioning || isIncomingTransitioning,
        ownerTint: false,
      });
    }

    if (isShaderCap) {
      if (kind === "cap") {
        material.toneMapped = false;
        if (isFound || isLearnSelected || isIsolated || (!isSatellite && isPrevTransitioning)) {
          material.transparent = false;
          material.opacity = 1.0;
        } else {
          material.transparent = true;
          material.opacity = 1.0;
        }
      } else if (kind === "side") {
        if (isSuccess || isFound || isLearnSelected) {
          material.transparent = false;
          material.opacity = 1.0;
        } else {
          material.transparent = true;
          material.opacity = GLITCH_EFFECT_SETTINGS.sideWallOpacity;
        }
      }
    }

    if (material.transparent !== oldTransparent) {
      material.needsUpdate = true;
    }

    syncPolygonShaderUniforms(material.userData.shader, {
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
    });
  }

  applyFoundMeshStyle(material, isMeshFound);
  return material;
}
