import * as THREE from "three";

import { GLOBE_STYLE } from "../../config/designSystem";
import { getFoundCapEmissiveIntensity } from "./foundGreenPalette";

function resolveMatteEmissiveProps({
  color,
  kind,
  isGhostCountry,
  isHighlightedOnGlobe,
  isDepartmentMode,
}) {
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

function resolveDepartmentEmissiveProps({ color, kind, UI_COLORS }) {
  const isCap = kind === "cap";
  return {
    emissiveHex: color,
    emissiveIntensity: isCap ? 0.12 : 0.07,
    specularHex: UI_COLORS.mapBorder,
    shininess: isCap ? 2 : 1,
  };
}

function resolveLightingEmissiveProps({ color, kind, isIsolated, showFoundOnGlobe, UI_COLORS }) {
  const isCap = kind === "cap";
  const baseEmissiveIntensity = isCap
    ? GLOBE_STYLE.lighting.material.capEmissive
    : GLOBE_STYLE.lighting.material.sideEmissive;
  const emissiveBoost = 0.18;
  const baseShininess = isCap
    ? GLOBE_STYLE.lighting.material.capShininess
    : GLOBE_STYLE.lighting.material.sideShininess;

  const isolationBonus = isIsolated ? 0.1 : 0;
  const foundBonus = showFoundOnGlobe && !isIsolated ? 0.14 : 0;

  return {
    emissiveHex: color,
    emissiveIntensity: baseEmissiveIntensity + emissiveBoost + isolationBonus + foundBonus,
    specularHex: isIsolated ? UI_COLORS.paper : UI_COLORS.mapBorder,
    shininess: baseShininess + (isIsolated ? 30 : 25),
  };
}

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
  if (showFoundOnGlobe && kind === "cap") {
    return {
      emissiveHex: color,
      emissiveIntensity: getFoundCapEmissiveIntensity(),
      specularHex: new THREE.Color(0, 0, 0),
      shininess: 0,
    };
  }

  if (UI_COLORS.polyMatMatte) {
    return resolveMatteEmissiveProps({
      color,
      kind,
      isGhostCountry,
      isHighlightedOnGlobe,
      isDepartmentMode,
    });
  }

  if (isDepartmentMode && !isGhostCountry) {
    return resolveDepartmentEmissiveProps({ color, kind, UI_COLORS });
  }

  if (globeLightingEnabled) {
    return resolveLightingEmissiveProps({
      color,
      kind,
      isIsolated,
      showFoundOnGlobe,
      UI_COLORS,
    });
  }

  return {
    emissiveHex: UI_COLORS.black,
    emissiveIntensity: 0,
    specularHex: new THREE.Color(UI_COLORS.black),
    shininess: 0.7,
  };
}
