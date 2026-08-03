import * as THREE from "three";

import { GLITCH_EFFECT_SETTINGS, GLOBE_STYLE } from "../../config/designSystem";
import { countryDataMap } from "../../data/gameData";
import { getFoundCapEmissiveIntensity } from "./foundGreenPalette";
import { resolvePolygonShaderMode } from "./polygonColorResolver";
import { attachPolygonGlitchShader, syncPolygonShaderUniforms } from "./polygonGlitchShader";

function resolvePolygonEmissiveProps({
  color,
  kind,
  isIsolated,
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
    if (isGhostCountry) {
      return {
        emissiveHex: color,
        emissiveIntensity: 0.12,
        specularHex: new THREE.Color(0, 0, 0),
        shininess: 0,
      };
    }
    if (!isHighlightedOnGlobe) {
      // In regional modes (departments, US states) the resting caps ARE the landmass:
      // they need a lighting-independent emissive floor, otherwise the side of the
      // globe facing away from the key light drops to ocean brightness and whole
      // states become invisible (while staying clickable).
      const isRegionalLandmass = isDepartmentMode && !isGhostCountry && kind === "cap";
      return {
        emissiveHex: color,
        emissiveIntensity: isRegionalLandmass ? (isLight ? 0.08 : 0.12) : 0.05,
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
      emissiveIntensity: kind === "cap" ? (isLight ? 0.08 : 0.12) : isLight ? 0.04 : 0.07,
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
        (isIsolated ? 0.1 : 0) +
        (showFoundOnGlobe && !isIsolated ? 0.14 : 0),
      specularHex: isIsolated ? UI_COLORS.paper : UI_COLORS.mapBorder,
      shininess: baseShininess + (isIsolated ? 30 : isLight ? 0 : 25),
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
  restingColor,
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
    globeLightingEnabled,
    isLight,
    UI_COLORS,
  });

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
      if (shaderNeedsOpaque || isLearnSelected) {
        material.transparent = false;
        material.wireframe = false;
        material.visible = true;
        material.opacity = 1.0;
      } else if (showFoundOnGlobe) {
        material.transparent = false;
        material.wireframe = true;
        material.visible = true;
        material.opacity = 1.0;
      } else if (isPrevTransitioning || isIncomingTransitioning) {
        material.transparent = true;
        material.wireframe = false;
        material.visible = true;
        material.opacity = 1.0;
      } else {
        material.transparent = true;
        material.visible = false;
      }
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
    }

    material.userData.isIsolated = isIsolated;
    material.userData.isShared = !isFoundCapMaterial && !(isDepartmentMode || isIsolated);
    material.userData.admin = admin;
    sharedMaterialsRef.current.set(cacheKey, material);
  } else if (isShaderCap) {
    const isSatellite = globeTheme === "satellite";
    const shaderNeedsOpaque =
      isShaderCap && (isSuccess || isFound || isLearnSelected || isIsolated);
    const oldTransparent = material.transparent;

    if (isSatellite) {
      if (shaderNeedsOpaque || isLearnSelected) {
        material.transparent = false;
        material.wireframe = false;
        material.visible = true;
        material.opacity = 1.0;
      } else if (showFoundOnGlobe) {
        material.transparent = false;
        material.wireframe = true;
        material.visible = true;
        material.opacity = 1.0;
      } else if (isPrevTransitioning || isIncomingTransitioning) {
        material.transparent = true;
        material.wireframe = false;
        material.visible = true;
        material.opacity = 1.0;
      } else {
        material.transparent = true;
        material.visible = false;
      }
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

  return material;
}
