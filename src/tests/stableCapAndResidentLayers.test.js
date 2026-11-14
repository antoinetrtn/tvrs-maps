import { describe, expect, it } from "vitest";

import {
  getPolygonCapResolution,
  getStableGlobeCapResolution,
  HIGH_LAT_GHOST_COUNTRIES,
  POLYGON_CAP_RESOLUTION,
} from "../config/gameConfig";
import { getLastPerfSwitch, isPerfSwitchEnabled } from "../dev/perfSwitchTracker";
import { computeResidentRenderCountriesData } from "../globe/hooks/residentRenderCountriesData";

describe("getStableGlobeCapResolution", () => {
  const base = 3;

  it("is mode-invariant for a typical country (world and ghost share one cap step)", () => {
    const france = { properties: { ADMIN: "France" } };
    const asGhost = { ...france, isGhostCountry: true };
    const world = getStableGlobeCapResolution(france, base);
    const ghost = getStableGlobeCapResolution(asGhost, base);
    expect(world).toBe(ghost);
    expect(world).toBe(getPolygonCapResolution({ baseResolution: base, isGhost: false }));
  });

  it("keeps high-latitude / large-span countries on the ghost cap in both modes", () => {
    expect(HIGH_LAT_GHOST_COUNTRIES.has("Canada")).toBe(true);
    const canada = { properties: { ADMIN: "Canada" } };
    const asGhost = { ...canada, isGhostCountry: true };
    const expected = getPolygonCapResolution({ baseResolution: 3, isGhost: true });
    expect(getStableGlobeCapResolution(canada, 3)).toBe(expected);
    expect(getStableGlobeCapResolution(asGhost, 3)).toBe(expected);
    expect(expected).toBe(POLYGON_CAP_RESOLUTION.ghost);
  });

  it("still uses the regional cap for départements / states", () => {
    const ain = { properties: { ADMIN: "Ain" }, isDepartmentFeature: true };
    expect(getStableGlobeCapResolution(ain, 3)).toBe(
      getPolygonCapResolution({ baseResolution: 3, isRegional: true })
    );
  });
});

describe("computeResidentRenderCountriesData", () => {
  const france = { __id: "c0", properties: { ADMIN: "France" } };
  const spain = { __id: "c1", properties: { ADMIN: "Spain" } };
  const worldSlices = {
    world: [france, spain],
    deptFromWorld: [france, spain],
    deptSettled: [france, spain],
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
  const modeTransitionRef = { current: { fromDept: false, fromUs: false } };

  it("keeps département meshes as dormant on the world layer (no hole, no drop)", () => {
    const data = computeResidentRenderCountriesData({
      transitionKey: 0,
      modeTransitionRef,
      effectiveDepartmentMode: false,
      effectiveUsStatesMode: false,
      worldSlices,
      deptSlices,
      usSlices,
      keepDepartmentsResident: true,
      keepUsStatesResident: false,
    });
    const dormant = data.filter((f) => f.isDormantLayerFeature);
    expect(dormant).toHaveLength(1);
    expect(dormant[0].__id).toBe("d0");
    expect(data.some((f) => f.__id === "c0")).toBe(true);
  });

  it("does not include a regional layer that has not been prewarmed or visited", () => {
    const data = computeResidentRenderCountriesData({
      transitionKey: 0,
      modeTransitionRef,
      effectiveDepartmentMode: false,
      effectiveUsStatesMode: false,
      worldSlices,
      deptSlices,
      usSlices,
      keepDepartmentsResident: false,
      keepUsStatesResident: false,
    });
    expect(data.every((f) => !f.isDormantLayerFeature && !f.isDepartmentFeature)).toBe(true);
  });
});

describe("?perf=1 overlay", () => {
  it("is off by default (no query param) and has not recorded a switch", () => {
    expect(isPerfSwitchEnabled()).toBe(false);
    expect(getLastPerfSwitch()).toBeNull();
  });
});
