import { useMemo, useRef } from "react";

import { departmentsDataMap } from "../../data/departmentsData";
import { countryDataMap } from "../../data/gameData";
import { usStatesDataMap } from "../../data/usStatesData";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import {
  getCanonicalPosition,
  getFeatureAdmin,
  getFeaturePolygons,
  getLngLatBounds,
  getRenderGeometry,
} from "../../utils/utils";
import { isModeTransitionLive, MODE_TRANSITION_MS, nowMs } from "../render/modeTransition";
import useModeTransitionSteps from "./useModeTransitionSteps";

/**
 * Features that must stay on the globe while the outgoing layer fades out.
 * The incoming layer is already part of the final data (so the end of the
 * transition only removes meshes instead of rebuilding the whole globe):
 * - leaving a regional layer: its states/departments, faded to the sea;
 * - entering one: the parent country (France / USA) of the world layer.
 */
export function buildExitingFeatures(trans, countriesData, departmentsData, usStatesData) {
  const exiting = [];
  const pushRegional = (features, map) =>
    (features || [])
      .filter((feature) => map[getFeatureAdmin(feature)])
      .forEach((feature) =>
        exiting.push({
          ...feature,
          isExitingDepartmentFeature: true,
          renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
        })
      );
  if (trans.fromDept) pushRegional(departmentsData, departmentsDataMap);
  if (trans.fromUs) pushRegional(usStatesData, usStatesDataMap);

  const fromWorld = !trans.fromDept && !trans.fromUs;
  if (fromWorld) {
    const parents = new Set();
    if (trans.toDept) parents.add("France");
    if (trans.toUs) parents.add("United States of America");
    (countriesData || [])
      .filter((feature) => parents.has(getFeatureAdmin(feature)))
      .forEach((feature) =>
        exiting.push({
          ...feature,
          isParentCountryFeature: true,
          renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
        })
      );
  }
  return exiting;
}

/** Leaving a regional layer: France / USA of the world layer fade in under the exiting states. */
function flagIncomingParents(worldData, trans) {
  const parents = new Set();
  if (trans.fromDept) parents.add("France");
  if (trans.fromUs) parents.add("United States of America");
  return worldData.map((feature) =>
    parents.has(getFeatureAdmin(feature)) ? { ...feature, isParentCountryFeature: true } : feature
  );
}

function resolveNextEffectiveMode(
  targetMode,
  isTargetReady,
  currentEffective,
  hasDepartments,
  hasUsStates
) {
  if (isTargetReady) {
    return targetMode;
  }
  // If incoming data is not ready, stay on previous layer if its data is still valid, else fallback to world.
  if (currentEffective === "departments" && !hasDepartments) {
    return "world";
  }
  if (currentEffective === "us_states" && !hasUsStates) {
    return "world";
  }
  return currentEffective;
}

function updateModeTransition(
  nextEffective,
  currentEffective,
  effectiveModeRef,
  modeTransitionRef,
  reducedMotion,
  effectiveDepartmentMode,
  effectiveUsStatesMode
) {
  if (nextEffective === currentEffective) {
    return;
  }
  const fromDept = currentEffective === "departments";
  const fromUs = currentEffective === "us_states";
  effectiveModeRef.current = nextEffective;
  modeTransitionRef.current = {
    active: !reducedMotion,
    fromDept,
    fromUs,
    toDept: effectiveDepartmentMode,
    toUs: effectiveUsStatesMode,
    startTime: nowMs(),
    duration: MODE_TRANSITION_MS,
  };
}

function computeSelectableCountriesData(
  effectiveDepartmentMode,
  effectiveUsStatesMode,
  departmentsData,
  usStatesData,
  countriesData
) {
  if (effectiveDepartmentMode) {
    return (departmentsData || []).filter(
      (feature) => departmentsDataMap[getFeatureAdmin(feature)]
    );
  }
  if (effectiveUsStatesMode) {
    return (usStatesData || []).filter((feature) => usStatesDataMap[getFeatureAdmin(feature)]);
  }
  return (countriesData || []).filter((feature) => countryDataMap[getFeatureAdmin(feature)]);
}

function computeFinalRenderCountriesData(
  worldCountriesRenderData,
  baseRenderCountriesData,
  countriesData,
  effectiveDepartmentMode,
  effectiveUsStatesMode
) {
  if (!effectiveDepartmentMode && !effectiveUsStatesMode) {
    return worldCountriesRenderData;
  }

  const exclusions = effectiveDepartmentMode ? ["France"] : ["United States of America"];
  const exclusionSet = new Set(exclusions);

  const ghostWorld = countriesData
    .filter((feature) => !exclusionSet.has(getFeatureAdmin(feature)))
    .map((feature) => ({
      ...feature,
      isGhostCountry: true,
      renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
    }));

  return [
    ...ghostWorld,
    ...baseRenderCountriesData.map((feature) => ({
      ...feature,
      isDepartmentFeature: true,
    })),
  ];
}

function computeRenderCountriesData(
  transitionKey,
  modeTransitionRef,
  finalRenderCountriesData,
  countriesData,
  departmentsData,
  usStatesData
) {
  if (!transitionKey) {
    return finalRenderCountriesData;
  }
  const trans = modeTransitionRef.current;
  const exiting = buildExitingFeatures(trans, countriesData, departmentsData, usStatesData);
  const incoming =
    trans.toDept || trans.toUs
      ? finalRenderCountriesData
      : flagIncomingParents(finalRenderCountriesData, trans);
  return [...incoming, ...exiting];
}

function computeSelectableFeatureIndex(selectableCountriesData) {
  return selectableCountriesData
    .map((feature) => {
      const polygons = getFeaturePolygons(feature);
      return {
        admin: getFeatureAdmin(feature),
        bounds: getLngLatBounds(polygons),
        polygons,
      };
    })
    .filter((entry) => entry.admin && entry.polygons.length);
}

function computeCountrySizes(selectableFeatureIndex) {
  const sizes = {};
  selectableFeatureIndex.forEach((entry) => {
    const b = entry.bounds;
    sizes[entry.admin] = Math.max(b.maxLng - b.minLng, b.maxLat - b.minLat);
  });
  return sizes;
}

function computeCountriesWithGeometry(
  effectiveDepartmentMode,
  effectiveUsStatesMode,
  departmentsData,
  usStatesData,
  countriesData
) {
  const set = new Set();
  const list = effectiveDepartmentMode
    ? departmentsData
    : effectiveUsStatesMode
      ? usStatesData
      : countriesData;
  (list || []).forEach((feature) => {
    const admin = getFeatureAdmin(feature);
    if (admin) {
      set.add(admin);
    }
  });
  return set;
}

function computeCanonicalPositions(selectableFeatureIndex, gameDataMap) {
  const map = {};
  selectableFeatureIndex.forEach((entry) => {
    if (!entry.admin) {
      return;
    }
    const pos = getCanonicalPosition({}, entry.polygons);
    if (pos) {
      map[entry.admin] = pos;
    }
  });
  Object.keys(gameDataMap || {}).forEach((k) => {
    if (!map[k]) {
      const d = gameDataMap[k];
      if (d && Array.isArray(d.path) && d.path.length) {
        const pos = getCanonicalPosition(d);
        if (pos) {
          map[k] = pos;
        }
      }
    }
  });
  return map;
}

export function useGlobeRenderData({
  isDepartmentMode = false,
  isUsStatesMode = false,
  isHomeScreen: _isHomeScreen,
  isEndScreen: _isEndScreen,
  countriesData,
  departmentsData,
  usStatesData = [],
  gameDataMap,
  selectedCountry: _selectedCountry,
  perfProfile: _perfProfile,
}) {
  const modeTransitionRef = useRef({
    active: false,
    fromDept: false,
    fromUs: false,
    toDept: false,
    toUs: false,
    startTime: 0,
    duration: MODE_TRANSITION_MS,
  });

  const hasDepartments = Boolean(departmentsData && departmentsData.length > 0);
  const hasUsStates = Boolean(usStatesData && usStatesData.length > 0);

  const targetMode = isDepartmentMode ? "departments" : isUsStatesMode ? "us_states" : "world";

  const isTargetReady =
    targetMode === "departments" ? hasDepartments : targetMode === "us_states" ? hasUsStates : true;

  const effectiveModeRef = useRef(
    isDepartmentMode && hasDepartments
      ? "departments"
      : isUsStatesMode && hasUsStates
        ? "us_states"
        : "world"
  );

  const currentEffective = effectiveModeRef.current;
  const nextEffective = resolveNextEffectiveMode(
    targetMode,
    isTargetReady,
    currentEffective,
    hasDepartments,
    hasUsStates
  );

  const effectiveDepartmentMode = nextEffective === "departments";
  const effectiveUsStatesMode = nextEffective === "us_states";

  const reducedMotion = usePrefersReducedMotion();

  // Started while rendering (not in an effect) so the very first frame of the new
  // layer already carries the transition: an effect landed after the data swap and
  // left the old layer to vanish in a single frame.
  updateModeTransition(
    nextEffective,
    currentEffective,
    effectiveModeRef,
    modeTransitionRef,
    reducedMotion,
    effectiveDepartmentMode,
    effectiveUsStatesMode
  );
  const transitionLive = isModeTransitionLive(modeTransitionRef.current);
  // Stepped colour updates while live (see useModeTransitionSteps).
  const transitionStep = useModeTransitionSteps(modeTransitionRef, transitionLive);

  const selectableCountriesData = useMemo(
    () =>
      computeSelectableCountriesData(
        effectiveDepartmentMode,
        effectiveUsStatesMode,
        departmentsData,
        usStatesData,
        countriesData
      ),
    [countriesData, departmentsData, usStatesData, effectiveDepartmentMode, effectiveUsStatesMode]
  );

  const worldCountriesRenderData = useMemo(() => {
    return countriesData.map((feature) => ({
      ...feature,
      renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
    }));
  }, [countriesData]);

  const baseRenderCountriesData = useMemo(() => {
    return selectableCountriesData.map((feature) => ({
      ...feature,
      renderGeometry: feature.renderGeometry || getRenderGeometry(feature),
    }));
  }, [selectableCountriesData]);

  const finalRenderCountriesData = useMemo(
    () =>
      computeFinalRenderCountriesData(
        worldCountriesRenderData,
        baseRenderCountriesData,
        countriesData,
        effectiveDepartmentMode,
        effectiveUsStatesMode
      ),
    [
      worldCountriesRenderData,
      baseRenderCountriesData,
      countriesData,
      effectiveDepartmentMode,
      effectiveUsStatesMode,
    ]
  );

  // While the layers cross-fade, the outgoing features stay in the data; the
  // incoming ones are the final objects, so the end only removes meshes.
  const transitionKey = transitionLive ? modeTransitionRef.current.startTime : 0;
  const renderCountriesData = useMemo(
    () =>
      computeRenderCountriesData(
        transitionKey,
        modeTransitionRef,
        finalRenderCountriesData,
        countriesData,
        departmentsData,
        usStatesData
      ),
    [transitionKey, finalRenderCountriesData, countriesData, departmentsData, usStatesData]
  );

  const selectableFeatureIndex = useMemo(
    () => computeSelectableFeatureIndex(selectableCountriesData),
    [selectableCountriesData]
  );

  const countrySizes = useMemo(
    () => computeCountrySizes(selectableFeatureIndex),
    [selectableFeatureIndex]
  );

  const countriesWithGeometry = useMemo(
    () =>
      computeCountriesWithGeometry(
        effectiveDepartmentMode,
        effectiveUsStatesMode,
        departmentsData,
        usStatesData,
        countriesData
      ),
    [countriesData, departmentsData, usStatesData, effectiveDepartmentMode, effectiveUsStatesMode]
  );

  const canonicalPositions = useMemo(
    () => computeCanonicalPositions(selectableFeatureIndex, gameDataMap),
    [selectableFeatureIndex, gameDataMap]
  );

  return {
    isDepartmentMode: effectiveDepartmentMode,
    isUsStatesMode: effectiveUsStatesMode,
    effectiveDepartmentMode,
    effectiveUsStatesMode,
    selectableCountriesData,
    baseRenderCountriesData,
    renderCountriesData,
    selectableFeatureIndex,
    countrySizes,
    countriesWithGeometry,
    canonicalPositions,
    modeTransitionRef,
    transitionStep,
    transitionLive,
  };
}
