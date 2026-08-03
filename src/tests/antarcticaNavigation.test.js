import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { countryDataMap } from "../data/gameData";
import { useGlobeInteractions } from "../globe/hooks/useGlobeInteractions";

describe("Antarctica data & globe navigation", () => {
  it("has valid lat and lng for Antarctica and Heard Island in countryDataMap", () => {
    expect(countryDataMap.Antarctica).toBeDefined();
    expect(countryDataMap.Antarctica.lat).toBe(-82.86);
    expect(countryDataMap.Antarctica.lng).toBe(135.0);

    expect(countryDataMap["Heard Island and McDonald Islands"]).toBeDefined();
    expect(countryDataMap["Heard Island and McDonald Islands"].lat).toBe(-53.08);
    expect(countryDataMap["Heard Island and McDonald Islands"].lng).toBe(73.5);
  });

  it("selects Antarctica when clicking south of 60° latitude", () => {
    const onCountrySelect = vi.fn();
    const gameDataMap = {
      Antarctica: countryDataMap.Antarctica,
      Argentina: countryDataMap.Argentina,
    };

    const { result } = renderHook(() =>
      useGlobeInteractions({
        globeEl: { current: null },
        globeContentWrapperRef: { current: null },
        isHomeScreen: false,
        isKeyboardMode: false,
        viewport: { width: 1024, height: 768 },
        perfProfile: {},
        onCountrySelect,
        onPreserveInputFocus: vi.fn(),
        mode: "countries",
        gameDataMap,
        selectableFeatureIndex: [],
        isDepartmentMode: false,
        isRiversMountainsMode: false,
      })
    );

    result.current.selectCountryAtLngLat(0, -75);
    expect(onCountrySelect).toHaveBeenCalledWith("Antarctica");

    result.current.selectCountryAtLngLat(90, -85);
    expect(onCountrySelect).toHaveBeenCalledWith("Antarctica");
  });
});
