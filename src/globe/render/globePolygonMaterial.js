import * as THREE from "three";

import { GLITCH_EFFECT_SETTINGS } from "../../config/designSystem";
import { countryDataMap } from "../../data/gameData";
import { registerCountryFeature } from "./countryLandRadius";
import { getFoundCapEmissiveIntensity } from "./foundGreenPalette";
import {
  applyCountryBorderDitherShader,
  applyCountrySurfaceGrainShader,
  defineIgniteReferences,
} from "./globePolygonShaders";
import { isGlobeWebGPU } from "./globeRendererFlag";
import { ensurePaintedTerrain } from "./paintedTerrain";
import { resolvePolygonShaderMode } from "./polygonColorResolver";
import { resolvePolygonEmissiveProps } from "./polygonEmissiveProps";
import {
  attachPolygonGlitchShader,
  getIgniteHolder,
  homeWakeState,
  isCountryRevealing,
  polygonGlitchUniforms,
  syncPolygonShaderUniforms,
} from "./polygonGlitchShader";
import { setSelectionOutline } from "./selectionOutline";
import {
  countryBorderOutputNode,
  toDitheredLineBasicNodeMaterial,
} from "./webgpu/lineMaterialSwap";
import { countryGrainOutputNode, createPhongMaterial } from "./webgpu/surfaceNodes";

export { applyCountryBorderDitherShader, applyCountrySurfaceGrainShader };

/**
 * three-globe resets `material.transparent = opacity < 1` on every polygon
 * digest (each selection change). Border colours are opaque, so the strokes
 * flipped to the opaque pass for a few frames until the next culling pass set
 * them back to transparent (+ needsUpdate → program switch): the borders
 * blinked on every click. Locking the flag keeps the stroke material stable;
 * only its colour changes on selection.
 */
function lockBorderTransparency(mat) {
  if (!mat || mat.userData?.borderTransparencyLocked) return;
  Object.defineProperty(mat, "transparent", {
    configurable: true,
    enumerable: true,
    get: () => true,
    set: () => {},
  });
  mat.userData.borderTransparencyLocked = true;
  mat.needsUpdate = true;
}

function styleBorderMaterial(lineObj, m, allowSwap) {
  if (!m) return m;
  if (m.userData?.hasBorderDither) {
    lockBorderTransparency(m);
    return m;
  }
  m.userData.hasBorderDither = true;
  if (m.isNodeMaterial) {
    m.outputNode = countryBorderOutputNode();
  } else if (allowSwap && isGlobeWebGPU()) {
    const swapped = toDitheredLineBasicNodeMaterial(m);
    swapped.userData.hasBorderDither = true;
    lockBorderTransparency(swapped);
    return swapped;
  } else {
    m.onBeforeCompile = applyCountryBorderDitherShader;
  }
  lockBorderTransparency(m);
  return m;
}

export function stylePolygonBorderLine(lineObj) {
  if (!lineObj?.material) return;
  const mat = lineObj.material;
  if (Array.isArray(mat)) {
    mat.forEach((m) => styleBorderMaterial(lineObj, m, false));
    return;
  }
  const styled = styleBorderMaterial(lineObj, mat, true);
  if (styled !== mat) lineObj.material = styled;
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

function applyShaderCapTransparency(
  material,
  { kind, isFound, isLearnSelected, isIsolated, isPrevTransitioning, isSuccess }
) {
  if (kind === "cap") {
    material.toneMapped = false;
    material.transparent = !(isFound || isLearnSelected || isIsolated || isPrevTransitioning);
    material.opacity = 1.0;
  } else if (kind === "side") {
    const isOpaque = isSuccess || isFound || isLearnSelected;
    material.transparent = !isOpaque;
    material.opacity = isOpaque ? 1.0 : GLITCH_EFFECT_SETTINGS.sideWallOpacity;
  }
}

function syncExistingShaderMaterial(material, opts) {
  const oldTransparent = material.transparent;
  applyShaderCapTransparency(material, opts);
  if (material.transparent !== oldTransparent) {
    material.needsUpdate = true;
  }
  syncPolygonShaderUniforms(material.userData.shader, opts);
}

function buildNewPolygonMaterial(opts) {
  const {
    isFoundCap,
    colorToUse,
    emissiveHex,
    emissiveIntensity,
    specularHex,
    shininess,
    safeColor,
    isShaderCap,
    kind,
    isGhostCountry,
    igniteHolder,
    admin,
    selectedCountry,
    isError,
    isSuccess,
    isSelectionHighlight,
    isFound,
    isLearnSelected,
    isIsolated,
    isPrevTransitioning,
    isIncomingTransitioning,
    getBaseColorForCountryAndKind,
  } = opts;

  const material = createPhongMaterial({
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    depthWrite: true,
  });

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

  if (isShaderCap) {
    applyShaderCapTransparency(material, {
      kind,
      isFound,
      isLearnSelected,
      isIsolated,
      isPrevTransitioning,
      isSuccess,
    });
    attachPolygonGlitchShader(material, {
      admin,
      kind,
      selectedCountry,
      isError,
      isSuccess,
      isSelectionHighlight,
      isFound: isFound || isLearnSelected,
      isIncomingTransitioning,
      getBaseColorForCountryAndKind,
      isIsolated,
    });
  } else if (material.isNodeMaterial) {
    defineIgniteReferences(material, igniteHolder);
    material.outputNode = countryGrainOutputNode(isGhostCountry);
  } else {
    material.customProgramCacheKey = () =>
      isGhostCountry ? "country-grain-ghost" : "country-grain-land";
    material.onBeforeCompile = (shader) =>
      applyCountrySurfaceGrainShader(shader, { isGhostCountry, igniteHolder });
  }

  return material;
}

function isMatchingAdmin(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const cData = countryDataMap[b];
  if (cData && (cData.admin === a || cData.name_en === a || cData.name_fr === a)) return true;
  const aData = countryDataMap[a];
  if (aData && (aData.admin === b || aData.name_en === b || aData.name_fr === b)) return true;
  return false;
}

function resolvePolygonCacheKey({
  kind,
  look,
  ghostSuffix,
  isShaderCap,
  isFoundCapMaterial,
  isDepartmentMode,
  isIsolated,
  admin,
  isMobileStr,
  igniteHolder,
}) {
  let cacheKey = `${kind}-${look}${ghostSuffix}`;
  if (isShaderCap) cacheKey = `shader-${admin}-${kind}-${isMobileStr}${ghostSuffix}`;
  else if (isFoundCapMaterial) cacheKey = `found-cap-${isMobileStr}${ghostSuffix}`;
  else if (isDepartmentMode) cacheKey = `dept-${admin}-${kind}-${look}${ghostSuffix}`;
  else if (isIsolated) cacheKey = `iso-${admin}-${kind}-${look}${ghostSuffix}`;
  if (igniteHolder) cacheKey = `ignite-${admin}-${cacheKey}`;
  return cacheKey;
}

function resolveIgniteHolder(admin, kind, isShaderCap, isGhostCountry) {
  if (isShaderCap || isGhostCountry || !admin) return null;
  if (kind !== "cap" && kind !== "side") return null;
  if (isCountryRevealing(admin, performance.now() / 1000)) {
    return getIgniteHolder(admin);
  }
  return null;
}

function updatePolygonGlitchEnvironment({
  isHomeScreen,
  isEndScreen,
  isDepartmentMode,
  isRiversMountainsMode,
}) {
  polygonGlitchUniforms.uShowcaseLights.value = isHomeScreen || isEndScreen ? 1.0 : 0.0;
  homeWakeState.polygonsReady = true;
  polygonGlitchUniforms.uReducedMotion.value =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? 1
      : 0;
  polygonGlitchUniforms.uIsRegionalMode.value = isDepartmentMode ? 1.0 : 0.0;
  if (isDepartmentMode) ensurePaintedTerrain();
  polygonGlitchUniforms.uFeatureMode.value = isRiversMountainsMode ? 1.0 : 0.0;
}

function resolvePolygonEffectiveColors({
  isShaderCap,
  restingColor,
  color,
  isFound,
  isLearnSelected,
  showFoundOnGlobe,
  isHighlightedOnGlobe,
}) {
  const colorToUse = isShaderCap ? restingColor : color;
  const isFoundOrLearn = isFound || isLearnSelected;
  const showFoundOnGlobeToUse = isShaderCap ? isFoundOrLearn : showFoundOnGlobe;
  const isHighlightedOnGlobeToUse = isShaderCap ? isFoundOrLearn : isHighlightedOnGlobe;
  return { colorToUse, showFoundOnGlobeToUse, isHighlightedOnGlobeToUse };
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
  isRiversMountainsMode = false,
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
  updatePolygonGlitchEnvironment({
    isHomeScreen,
    isEndScreen,
    isDepartmentMode,
    isRiversMountainsMode,
  });
  const isIsolated = isMatchingAdmin(admin, selectedCountry);
  const isPrevTransitioning = isMatchingAdmin(admin, transitioningPreviousCountryState);
  const isIncomingTransitioning = isMatchingAdmin(admin, transitioningIncomingCountryState);
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
    isRegionalMode: Boolean(isDepartmentMode),
  });
  const isShaderCap = shaderMode.useShader;
  const isSelectionHighlight = shaderMode.isSelectionHighlight && !isError && !isSuccess;
  const isMobileStr = perfProfile?.isMobile ? "mobile" : "desktop";

  const { colorToUse, showFoundOnGlobeToUse, isHighlightedOnGlobeToUse } =
    resolvePolygonEffectiveColors({
      isShaderCap,
      restingColor,
      color,
      isFound,
      isLearnSelected,
      showFoundOnGlobe,
      isHighlightedOnGlobe,
    });

  const { emissiveHex, emissiveIntensity, specularHex, shininess } = resolvePolygonEmissiveProps({
    color: colorToUse,
    kind,
    isIsolated,
    showFoundOnGlobe: showFoundOnGlobeToUse,
    isHighlightedOnGlobe: isHighlightedOnGlobeToUse,
    isDepartmentMode,
    isGhostCountry: d.isGhostCountry,
    globeLightingEnabled,
    UI_COLORS,
  });

  const isFoundCapMaterial = showFoundOnGlobe && kind === "cap" && !isShaderCap;
  const look = `${color}-${emissiveHex}-${emissiveIntensity}-${specularHex}-${shininess}-${isMobileStr}`;
  const isGhostCountry = Boolean(d?.isGhostCountry);
  const ghostSuffix = isGhostCountry ? "-ghost" : "";

  registerCountryFeature(admin, d);
  if (isShaderCap && isIsolated && kind === "cap") setSelectionOutline(admin, d?.geometry);
  const igniteHolder = resolveIgniteHolder(admin, kind, isShaderCap, isGhostCountry);
  const cacheKey = resolvePolygonCacheKey({
    kind,
    look,
    ghostSuffix,
    isShaderCap,
    isFoundCapMaterial,
    isDepartmentMode,
    isIsolated,
    admin,
    isMobileStr,
    igniteHolder,
  });

  let material = sharedMaterialsRef.current.get(cacheKey);

  if (!material) {
    material = buildNewPolygonMaterial({
      isFoundCap: isFoundCapMaterial,
      colorToUse,
      emissiveHex,
      emissiveIntensity,
      specularHex,
      shininess,
      safeColor,
      isShaderCap,
      kind,
      isGhostCountry,
      igniteHolder,
      admin,
      selectedCountry,
      isError,
      isSuccess,
      isSelectionHighlight,
      isFound,
      isLearnSelected,
      isIsolated,
      isPrevTransitioning,
      isIncomingTransitioning,
      getBaseColorForCountryAndKind,
    });

    material.userData.isIsolated = isIsolated;
    material.userData.isGlitchShaderCap = isShaderCap;
    material.userData.isShared = !isFoundCapMaterial && !(isDepartmentMode || isIsolated);
    material.userData.admin = admin;
    sharedMaterialsRef.current.set(cacheKey, material);
  } else if (isShaderCap) {
    syncExistingShaderMaterial(material, {
      admin,
      selectedCountry,
      isError,
      isSuccess,
      isFound: isFound || isLearnSelected,
      isLearnSelected,
      isIncomingTransitioning,
      kind,
      getBaseColorForCountryAndKind,
      isIsolated,
      isPrevTransitioning,
    });
  }

  return material;
}
