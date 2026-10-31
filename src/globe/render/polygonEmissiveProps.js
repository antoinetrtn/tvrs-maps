import * as THREE from "three";

import { GLOBE_STYLE } from "../../config/designSystem";
import { getFoundCapEmissiveIntensity } from "./foundGreenPalette";

export function resolvePolygonEmissiveProps({
  color,
  kind,
  isIsolated,
  showFoundOnGlobe,
  isHighlightedOnGlobe,
  isDepartmentMode,
  isGhostCountry,
  globeLightingEnabled,
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
        emissiveIntensity: isRegionalLandmass ? 0.12 : 0.05,
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
      emissiveIntensity: kind === "cap" ? 0.12 : 0.07,
      specularHex: UI_COLORS.mapBorder,
      shininess: kind === "cap" ? 2 : 1,
    };
  }

  if (globeLightingEnabled) {
    const baseEmissiveIntensity =
      kind === "cap"
        ? GLOBE_STYLE.lighting.material.capEmissive
        : GLOBE_STYLE.lighting.material.sideEmissive;
    const emissiveBoost = 0.18;
    const baseShininess =
      kind === "cap"
        ? GLOBE_STYLE.lighting.material.capShininess
        : GLOBE_STYLE.lighting.material.sideShininess;

    return {
      emissiveHex: color,
      emissiveIntensity:
        baseEmissiveIntensity +
        emissiveBoost +
        (isIsolated ? 0.1 : 0) +
        (showFoundOnGlobe && !isIsolated ? 0.14 : 0),
      specularHex: isIsolated ? UI_COLORS.paper : UI_COLORS.mapBorder,
      shininess: baseShininess + (isIsolated ? 30 : 25),
    };
  }

  return { emissiveHex, emissiveIntensity, specularHex, shininess };
}
