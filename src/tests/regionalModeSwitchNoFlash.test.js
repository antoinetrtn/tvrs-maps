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
});
