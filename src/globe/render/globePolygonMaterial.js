import * as THREE from "three";

import { GLITCH_EFFECT_SETTINGS } from "../../config/designSystem";
import { countryDataMap } from "../../data/gameData";
import { getGlobePrefs } from "../globePrefs";
import { getCapitalLightsTexture } from "./capitalLightsTexture";
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
  shader.uniforms.uTime = polygonGlitchUniforms.uTime;
  shader.uniforms.uShowcaseLights = polygonGlitchUniforms.uShowcaseLights;
  shader.uniforms.uCapitalLightsMap = { value: getCapitalLightsTexture() };
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
    uniform float uTime;
    uniform float uShowcaseLights;
    uniform sampler2D uCapitalLightsMap;
    ${GLSL_BAYER_4X4_FN}
    float cityCellHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    ${shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      vec3 sphereNormal = normalize(vDitherWorldPos);
      vec3 geomNormal = normalize(vDitherWorldNormal);
      float isSideWall = step(abs(dot(geomNormal, sphereNormal)), 0.55);

      vec3 viewDir = normalize(cameraPosition - vDitherWorldPos);
      float ndv = clamp(dot(sphereNormal, viewDir), 0.0, 1.0);
      float limbFactor = mix(0.95, 1.02, smoothstep(0.0, 0.65, ndv));
      float rimSheen = pow(1.0 - ndv, 3.2) * 0.045;

      float cLat = asin(clamp(sphereNormal.y, -1.0, 1.0));
      float cLng = atan(sphereNormal.x, sphereNormal.z);
      vec2 cartUv = vec2(cLng / 6.2831853 + 0.5, cLat / 3.14159265 + 0.5);
      vec2 topoGrid = cartUv * vec2(72.0, 36.0);
      vec2 topoDist = abs(fract(topoGrid + 0.5) - 0.5) / max(fwidth(topoGrid), vec2(0.001));
      float parallelLine = clamp(1.0 - topoDist.y, 0.0, 1.0);
      float crossTick = clamp(1.0 - max(topoDist.x, topoDist.y) * 0.6, 0.0, 1.0);

      // Blackout -> Awakened country surface & living city-lights network (Solo & Conquête 1v1)
      float surfaceLuma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
      float maxC = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
      float minC = min(gl_FragColor.r, min(gl_FragColor.g, gl_FragColor.b));
      float chroma = maxC - minC;
      float isSoloFound = step(0.45, gl_FragColor.g)
        * step(gl_FragColor.b * 1.32, gl_FragColor.g)
        * step(gl_FragColor.r * 2.2, gl_FragColor.b);
      float isConquestOwned = (1.0 - isSoloFound) * step(0.15, chroma) * step(0.36, maxC);
      float isAwakenedCap = max(isSoloFound, isConquestOwned);
      float isUnfoundDarkCap = (1.0 - isAwakenedCap) * (1.0 - smoothstep(0.44, 0.58, surfaceLuma));
      float cityPower = clamp(max(isAwakenedCap, uShowcaseLights * isUnfoundDarkCap), 0.0, 1.0);

      float blackoutDim = mix(1.0, 0.38, (1.0 - uShowcaseLights) * isUnfoundDarkCap);
      vec3 unfoundLand = gl_FragColor.rgb * blackoutDim;
      vec3 soloAwakenedLand = vec3(0.48, 0.34, 0.15) + vec3(0.15, 0.10, 0.04) * (1.0 - ndv);
      vec3 conquestAwakenedLand = gl_FragColor.rgb * 0.84 + gl_FragColor.rgb * 0.22 * (1.0 - ndv);
      vec3 landSurface = mix(
        mix(unfoundLand, conquestAwakenedLand, isConquestOwned),
        soloAwakenedLand,
        isSoloFound
      );
      vec3 engrave = landSurface * (parallelLine * 0.04 + crossTick * 0.09) + vec3(rimSheen);
      vec3 baseLit = landSurface * limbFactor + engrave;

      vec2 cityCellId = floor(cartUv * vec2(3600.0, 1800.0));
      vec2 capitalSample = texture2D(uCapitalLightsMap, cartUv).rg;
      float cityDensity = capitalSample.r;
      float cityAura = capitalSample.g;
      float cityHash = cityCellHash(cityCellId);
      float cityHash2 = cityCellHash(cityCellId + vec2(37.2, 91.7));
      float trafficWave = 0.80 + 0.20 * sin(uTime * 2.8 - cityAura * 8.5 + cityHash * 6.2831853);
      float satTwinkle = 0.78 + 0.22 * sin(uTime * 4.2 + cityHash2 * 6.2831853);
      float tierPinpoint = step(0.82, cityDensity);
      float tierArterial = (1.0 - tierPinpoint) * step(0.55, cityDensity);
      float tierTentacle = (1.0 - max(tierPinpoint, tierArterial)) * step(0.25, cityDensity);

      vec3 auraColor = mix(
        vec3(0.68, 0.40, 0.12),
        max(baseLit * 1.35, vec3(0.75, 0.55, 0.22)),
        isConquestOwned * 0.5
      );
      vec3 withAura = mix(baseLit, max(baseLit, auraColor), cityAura * 0.32 * cityPower);
      vec3 colorOuterTentacle = mix(
        vec3(0.94, 0.54, 0.16),
        vec3(1.0, 0.84, 0.48),
        isConquestOwned * 0.45
      );
      vec3 colorMainArterial = mix(
        mix(vec3(0.98, 0.72, 0.18), vec3(1.0, 0.84, 0.34), cityHash2),
        vec3(1.0, 0.94, 0.72),
        isConquestOwned * 0.55
      );
      vec3 colorMetroHeart = mix(
        vec3(1.0, 0.94, 0.70),
        vec3(1.0, 0.99, 0.92),
        smoothstep(0.82, 1.0, cityDensity)
      );
      vec3 sparkColor = tierPinpoint * colorMetroHeart
        + tierArterial * colorMainArterial
        + tierTentacle * colorOuterTentacle;
      float sparkAlpha = (
        tierPinpoint * 0.98 +
        tierArterial * (0.78 + 0.16 * cityHash2) * trafficWave +
        tierTentacle * (0.50 + 0.24 * cityHash2) * satTwinkle
      ) * cityPower;
      vec3 capRgb = mix(withAura, sparkColor, clamp(sparkAlpha, 0.0, 1.0));
      vec3 sideRgb = landSurface * 0.58;
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
      float isFoundBorder = step(0.28, gl_FragColor.g)
        * step(gl_FragColor.b * 1.30, gl_FragColor.g)
        * step(gl_FragColor.r * 2.2, gl_FragColor.b);
      vec3 borderColor = mix(gl_FragColor.rgb, vec3(0.98, 0.76, 0.28), isFoundBorder);
      gl_FragColor.rgb = borderColor * mix(0.92, 1.12, borderStep);
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
  polygonGlitchUniforms.uShowcaseLights.value = isHomeScreen || isEndScreen ? 1.0 : 0.0;
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
