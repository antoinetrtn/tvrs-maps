import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RIVER_CONFIG } from "../config/designSystem";
import { RIVER_ALTITUDE } from "../config/gameConfig";
import {
  getSmoothedRiverPath,
  pathColorAccessor,
  pathDashAnimateTimeAccessor,
  pathDashGapAccessor,
  pathDashLengthAccessor,
  pathPointAltAccessor,
  pathPointLatAccessor,
  pathPointLngAccessor,
  pathPointsAccessor,
  pathWidthAccessor,
  useGlobePaths,
} from "../globe/hooks/useGlobePaths";

describe("River Rendering & Animations (Milestone M2)", () => {
  const mockRiverPath = [
    [10.0, 20.0],
    [11.0, 21.0],
    [12.0, 22.0],
  ];

  const mockGameDataMap = {
    amazon: {
      id: "amazon",
      name: "Amazon River",
      type: "river",
      path: mockRiverPath,
    },
    nile: {
      id: "nile",
      name: "Nile River",
      type: "river",
      path: [
        [30.0, 31.0],
        [31.0, 32.0],
      ],
    },
    everest: {
      id: "everest",
      name: "Mount Everest",
      type: "mountain",
    },
  };

  describe("RIVER_CONFIG Single Source of Truth", () => {
    it("exports canonical colors", () => {
      expect(typeof RIVER_CONFIG.colors.active).toBe("string");
      expect(typeof RIVER_CONFIG.colors.inactive).toBe("string");
      expect(typeof RIVER_CONFIG.colors.selectedFound).toBe("string");
      expect(typeof RIVER_CONFIG.colors.selectedUnfound).toBe("string");
      expect(typeof RIVER_CONFIG.colors.core).toBe("string");
      expect(typeof RIVER_CONFIG.colors.error).toBe("string");
      expect(typeof RIVER_CONFIG.colors.errorGlow).toBe("string");
      expect(typeof RIVER_CONFIG.colors.success).toBe("string");
    });

    it("exports canonical widths", () => {
      expect(RIVER_CONFIG.widths).toEqual({
        baseUnfound: 2.2,
        baseFound: 3.8,
        selectedUnfound: 4.5,
        selectedFound: 5.5,
        coreUnfound: 1.4,
        coreFound: 1.8,
      });
    });

    it("exports canonical dash parameters", () => {
      expect(RIVER_CONFIG.dash).toEqual({
        baseLength: 1,
        baseGap: 0,
        baseAnimateTime: 0,
        selectedOuterLength: 1,
        selectedOuterGap: 0,
        selectedOuterAnimateTime: 0,
        coreLength: 0.25,
        coreGap: 0.15,
        coreAnimateTime: 800,
      });
    });

    it("exports canonical smoothing points", () => {
      expect(RIVER_CONFIG.smoothingPoints).toBe(60);
    });
  });

  describe("RIVER_ALTITUDE", () => {
    it("exports standardized river altitudes", () => {
      expect(RIVER_ALTITUDE).toEqual({
        base: 0.006,
        selectedOuter: 0.007,
        selectedCore: 0.008,
      });
    });
  });

  describe("River Path Smoothing & Accessors", () => {
    it("interpolates CatmullRom curve at base altitude", () => {
      const smoothed = getSmoothedRiverPath("test_river_smooth", mockRiverPath);
      expect(smoothed.length).toBe(RIVER_CONFIG.smoothingPoints + 1);
      smoothed.forEach((point) => {
        expect(point[2]).toBeCloseTo(RIVER_ALTITUDE.base, 4);
      });
    });

    it("returns raw coords if path is too short", () => {
      const singlePoint = [[10.0, 20.0]];
      expect(getSmoothedRiverPath("short_river", singlePoint)).toBe(singlePoint);
      expect(getSmoothedRiverPath("null_river", null)).toBeNull();
    });

    it("correctly evaluates all path accessors", () => {
      const sampleItem = {
        coords: [
          [10, 20, 0.006],
          [11, 21, 0.006],
        ],
        color: RIVER_CONFIG.colors.core,
        width: 3.5,
        dashLength: 0.25,
        dashGap: 0.15,
        dashAnimateTime: 800,
      };

      expect(pathPointsAccessor(sampleItem)).toBe(sampleItem.coords);
      expect(pathPointLatAccessor(sampleItem.coords[0])).toBe(10);
      expect(pathPointLngAccessor(sampleItem.coords[0])).toBe(20);
      expect(pathPointAltAccessor(sampleItem.coords[0])).toBe(0.006);
      expect(pathColorAccessor(sampleItem)).toBe(RIVER_CONFIG.colors.core);
      expect(pathWidthAccessor(sampleItem)).toBe(3.5);
      expect(pathDashLengthAccessor(sampleItem)).toBe(0.25);
      expect(pathDashGapAccessor(sampleItem)).toBe(0.15);
      expect(pathDashAnimateTimeAccessor(sampleItem)).toBe(800);
    });
  });

  describe("useGlobePaths Hook", () => {
    it("returns empty paths when isRiversMountainsMode is false", () => {
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: false,
          gameDataMap: mockGameDataMap,
          foundSet: new Set(),
          selectedCountry: null,
          isError: false,
          isSuccess: false,
        })
      );
      expect(result.current.globePathsData).toEqual([]);
    });

    it("generates base paths for rivers (ignoring non-river types)", () => {
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: mockGameDataMap,
          foundSet: new Set(["amazon"]),
          selectedCountry: null,
          isError: false,
          isSuccess: false,
        })
      );

      const paths = result.current.globePathsData;
      expect(paths.length).toBe(2); // amazon and nile

      const amazonPath = paths.find((p) => p.admin === "amazon");
      const nilePath = paths.find((p) => p.admin === "nile");

      // amazon is found
      expect(amazonPath.color).toBe(RIVER_CONFIG.colors.active);
      expect(amazonPath.width).toBe(RIVER_CONFIG.widths.baseFound);
      expect(amazonPath.dashLength).toBe(RIVER_CONFIG.dash.baseLength);
      expect(amazonPath.dashGap).toBe(RIVER_CONFIG.dash.baseGap);
      expect(amazonPath.dashAnimateTime).toBe(RIVER_CONFIG.dash.baseAnimateTime);

      // nile is unfound
      expect(nilePath.color).toBe(RIVER_CONFIG.colors.inactive);
      expect(nilePath.width).toBe(RIVER_CONFIG.widths.baseUnfound);
    });

    it("treats all base rivers as found in learn mode", () => {
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "learn",
          isRiversMountainsMode: true,
          gameDataMap: mockGameDataMap,
          foundSet: new Set(),
          selectedCountry: null,
          isError: false,
          isSuccess: false,
        })
      );

      const paths = result.current.globePathsData;
      paths.forEach((p) => {
        expect(p.color).toBe(RIVER_CONFIG.colors.active);
        expect(p.width).toBe(RIVER_CONFIG.widths.baseFound);
      });
    });

    it("generates outer and core layers when a river is selected (unfound in play mode)", () => {
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: mockGameDataMap,
          foundSet: new Set(),
          selectedCountry: "amazon",
          isError: false,
          isSuccess: false,
        })
      );

      const paths = result.current.globePathsData;
      expect(paths.length).toBe(4); // 2 base + 1 selected outer + 1 selected core

      const selectedOuter = paths.find(
        (p) => p.admin === "amazon" && p.width === RIVER_CONFIG.widths.selectedUnfound
      );
      const selectedCore = paths.find((p) => p.admin === "amazon_core");

      expect(selectedOuter).toBeDefined();
      expect(selectedOuter.color).toBe(RIVER_CONFIG.colors.selectedUnfound);
      expect(selectedOuter.coords[0][2]).toBe(RIVER_ALTITUDE.selectedOuter);
      expect(selectedOuter.dashAnimateTime).toBe(RIVER_CONFIG.dash.selectedOuterAnimateTime);

      expect(selectedCore).toBeDefined();
      expect(selectedCore.color).toBe(RIVER_CONFIG.colors.core);
      expect(selectedCore.width).toBe(RIVER_CONFIG.widths.coreUnfound);
      expect(selectedCore.coords[0][2]).toBe(RIVER_ALTITUDE.selectedCore);
      expect(selectedCore.dashLength).toBe(RIVER_CONFIG.dash.coreLength);
      expect(selectedCore.dashGap).toBe(RIVER_CONFIG.dash.coreGap);
      expect(selectedCore.dashAnimateTime).toBe(RIVER_CONFIG.dash.coreAnimateTime);
    });

    it("generates found styling for selected river when found or in learn mode", () => {
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "learn",
          isRiversMountainsMode: true,
          gameDataMap: mockGameDataMap,
          foundSet: new Set(),
          selectedCountry: "amazon",
          isError: false,
          isSuccess: false,
        })
      );

      const paths = result.current.globePathsData;
      const selectedOuter = paths.find(
        (p) => p.admin === "amazon" && p.width === RIVER_CONFIG.widths.selectedFound
      );
      const selectedCore = paths.find((p) => p.admin === "amazon_core");

      expect(selectedOuter.color).toBe(RIVER_CONFIG.colors.selectedFound);
      expect(selectedOuter.width).toBe(RIVER_CONFIG.widths.selectedFound);
      expect(selectedCore.width).toBe(RIVER_CONFIG.widths.coreFound);
    });

    it("applies success feedback color when isSuccess is true", () => {
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: mockGameDataMap,
          foundSet: new Set(),
          selectedCountry: "amazon",
          isError: false,
          isSuccess: true,
        })
      );

      const paths = result.current.globePathsData;
      const selectedOuter = paths.find(
        (p) => p.admin === "amazon" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      expect(selectedOuter.color).toBe(RIVER_CONFIG.colors.success);
    });

    it("applies error feedback color when isError is true", () => {
      // Unfound error
      const { result: unfoundResult } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: mockGameDataMap,
          foundSet: new Set(),
          selectedCountry: "amazon",
          isError: true,
          isSuccess: false,
        })
      );

      const unfoundOuter = unfoundResult.current.globePathsData.find(
        (p) => p.admin === "amazon" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      expect(unfoundOuter.color).toBe(RIVER_CONFIG.colors.errorGlow);

      // Found error
      const { result: foundResult } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: mockGameDataMap,
          foundSet: new Set(["amazon"]),
          selectedCountry: "amazon",
          isError: true,
          isSuccess: false,
        })
      );

      const foundOuter = foundResult.current.globePathsData.find(
        (p) => p.admin === "amazon" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      expect(foundOuter.color).toBe(RIVER_CONFIG.colors.error);
    });
  });

  describe("Raycast delegation helper logic", () => {
    it("correctly strips _core suffix for click selection", () => {
      const rawAdmin1 = "amazon_core".replace(/_core$/, "");
      expect(rawAdmin1).toBe("amazon");

      const rawAdmin2 = "amazon".replace(/_core$/, "");
      expect(rawAdmin2).toBe("amazon");
    });
  });
});
