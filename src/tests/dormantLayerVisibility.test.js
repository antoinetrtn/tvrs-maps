import { afterEach, describe, expect, it } from "vitest";

import { computeResidentRenderCountriesData } from "../globe/hooks/residentRenderCountriesData";
import { isDormantForCull, setDormantLayerIds } from "../globe/render/horizonCulling";

afterEach(() => {
  setDormantLayerIds(new Set());
});

function mesh(feature, { staleDormant = false } = {}) {
  const live = { ...feature };
  // three-globe only assigns __data at mesh creation: simulate a mesh that was
  // first built as dormant, then digest-updated to `live` without refreshing __data.
  const stale = staleDormant ? { ...feature, isDormantLayerFeature: true } : { ...feature };
  return {
    __globeObjType: "polygon",
    visible: true,
    __data: { id: `${feature.__id}_0`, data: stale, coords: [] },
    _live: live,
  };
}

describe("isDormantForCull — must not trust stale obj.__data flags", () => {
  it("keeps a layer hidden only while its __id is in the live dormant set", () => {
    const ain = { __id: "d0", properties: { ADMIN: "Ain" }, isDepartmentFeature: true };
    const obj = mesh(ain, { staleDormant: true });

    // PR 313 regression: stale __data still says dormant after the layer is activated.
    expect(obj.__data.data.isDormantLayerFeature).toBe(true);

    setDormantLayerIds(new Set()); // now active
    expect(isDormantForCull(obj)).toBe(false);

    setDormantLayerIds(new Set(["d0"]));
    expect(isDormantForCull(obj)).toBe(true);
  });

  it("hides a parent country that just became dormant even if stale __data has no flag", () => {
    const france = { __id: "c0", properties: { ADMIN: "France" } };
    const obj = mesh(france, { staleDormant: false });
    expect(obj.__data.data.isDormantLayerFeature).toBeFalsy();

    setDormantLayerIds(new Set(["c0"]));
    expect(isDormantForCull(obj)).toBe(true);
  });
});

describe("resident active vs dormant slices", () => {
  const france = { __id: "c0", properties: { ADMIN: "France" } };
  const spain = { __id: "c1", properties: { ADMIN: "Spain" } };
  const worldSlices = {
    world: [france, spain],
    deptFromWorld: [france, spain],
    deptSettled: [{ ...france, isGhostCountry: true, isDormantLayerFeature: true }, spain],
    usFromWorld: [france, spain],
    usSettled: [france, spain],
    worldFromDept: [france, spain],
    worldFromUs: [france, spain],
  };
  const ain = { __id: "d0", properties: { ADMIN: "Ain" } };
  const deptSlices = {
    active: [{ ...ain, isDepartmentFeature: true }],
    dormant: [{ ...ain, isDepartmentFeature: true, isDormantLayerFeature: true }],
    exiting: [{ ...ain, isExitingDepartmentFeature: true }],
  };
  const usSlices = { active: [], dormant: [], exiting: [] };

  it("marks départements active (not dormant) when the departments layer is the effective mode", () => {
    const data = computeResidentRenderCountriesData({
      transitionKey: 0,
      modeTransitionRef: { current: { fromDept: false, fromUs: false } },
      effectiveDepartmentMode: true,
      effectiveUsStatesMode: false,
      worldSlices,
      deptSlices,
      usSlices,
      keepDepartmentsResident: true,
      keepUsStatesResident: false,
    });
    const depts = data.filter((f) => f.__id === "d0");
    expect(depts).toHaveLength(1);
    expect(depts[0].isDormantLayerFeature).toBeUndefined();
    expect(depts[0].isDepartmentFeature).toBe(true);
    setDormantLayerIds(data.filter((f) => f.isDormantLayerFeature).map((f) => f.__id));
    expect(isDormantForCull(mesh(depts[0], { staleDormant: true }))).toBe(false);
  });

  it("keeps unvisited regional meshes dormant on the world layer", () => {
    const data = computeResidentRenderCountriesData({
      transitionKey: 0,
      modeTransitionRef: { current: { fromDept: false, fromUs: false } },
      effectiveDepartmentMode: false,
      effectiveUsStatesMode: false,
      worldSlices,
      deptSlices,
      usSlices,
      keepDepartmentsResident: true,
      keepUsStatesResident: false,
    });
    const dormant = data.filter((f) => f.isDormantLayerFeature);
    expect(dormant.some((f) => f.__id === "d0")).toBe(true);
    setDormantLayerIds(dormant.map((f) => f.__id));
    expect(
      isDormantForCull(mesh({ __id: "d0", isDepartmentFeature: true }, { staleDormant: true }))
    ).toBe(true);
  });
});
