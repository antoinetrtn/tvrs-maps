import * as THREE from "three";

import { GLOBE_STYLE } from "../../config/designSystem";
import { getFoundCapEmissiveIntensity } from "./foundGreenPalette";

// Opacity of found-country caps over the satellite texture.
const SATELLITE_FOUND_OPACITY = 0.5;
// Conquête owner tint over the satellite texture (caps are hidden otherwise).
const SATELLITE_OWNER_OPACITY = 0.62;

/**
 * Satellite theme: caps are hidden over the imagery unless they carry
 * meaning. Found countries get a soft glitch tint instead of the raw
 * triangulation wireframe (which read as a noisy mesh).
 */
export function applySatelliteVisibility(
  material,
  { opaque, found, transitioning, ownerTint, veil = 0 }
) {
  material.visible = true;
  material.transparent = !opaque;
  if (opaque) material.opacity = 1.0;
  else if (found) material.opacity = SATELLITE_FOUND_OPACITY;
  else if (transitioning) material.opacity = 1.0;
  else if (ownerTint) material.opacity = SATELLITE_OWNER_OPACITY;
  else if (veil > 0) material.opacity = veil;
  else material.visible = false;
}

export function resolvePolygonEmissiveProps({
  color,
  kind,
  isIsolated,
  showFoundOnGlobe,
  isHighlightedOnGlobe,
  isDepartmentMode,
  isGhostCountry,
  isGhostVeil = false,
  globeLightingEnabled,
  isLight,
  UI_COLORS,
}) {
  const emissiveHex = UI_COLORS.black;
  const emissiveIntensity = 0;
  const specularHex = new THREE.Color(UI_COLORS.black);
  const shininess = 0.7;

  // Satellite: the ghost world is a flat dark veil, no lighting or highlights.
  if (isGhostVeil) {
    return {
      emissiveHex: color,
      emissiveIntensity: 0,
      specularHex: new THREE.Color(0, 0, 0),
      shininess: 0,
    };
  }

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
