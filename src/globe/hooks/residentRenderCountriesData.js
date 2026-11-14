import { getFeatureAdmin, getRenderGeometry } from "../../utils/utils";

export function stampFeatures(features, prefix) {
  return (features || []).map((feature, idx) => {
    const __id = feature.__id || `${prefix}${idx}`;
    const renderGeometry = feature.renderGeometry || getRenderGeometry(feature);
    if (feature.__id === __id && feature.renderGeometry === renderGeometry) return feature;
    return { ...feature, __id, renderGeometry };
  });
}

export function buildWorldSlices(worldCountriesRenderData) {
  const ghostMap = new Map();
  const parentMap = new Map();
  const dormantGhostMap = new Map();

  worldCountriesRenderData.forEach((feature) => {
    const admin = getFeatureAdmin(feature);
    ghostMap.set(feature, { ...feature, isGhostCountry: true });
    if (admin === "France" || admin === "United States of America") {
      parentMap.set(feature, { ...feature, isParentCountryFeature: true });
      dormantGhostMap.set(feature, {
        ...feature,
        isGhostCountry: true,
        isDormantLayerFeature: true,
      });
    }
  });

  const deptFromWorld = worldCountriesRenderData.map((f) =>
    getFeatureAdmin(f) === "France" ? parentMap.get(f) : ghostMap.get(f)
  );
  const deptSettled = worldCountriesRenderData.map((f) =>
    getFeatureAdmin(f) === "France" ? dormantGhostMap.get(f) : ghostMap.get(f)
  );
  const usFromWorld = worldCountriesRenderData.map((f) =>
    getFeatureAdmin(f) === "United States of America" ? parentMap.get(f) : ghostMap.get(f)
  );
  const usSettled = worldCountriesRenderData.map((f) =>
    getFeatureAdmin(f) === "United States of America" ? dormantGhostMap.get(f) : ghostMap.get(f)
  );
  const worldFromDept = worldCountriesRenderData.map((f) =>
    getFeatureAdmin(f) === "France" ? parentMap.get(f) : f
  );
  const worldFromUs = worldCountriesRenderData.map((f) =>
    getFeatureAdmin(f) === "United States of America" ? parentMap.get(f) : f
  );

  return {
    world: worldCountriesRenderData,
    deptFromWorld,
    deptSettled,
    usFromWorld,
    usSettled,
    worldFromDept,
    worldFromUs,
  };
}

export function buildRegionalSlices(validRegionalData) {
  return {
    active: validRegionalData.map((f) => ({ ...f, isDepartmentFeature: true })),
    dormant: validRegionalData.map((f) => ({
      ...f,
      isDepartmentFeature: true,
      isDormantLayerFeature: true,
    })),
    exiting: validRegionalData.map((f) => ({ ...f, isExitingDepartmentFeature: true })),
  };
}

export function computeResidentRenderCountriesData({
  transitionKey,
  modeTransitionRef,
  effectiveDepartmentMode,
  effectiveUsStatesMode,
  worldSlices,
  deptSlices,
  usSlices,
  keepDepartmentsResident,
  keepUsStatesResident,
}) {
  const trans = modeTransitionRef.current;
  const fromWorld = !trans.fromDept && !trans.fromUs;

  let worldSlice = worldSlices.world;
  if (effectiveDepartmentMode) {
    worldSlice = transitionKey && fromWorld ? worldSlices.deptFromWorld : worldSlices.deptSettled;
  } else if (effectiveUsStatesMode) {
    worldSlice = transitionKey && fromWorld ? worldSlices.usFromWorld : worldSlices.usSettled;
  } else if (transitionKey) {
    if (trans.fromDept) worldSlice = worldSlices.worldFromDept;
    else if (trans.fromUs) worldSlice = worldSlices.worldFromUs;
  }

  let deptSlice = [];
  if (effectiveDepartmentMode) {
    deptSlice = deptSlices.active;
  } else if (transitionKey && trans.fromDept) {
    deptSlice = deptSlices.exiting;
  } else if (keepDepartmentsResident) {
    deptSlice = deptSlices.dormant;
  }

  let usSlice = [];
  if (effectiveUsStatesMode) {
    usSlice = usSlices.active;
  } else if (transitionKey && trans.fromUs) {
    usSlice = usSlices.exiting;
  } else if (keepUsStatesResident) {
    usSlice = usSlices.dormant;
  }

  if (deptSlice.length === 0 && usSlice.length === 0) {
    return worldSlice;
  }
  return [...worldSlice, ...deptSlice, ...usSlice];
}
