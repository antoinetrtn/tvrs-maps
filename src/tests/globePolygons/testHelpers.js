import { renderHook } from "@testing-library/react";

import { CONQUEST_PLAYER_COLORS } from "../../config/designSystem";
import { departmentsDataMap } from "../../data/departmentsData";
import { countryDataMap } from "../../data/gameData";
import { usStatesDataMap } from "../../data/usStatesData";
import { useGlobePolygons } from "../../globe/hooks/useGlobePolygons";
import { clearAnimatedPolygonMaterials } from "../../globe/render/polygonGlitchShader";
import { getFeatureAdmin } from "../../utils/utils";

const DUMMY_RING = [
  [
    [2, 46],
    [3, 46],
    [3, 47],
    [2, 47],
    [2, 46],
  ],
];

export const FEATURE_FRANCE = {
  type: "Feature",
  properties: { ADMIN: "France", ISO_A2: "FR", region: "Europe" },
  geometry: { type: "Polygon", coordinates: DUMMY_RING },
};

export const FEATURE_SPAIN = {
  type: "Feature",
  properties: { ADMIN: "Spain", ISO_A2: "ES", region: "Europe" },
  geometry: { type: "Polygon", coordinates: DUMMY_RING },
};

export const FEATURE_BRAZIL = {
  type: "Feature",
  properties: { ADMIN: "Brazil", ISO_A2: "BR", region: "Americas" },
  geometry: { type: "Polygon", coordinates: DUMMY_RING },
};

export const FEATURE_JAPAN = {
  type: "Feature",
  properties: { ADMIN: "Japan", ISO_A2: "JP", region: "Asia" },
  geometry: { type: "Polygon", coordinates: DUMMY_RING },
};

export const FEATURE_DEPT_AIN = {
  type: "Feature",
  properties: { code: "01", name: "Ain", region: "84" },
  isDepartmentFeature: true,
  geometry: { type: "Polygon", coordinates: DUMMY_RING },
};

export const FEATURE_US_CALIFORNIA = {
  type: "Feature",
  properties: { ADMIN: "California", name: "California", region: "West" },
  isDepartmentFeature: true,
  geometry: { type: "Polygon", coordinates: DUMMY_RING },
};

export const FEATURE_RIVER_AMAZON = {
  type: "Feature",
  properties: { ADMIN: "Amazon", name: "Amazon", type: "river", region: "Americas" },
  geometry: { type: "Polygon", coordinates: DUMMY_RING },
};

export const FEATURE_SOMALILAND = {
  type: "Feature",
  properties: { ADMIN: "Somaliland", region: "Africa" },
  geometry: { type: "Polygon", coordinates: DUMMY_RING },
};

const RIVERS_MOUNTAINS_MAP = {
  Amazon: {
    name_en: "Amazon",
    name_fr: "Amazone",
    type: "river",
    length: 6992,
    region: "Americas",
    path: [
      [-3.1, -60.0],
      [-1.5, -50.0],
    ],
  },
  Himalayas: {
    name_en: "Himalayas",
    name_fr: "Himalaya",
    type: "mountain_range",
    height: 8849,
    region: "Asia",
    path: [
      [28.0, 84.0],
      [27.9, 86.9],
    ],
  },
};

export const CONQUEST_OVERLAY_FIXTURE = {
  colors: {
    France: CONQUEST_PLAYER_COLORS.teal,
    Spain: CONQUEST_PLAYER_COLORS.amber,
    Brazil: CONQUEST_PLAYER_COLORS.locked,
  },
  strokes: {
    Spain: CONQUEST_PLAYER_COLORS.ink,
  },
  rings: [],
  neutral: CONQUEST_PLAYER_COLORS.neutral,
  quietFocusId: null,
};

export function resetGlobePolygonTestGlobals() {
  clearAnimatedPolygonMaterials();
}

export function createHookProps(overrides = {}) {
  const isDepartmentMode = Boolean(overrides.isDepartmentMode);
  const isUsStatesMode = Boolean(overrides.isUsStatesMode);
  const mode =
    overrides.mode ??
    (isDepartmentMode ? "departments" : isUsStatesMode ? "us_states" : "countries");
  const defaultGameDataMap = isDepartmentMode
    ? departmentsDataMap
    : isUsStatesMode
      ? usStatesDataMap
      : mode === "rivers_mountains"
        ? RIVERS_MOUNTAINS_MAP
        : countryDataMap;

  return {
    mode,
    globeLightingEnabled: true,
    perfProfile: { isMobile: false, polygonCapCurvatureResolution: 1.5 },
    selectedCountry: null,
    foundSet: new Set(),
    _foundList: [],
    conquestOverlay: null,
    isHomeScreen: false,
    isEndScreen: false,
    gameDataMap: defaultGameDataMap,
    isDepartmentMode,
    isUsStatesMode,
    isPerfectScore: false,
    isError: false,
    isSuccess: false,
    selectionTransition: {
      state: {
        transitioningPreviousCountryState: null,
        transitioningIncomingCountryState: null,
      },
    },
    modeTransitionRef: { current: null },
    transitionStep: 0,
    ...overrides,
  };
}

export function renderPolygons(overrides = {}) {
  return renderHook(() => useGlobePolygons(createHookProps(overrides)));
}

const roundNum = (val) =>
  typeof val === "number" && Number.isFinite(val) ? Number(val.toFixed(4)) : null;

export function summarizeMaterial(material, { compileShader = true } = {}) {
  if (!material) return null;

  if (
    compileShader &&
    material.userData?.isGlitchShaderCap &&
    !material.userData.shader &&
    typeof material.onBeforeCompile === "function"
  ) {
    material.onBeforeCompile({
      uniforms: {},
      vertexShader: "#include <begin_vertex>\n#include <project_vertex>",
      fragmentShader: "#include <dithering_fragment>",
    });
  }

  const u = material.userData?.shader?.uniforms;
  const uniforms = u
    ? {
        uFadeProgress: roundNum(u.uFadeProgress?.value),
        uTargetColor: u.uTargetColor?.value ? `#${u.uTargetColor.value.getHexString()}` : null,
        uIsError: roundNum(u.uIsError?.value),
        uIsSuccess: roundNum(u.uIsSuccess?.value),
        uIsSelection: roundNum(u.uIsSelection?.value),
        uIsLight: roundNum(u.uIsLight?.value),
        uIsSide: roundNum(u.uIsSide?.value),
        uIsFound: roundNum(u.uIsFound?.value),
        uSelectInTransition: roundNum(u.uSelectInTransition?.value),
        uSideShade: roundNum(u.uSideShade?.value),
      }
    : null;

  return {
    type: material.type,
    visible: Boolean(material.visible),
    transparent: Boolean(material.transparent),
    opacity: roundNum(material.opacity),
    wireframe: Boolean(material.wireframe),
    toneMapped: Boolean(material.toneMapped),
    color: material.color ? `#${material.color.getHexString()}` : null,
    emissive: material.emissive ? `#${material.emissive.getHexString()}` : null,
    emissiveIntensity: roundNum(material.emissiveIntensity),
    specular: material.specular ? `#${material.specular.getHexString()}` : null,
    shininess: roundNum(material.shininess),
    programCacheKey:
      typeof material.customProgramCacheKey === "function"
        ? material.customProgramCacheKey()
        : null,
    hasGrainHook: Boolean(!material.userData?.isGlitchShaderCap && material.onBeforeCompile),
    userData: {
      admin: material.userData?.admin ?? null,
      isGlitchShaderCap: Boolean(material.userData?.isGlitchShaderCap),
      isFoundCap: Boolean(material.userData?.isFoundCap),
      isIsolated: Boolean(material.userData?.isIsolated),
      isShared: Boolean(material.userData?.isShared),
    },
    uniforms,
  };
}

export function summarizeFeatureOutput(hookCurrent, feature) {
  const admin = getFeatureAdmin(feature);
  const capMat = hookCurrent.getPolygonCapMaterial(feature);
  const sideMat = hookCurrent.getPolygonSideMaterial(feature);
  return {
    admin,
    color: hookCurrent.getPolygonColor(feature),
    capColorWrapped: hookCurrent.getPolygonCapColorWrapped(feature),
    sideColor: hookCurrent.getPolygonSideColor(feature),
    sideColorWrapped: hookCurrent.getPolygonSideColorWrapped(feature),
    stroke: hookCurrent.getPolygonStroke(feature),
    strokeWrapped: hookCurrent.getPolygonStrokeColorWrapped(feature),
    strokeWidth: roundNum(hookCurrent.getPolygonStrokeWidth(feature)),
    altitude: roundNum(hookCurrent.getPolygonAltitude(feature)),
    curvatureResolution: roundNum(hookCurrent.getPolygonCurvatureResolution(feature)),
    baseCapColor: hookCurrent.getBaseColorForCountryAndKind(admin, "cap"),
    baseSideColor: hookCurrent.getBaseColorForCountryAndKind(admin, "side"),
    capMaterial: summarizeMaterial(capMat),
    sideMaterial: summarizeMaterial(sideMat),
  };
}
