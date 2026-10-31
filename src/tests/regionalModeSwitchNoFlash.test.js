import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useGlobeRenderData } from "../globe/hooks/useGlobeRenderData";

describe("regional mode switch without flash or missing geometry", () => {
  const worldFeatures = [
    { properties: { ADMIN: "France" }, geometry: { type: "Polygon", coordinates: [] } },
    { properties: { ADMIN: "Germany" }, geometry: { type: "Polygon", coordinates: [] } },
    {
      properties: { ADMIN: "United States of America" },
      geometry: { type: "Polygon", coordinates: [] },
    },
  ];

  const deptFeatures = [
    { properties: { code: "75", nom: "Paris" }, geometry: { type: "Polygon", coordinates: [] } },
    { properties: { code: "01", nom: "Ain" }, geometry: { type: "Polygon", coordinates: [] } },
  ];

  it("keeps world polygons intact when switching to regional mode if regional data is not yet ready", () => {
    let isDepartmentMode = false;
    let departmentsData = [];

    const { result, rerender } = renderHook(() =>
      useGlobeRenderData({
        isDepartmentMode,
        isUsStatesMode: false,
        countriesData: worldFeatures,
        departmentsData,
        usStatesData: [],
      })
    );

    // Initial world state
    expect(result.current.effectiveDepartmentMode).toBe(false);
    expect(result.current.modeTransitionRef.current.active).toBe(false);
    expect(result.current.renderCountriesData.some((f) => f.properties.ADMIN === "France")).toBe(
      true
    );

    // User selects departments mode card before departmentsData arrives
    isDepartmentMode = true;
    departmentsData = [];
    rerender();

    // Stays on world mode; France is NOT removed; transition is not triggered on empty data
    expect(result.current.effectiveDepartmentMode).toBe(false);
    expect(result.current.modeTransitionRef.current.active).toBe(false);
    expect(result.current.renderCountriesData.some((f) => f.properties.ADMIN === "France")).toBe(
      true
    );

    // Regional data arrives
    departmentsData = deptFeatures;
    rerender();

    // Now transitions smoothly with departments and crossfade
    expect(result.current.effectiveDepartmentMode).toBe(true);
    expect(result.current.modeTransitionRef.current.active).toBe(true);
    expect(result.current.modeTransitionRef.current.toDept).toBe(true);
  });

  it("keeps department polygons intact when switching to US states if US states data is not yet ready", () => {
    let isDepartmentMode = true;
    let isUsStatesMode = false;
    const departmentsData = deptFeatures;
    let usStatesData = [];

    const { result, rerender } = renderHook(() =>
      useGlobeRenderData({
        isDepartmentMode,
        isUsStatesMode,
        countriesData: worldFeatures,
        departmentsData,
        usStatesData,
      })
    );

    // Initial departments state
    expect(result.current.effectiveDepartmentMode).toBe(true);
    expect(result.current.effectiveUsStatesMode).toBe(false);

    // User switches to US states mode card before usStatesData arrives
    isDepartmentMode = false;
    isUsStatesMode = true;
    rerender();

    // Stays on departments mode; does not drop to world mode or empty map
    expect(result.current.effectiveDepartmentMode).toBe(true);
    expect(result.current.effectiveUsStatesMode).toBe(false);
    expect(result.current.renderCountriesData.some((f) => f.properties.nom === "Paris")).toBe(true);

    // US states data arrives
    const usFeatures = [
      { properties: { name: "California" }, geometry: { type: "Polygon", coordinates: [] } },
      { properties: { name: "Texas" }, geometry: { type: "Polygon", coordinates: [] } },
    ];
    usStatesData = usFeatures;
    rerender();

    // Transitions directly from departments to US states without intermediate world drop
    expect(result.current.effectiveDepartmentMode).toBe(false);
    expect(result.current.effectiveUsStatesMode).toBe(true);
    expect(result.current.modeTransitionRef.current.active).toBe(true);
    expect(result.current.modeTransitionRef.current.fromDept).toBe(true);
    expect(result.current.modeTransitionRef.current.toUs).toBe(true);
    // US states are incoming
    expect(result.current.renderCountriesData.some((f) => f.properties.name === "California")).toBe(
      true
    );
    // French departments remain in exiting
    expect(
      result.current.renderCountriesData.some(
        (f) => f.properties.nom === "Paris" && f.isExitingDepartmentFeature
      )
    ).toBe(true);
    // Regional-to-regional transition: ghost world remains intact
    expect(result.current.renderCountriesData.some((f) => f.isGhostCountry)).toBe(true);
  });
});
