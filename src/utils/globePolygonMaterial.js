import * as THREE from "three";
import { GLOBE_STYLE } from "../config/designSystem";
import { getFoundCapEmissiveIntensity } from "./foundGreenPalette";
import {
  attachPolygonGlitchShader,
  syncPolygonShaderUniforms,
} from "./polygonGlitchShader";
import { resolvePolygonShaderMode } from "./polygonColorResolver";

function resolvePolygonEmissiveProps({
  color,
  kind,
  admin,
  selectedCountry,
  showFoundOnGlobe,
  isHighlightedOnGlobe,
  isDepartmentMode,
  isGhostCountry,
  globeLightingEnabled,
  isLight,
  UI_COLORS,
}) {
  const emissiveHex = UI_COLORS.black;
  const emissiveIntensity = 0;
  const specularHex = new THREE.Color(UI_COLORS.black);
  const shininess = 0.7;

  if (showFoundOnGlobe && kind === "cap") {
    return {
      emissiveHex: color,
      emissiveIntensity: getFoundCapEmissiveIntensity(),
      specularHex: new THREE.Color(0, 0, 0),
      shininess: 0,
    };
  }

  if (UI_COLORS.polyMatMatte) {
    if (!isHighlightedOnGlobe) {
      return {
        emissiveHex: UI_COLORS.black,
        emissiveIntensity: 0,
        specularHex: new THREE.Color(0, 0, 0),
        shininess: 0,
      };
    }
    return {
      emissiveHex: color,
      emissiveIntensity: getFoundCapEmissiveIntensity(),
      specularHex: new THREE.Color(0, 0, 0),
      shininess: 0,
    };
  }

  if (isDepartmentMode && !isGhostCountry) {
    return {
      emissiveHex: color,
      emissiveIntensity:
        kind === "cap" ? (isLight ? 0.08 : 0.12) : isLight ? 0.04 : 0.07,
      specularHex: UI_COLORS.mapBorder,
      shininess: kind === "cap" ? 2 : 1,
    };
  }

  if (globeLightingEnabled) {
    const baseEmissiveIntensity =
      kind === "cap"
        ? isLight
          ? GLOBE_STYLE.lighting.material.capEmissiveLight
          : GLOBE_STYLE.lighting.material.capEmissiveDark
        : isLight
          ? GLOBE_STYLE.lighting.material.sideEmissiveLight
          : GLOBE_STYLE.lighting.material.sideEmissiveDark;
    const emissiveBoost = !isLight ? 0.18 : 0.05;
    const baseShininess =
      kind === "cap"
        ? isLight
          ? GLOBE_STYLE.lighting.material.capShininessLight
          : GLOBE_STYLE.lighting.material.capShininessDark
        : isLight
          ? GLOBE_STYLE.lighting.material.sideShininessLight
          : GLOBE_STYLE.lighting.material.sideShininessDark;

    return {
      emissiveHex: color,
      emissiveIntensity:
        baseEmissiveIntensity +
        emissiveBoost +
        (admin === selectedCountry ? 0.1 : 0) +
        (showFoundOnGlobe && admin !== selectedCountry ? 0.14 : 0),
      specularHex: admin === selectedCountry ? UI_COLORS.paper : UI_COLORS.mapBorder,
      shininess: baseShininess + (admin === selectedCountry ? 30 : isLight ? 0 : 25),
    };
  }

  return { emissiveHex, emissiveIntensity, specularHex, shininess };
}

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
}) {
  const { emissiveHex, emissiveIntensity, specularHex, shininess } =
    resolvePolygonEmissiveProps({
      color,
      kind,
      admin,
      selectedCountry,
      showFoundOnGlobe,
      isHighlightedOnGlobe,
      isDepartmentMode,
      isGhostCountry: d.isGhostCountry,
      globeLightingEnabled,
      isLight,
      UI_COLORS,
    });

  const isIsolated = admin === selectedCountry;
  const isPrevTransitioning = admin === transitioningPreviousCountryState;
  const isIncomingTransitioning = admin === transitioningIncomingCountryState;
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
  const isSelectionHighlight =
    shaderMode.isSelectionHighlight && !isError && !isSuccess;
  const isMobileStr = perfProfile?.isMobile ? "mobile" : "desktop";

  const isFoundCapMaterial = showFoundOnGlobe && kind === "cap" && !isShaderCap;
  const cacheKey = isShaderCap
    ? `shader-${admin}-${kind}-${isMobileStr}-${globeTheme}`
    : isFoundCapMaterial
      ? `found-cap-${isMobileStr}-${globeTheme}`
      : isDepartmentMode || isIsolated
        ? `${isDepartmentMode ? "dept" : "iso"}-${admin}-${kind}-${color}-${emissiveHex}-${emissiveIntensity}-${specularHex}-${shininess}-${isMobileStr}-${globeTheme}`
        : `${kind}-${color}-${emissiveHex}-${emissiveIntensity}-${specularHex}-${shininess}-${isMobileStr}-${globeTheme}`;

  let material = sharedMaterialsRef.current.get(cacheKey);

  if (!material) {
    material = new THREE.MeshPhongMaterial({
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      depthWrite: true,
    });

    const isFoundCap = showFoundOnGlobe && kind === "cap";
    if (isFoundCap) {
      material.color.set(0x000000);
      material.emissive.set(safeColor(color));
      material.emissiveIntensity = getFoundCapEmissiveIntensity();
      material.specular.set(0x000000);
      material.shininess = 0;
      material.toneMapped = false;
      material.userData.isFoundCap = true;
    } else {
      material.color.set(safeColor(color));
      material.emissive.set(safeColor(emissiveHex));
      material.emissiveIntensity = emissiveIntensity;
      material.specular.set(safeColor(specularHex));
      material.shininess = shininess;
    }
    material.flatShading = false;

    const isSatellite = globeTheme === "satellite";
    const shaderNeedsOpaque =
      isShaderCap &&
      (isSuccess || isFound || isLearnSelected || admin === selectedCountry);

    if (isSatellite) {
      if (shaderNeedsOpaque || showFoundOnGlobe || isLearnSelected) {
        material.transparent = false;
        material.wireframe = false;
        material.opacity = 1.0;
      } else if (isShaderCap && admin === selectedCountry) {
        material.transparent = false;
        material.wireframe = false;
        material.opacity = 1.0;
      } else if (kind === "cap") {
        material.transparent = true;
        material.wireframe = true;
        material.opacity = isLight ? 0.55 : 0.72;
      } else {
        material.transparent = true;
        material.visible = false;
      }
    }

    if (isShaderCap && kind === "cap") {
      material.toneMapped = false;
    }

    if (isShaderCap) {
      if (kind === "side") {
        if (isSuccess || isFound || isLearnSelected) {
          material.transparent = false;
          material.opacity = 1.0;
        } else {
          material.transparent = true;
          material.opacity = 0.55;
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
      });
    }

    material.userData.isIsolated = isIsolated;
    material.userData.isShared =
      !isFoundCapMaterial && !(isDepartmentMode || isIsolated);
    material.userData.admin = admin;
    sharedMaterialsRef.current.set(cacheKey, material);
  } else if (isShaderCap) {
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
    });
  }

  return material;
}