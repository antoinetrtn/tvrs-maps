import { useEffect, useMemo, useRef } from "react";

import { departmentsDataMap } from "../../data/departmentsData";
import { countryDataMap } from "../../data/gameData";
import { usStatesDataMap } from "../../data/usStatesData";
import { publishLayerTestState } from "../../dev/layerTestHook";
import { recordLayerSwitch } from "../../dev/perfSwitchTracker";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import {
  getCanonicalPosition,
  getFeatureAdmin,
  getFeaturePolygons,
  getLngLatBounds,
  getRenderGeometry,
} from "../../utils/utils";
import { bumpPolygonCullRevision, setDormantLayerIds } from "../render/horizonCulling";
import { isModeTransitionLive, MODE_TRANSITION_MS, nowMs } from "../render/modeTransition";
import { getTransitionState } from "../render/polygonColorResolver";
import {
  buildRegionalSlices,
  buildWorldSlices,
  computeResidentRenderCountriesData,
  stampFeatures,
} from "./residentRenderCountriesData";
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
  let list = countriesData;
  if (effectiveDepartmentMode) {
    list = departmentsData;
  } else if (effectiveUsStatesMode) {
    list = usStatesData;
  }
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
  residentLayers,
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

  let targetMode = "world";
  if (isDepartmentMode) {
    targetMode = "departments";
  } else if (isUsStatesMode) {
    targetMode = "us_states";
  }

  let isTargetReady = true;
  if (targetMode === "departments") {
    isTargetReady = hasDepartments;
  } else if (targetMode === "us_states") {
    isTargetReady = hasUsStates;
  }

  let initialEffectiveMode = "world";
  if (isDepartmentMode && hasDepartments) {
    initialEffectiveMode = "departments";
  } else if (isUsStatesMode && hasUsStates) {
    initialEffectiveMode = "us_states";
  }

  const effectiveModeRef = useRef(initialEffectiveMode);

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
  if (nextEffective !== currentEffective) {
    recordLayerSwitch(nextEffective, { from: currentEffective });
  }
  const transitionLive = isModeTransitionLive(modeTransitionRef.current);
  // Stepped colour updates while live (see useModeTransitionSteps).
  const transitionStep = useModeTransitionSteps(modeTransitionRef, transitionLive);

  // Track which regional layers have been prewarmed or visited so their meshes stay resident.
  const residentFlagsRef = useRef({ departments: false, usStates: false });
  if (!hasDepartments) residentFlagsRef.current.departments = false;
  else if (effectiveDepartmentMode || residentLayers?.departmentsReady) {
    residentFlagsRef.current.departments = true;
  }
  if (!hasUsStates) residentFlagsRef.current.usStates = false;
  else if (effectiveUsStatesMode || residentLayers?.usStatesReady) {
    residentFlagsRef.current.usStates = true;
  }

  const worldCountriesRenderData = useMemo(
    () => stampFeatures(countriesData, "c"),
    [countriesData]
  );

  const validCountriesData = useMemo(
    () => worldCountriesRenderData.filter((feature) => countryDataMap[getFeatureAdmin(feature)]),
    [worldCountriesRenderData]
  );

  const validDepartmentsData = useMemo(
    () =>
      stampFeatures(departmentsData, "d").filter(
        (feature) => departmentsDataMap[getFeatureAdmin(feature)]
      ),
    [departmentsData]
  );

  const validUsStatesData = useMemo(
    () =>
      stampFeatures(usStatesData, "u").filter(
        (feature) => usStatesDataMap[getFeatureAdmin(feature)]
      ),
    [usStatesData]
  );

  const selectableCountriesData = useMemo(() => {
    if (effectiveDepartmentMode) return validDepartmentsData;
    if (effectiveUsStatesMode) return validUsStatesData;
    return validCountriesData;
  }, [
    validCountriesData,
    validDepartmentsData,
    validUsStatesData,
    effectiveDepartmentMode,
    effectiveUsStatesMode,
  ]);

  const baseRenderCountriesData = selectableCountriesData;

  const worldSlices = useMemo(
    () => buildWorldSlices(worldCountriesRenderData),
    [worldCountriesRenderData]
  );
  const deptSlices = useMemo(
    () => buildRegionalSlices(validDepartmentsData),
    [validDepartmentsData]
  );
  const usSlices = useMemo(() => buildRegionalSlices(validUsStatesData), [validUsStatesData]);

  const transitionKey = transitionLive ? modeTransitionRef.current.startTime : 0;
  const keepDepartmentsResident = hasDepartments && residentFlagsRef.current.departments;
  const keepUsStatesResident = hasUsStates && residentFlagsRef.current.usStates;

  const renderCountriesData = useMemo(
    () =>
      computeResidentRenderCountriesData({
        transitionKey,
        modeTransitionRef,
        effectiveDepartmentMode,
        effectiveUsStatesMode,
        worldSlices,
        deptSlices,
        usSlices,
        keepDepartmentsResident,
        keepUsStatesResident,
      }),
    [
      transitionKey,
      effectiveDepartmentMode,
      effectiveUsStatesMode,
      worldSlices,
      deptSlices,
      usSlices,
      keepDepartmentsResident,
      keepUsStatesResident,
    ]
  );

  const dormantIds = new Set(
    renderCountriesData.filter((f) => f.isDormantLayerFeature && f.__id).map((f) => f.__id)
  );
  setDormantLayerIds(dormantIds);
  const transState = getTransitionState(modeTransitionRef, transitionStep);
  publishLayerTestState({
    effectiveMode: nextEffective,
    transitionLive,
    transitionProgress: transState ? transState.progress : 1,
    counts: {
      dormant: dormantIds.size,
      departmentsActive: renderCountriesData.filter(
        (f) =>
          f.isDepartmentFeature && !f.isDormantLayerFeature && String(f.__id || "").startsWith("d")
      ).length,
      usActive: renderCountriesData.filter(
        (f) =>
          f.isDepartmentFeature && !f.isDormantLayerFeature && String(f.__id || "").startsWith("u")
      ).length,
      world: renderCountriesData.filter((f) => !f.isDepartmentFeature).length,
    },
  });

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

  useEffect(() => {
    bumpPolygonCullRevision();
  }, [renderCountriesData]);

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
