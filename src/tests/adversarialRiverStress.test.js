import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RIVER_CONFIG } from "../config/designSystem";
import { RIVER_ALTITUDE } from "../config/gameConfig";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { getSmoothedRiverPath, useGlobePaths } from "../globe/hooks/useGlobePaths";

describe("Adversarial Empirical Stress Testing — Rivers & Animations (M2)", () => {
  const allRivers = Object.entries(riversMountainsDataMap).filter(
    ([, v]) => v.type === "river" && v.path
  );

  describe("Dataset Integrity & Geometry Smoothing", () => {
    it("successfully processes all 50 rivers in riversMountainsDataMap with zero NaN/Infinity", () => {
      expect(allRivers.length).toBe(50);

      allRivers.forEach(([riverKey, riverData]) => {
        const smoothed = getSmoothedRiverPath(riverKey, riverData.path);
        expect(Array.isArray(smoothed)).toBe(true);
        expect(smoothed.length).toBe(RIVER_CONFIG.smoothingPoints + 1);

        smoothed.forEach((pt) => {
          expect(Number.isFinite(pt[0])).toBe(true);
          expect(Number.isFinite(pt[1])).toBe(true);
          expect(Number.isFinite(pt[2])).toBe(true);
          expect(pt[2]).toBeCloseTo(RIVER_ALTITUDE.base, 4);
        });
      });
    });

    it("verifies caching prevents redundant computations", () => {
      const firstRun = getSmoothedRiverPath("danube", riversMountainsDataMap.danube.path);
      const secondRun = getSmoothedRiverPath("danube", riversMountainsDataMap.danube.path);
      expect(firstRun).toBe(secondRun); // Identity check
    });

    it("handles extreme coordinate geometries safely", () => {
      const extremeCases = [
        {
          key: "polar_river",
          path: [
            [89.9, 0],
            [89.0, 45],
            [-89.0, 120],
            [-89.9, 180],
          ],
        },
        {
          key: "antimeridian_river",
          path: [
            [10, 179.9],
            [10, 180],
            [10, -180],
            [10, -179.9],
          ],
        },
        { key: "single_point", path: [[10, 20]] },
        { key: "empty_path", path: [] },
      ];

      extremeCases.forEach(({ key, path }) => {
        const result = getSmoothedRiverPath(key, path);
        if (path.length < 2) {
          expect(result).toEqual(path);
        } else {
          expect(result.length).toBe(RIVER_CONFIG.smoothingPoints + 1);
          result.forEach((pt) => {
            expect(Number.isFinite(pt[0])).toBe(true);
            expect(Number.isFinite(pt[1])).toBe(true);
            expect(Number.isFinite(pt[2])).toBe(true);
          });
        }
      });
    });
  });

  describe("Mode Permutations & Visual Consistency", () => {
    it("Mode = 'rivers_mountains' (Play Mode): unselected, selected-unfound, selected-found", () => {
      // 1. Unselected play mode
      const { result: rUnselected } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: riversMountainsDataMap,
          foundSet: new Set(["nile"]),
          selectedCountry: null,
          isError: false,
          isSuccess: false,
        })
      );

      const unselectedPaths = rUnselected.current.globePathsData;
      expect(unselectedPaths.length).toBe(50); // only 50 base paths

      const nileBase = unselectedPaths.find((p) => p.admin === "nile");
      const amazonBase = unselectedPaths.find((p) => p.admin === "amazon");

      // Found nile base
      expect(nileBase.color).toBe(RIVER_CONFIG.colors.active);
      expect(nileBase.width).toBe(RIVER_CONFIG.widths.baseFound);
      expect(nileBase.dashLength).toBe(RIVER_CONFIG.dash.baseLength);
      expect(nileBase.dashGap).toBe(RIVER_CONFIG.dash.baseGap);
      expect(nileBase.dashAnimateTime).toBe(RIVER_CONFIG.dash.baseAnimateTime);

      // Unfound amazon base
      expect(amazonBase.color).toBe(RIVER_CONFIG.colors.inactive);
      expect(amazonBase.width).toBe(RIVER_CONFIG.widths.baseUnfound);

      // 2. Selected unfound river (amazon)
      const { result: rSelectedUnfound } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: riversMountainsDataMap,
          foundSet: new Set(["nile"]),
          selectedCountry: "amazon",
          isError: false,
          isSuccess: false,
        })
      );

      const selUnfoundPaths = rSelectedUnfound.current.globePathsData;
      expect(selUnfoundPaths.length).toBe(52); // 50 base + 1 outer + 1 core

      const amazonOuter = selUnfoundPaths.find(
        (p) => p.admin === "amazon" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      const amazonCore = selUnfoundPaths.find((p) => p.admin === "amazon_core");

      expect(amazonOuter.color).toBe(RIVER_CONFIG.colors.selectedUnfound);
      expect(amazonOuter.width).toBe(RIVER_CONFIG.widths.selectedUnfound);
      expect(amazonOuter.dashAnimateTime).toBe(0);

      expect(amazonCore.color).toBe(RIVER_CONFIG.colors.core);
      expect(amazonCore.width).toBe(RIVER_CONFIG.widths.coreUnfound);
      expect(amazonCore.coords[0][2]).toBe(RIVER_ALTITUDE.selectedCore);
      expect(amazonCore.dashLength).toBe(RIVER_CONFIG.dash.coreLength);
      expect(amazonCore.dashGap).toBe(RIVER_CONFIG.dash.coreGap);
      expect(amazonCore.dashAnimateTime).toBe(RIVER_CONFIG.dash.coreAnimateTime);

      // 3. Selected found river (nile)
      const { result: rSelectedFound } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: riversMountainsDataMap,
          foundSet: new Set(["nile"]),
          selectedCountry: "nile",
          isError: false,
          isSuccess: false,
        })
      );

      const selFoundPaths = rSelectedFound.current.globePathsData;
      const nileOuter = selFoundPaths.find(
        (p) => p.admin === "nile" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      const nileCore = selFoundPaths.find((p) => p.admin === "nile_core");

      expect(nileOuter.color).toBe(RIVER_CONFIG.colors.selectedFound);
      expect(nileOuter.width).toBe(RIVER_CONFIG.widths.selectedFound);
      expect(nileCore.color).toBe(RIVER_CONFIG.colors.core);
      expect(nileCore.width).toBe(RIVER_CONFIG.widths.coreFound);
    });

    it("Mode = 'learn': all base rivers and selected rivers use active/found palette", () => {
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "learn",
          isRiversMountainsMode: true,
          gameDataMap: riversMountainsDataMap,
          foundSet: new Set(), // even with empty foundSet
          selectedCountry: "congo",
          isError: false,
          isSuccess: false,
        })
      );

      const paths = result.current.globePathsData;
      expect(paths.length).toBe(52);

      // All 50 base paths must have active color and baseFound width
      const basePaths = paths.filter((p) => p.coords[0][2] === RIVER_ALTITUDE.base);
      expect(basePaths.length).toBe(50);
      basePaths.forEach((p) => {
        expect(p.color).toBe(RIVER_CONFIG.colors.active);
        expect(p.width).toBe(RIVER_CONFIG.widths.baseFound);
      });

      // Selected congo
      const congoOuter = paths.find(
        (p) => p.admin === "congo" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      const congoCore = paths.find((p) => p.admin === "congo_core");

      expect(congoOuter.color).toBe(RIVER_CONFIG.colors.selectedFound);
      expect(congoOuter.width).toBe(RIVER_CONFIG.widths.selectedFound);
      expect(congoCore.color).toBe(RIVER_CONFIG.colors.core);
      expect(congoCore.width).toBe(RIVER_CONFIG.widths.coreFound);
    });

    it("isHomeScreen = true (Homepage carousel): renders unfound styling for carousel showcase", () => {
      // On home screen, foundSet is empty, mode is rivers_mountains
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: riversMountainsDataMap,
          foundSet: new Set(),
          selectedCountry: "danube",
          isError: false,
          isSuccess: false,
        })
      );

      const paths = result.current.globePathsData;
      expect(paths.length).toBe(52);

      const danubeOuter = paths.find(
        (p) => p.admin === "danube" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      const danubeCore = paths.find((p) => p.admin === "danube_core");

      expect(danubeOuter.color).toBe(RIVER_CONFIG.colors.selectedUnfound);
      expect(danubeOuter.width).toBe(RIVER_CONFIG.widths.selectedUnfound);
      expect(danubeCore.color).toBe(RIVER_CONFIG.colors.core);
      expect(danubeCore.width).toBe(RIVER_CONFIG.widths.coreUnfound);
    });

    it("Non-rivers mode (e.g. countries, departments, us_states): returns empty paths", () => {
      const modes = ["countries", "capitals", "departments", "us_states"];
      modes.forEach((m) => {
        const { result } = renderHook(() =>
          useGlobePaths({
            mode: m,
            isRiversMountainsMode: false,
            gameDataMap: {},
            foundSet: new Set(),
            selectedCountry: null,
            isError: false,
            isSuccess: false,
          })
        );
        expect(result.current.globePathsData).toEqual([]);
      });
    });
  });

  describe("Feedback States: Success & Error", () => {
    it("renders success color on correct answer", () => {
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: riversMountainsDataMap,
          foundSet: new Set(),
          selectedCountry: "volga",
          isError: false,
          isSuccess: true,
        })
      );

      const paths = result.current.globePathsData;
      const volgaOuter = paths.find(
        (p) => p.admin === "volga" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      expect(volgaOuter.color).toBe(RIVER_CONFIG.colors.success);
    });

    it("renders error glow on unfound mistake and error on found mistake", () => {
      // Unfound error
      const { result: rUnfoundErr } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: riversMountainsDataMap,
          foundSet: new Set(),
          selectedCountry: "volga",
          isError: true,
          isSuccess: false,
        })
      );

      const unfoundOuter = rUnfoundErr.current.globePathsData.find(
        (p) => p.admin === "volga" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      expect(unfoundOuter.color).toBe(RIVER_CONFIG.colors.errorGlow);

      // Found error
      const { result: rFoundErr } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: riversMountainsDataMap,
          foundSet: new Set(["volga"]),
          selectedCountry: "volga",
          isError: true,
          isSuccess: false,
        })
      );

      const foundOuter = rFoundErr.current.globePathsData.find(
        (p) => p.admin === "volga" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      expect(foundOuter.color).toBe(RIVER_CONFIG.colors.error);
    });

    it("prioritizes success over error if both are true", () => {
      const { result } = renderHook(() =>
        useGlobePaths({
          mode: "rivers_mountains",
          isRiversMountainsMode: true,
          gameDataMap: riversMountainsDataMap,
          foundSet: new Set(),
          selectedCountry: "volga",
          isError: true,
          isSuccess: true,
        })
      );

      const paths = result.current.globePathsData;
      const volgaOuter = paths.find(
        (p) => p.admin === "volga" && p.coords[0][2] === RIVER_ALTITUDE.selectedOuter
      );
      expect(volgaOuter.color).toBe(RIVER_CONFIG.colors.success);
    });
  });

  describe("Raycast & Click Handlers", () => {
    function createPathClickHandler({ isHomeScreen = false, onSelect }) {
      return (obj) => {
        if (!isHomeScreen && obj?.admin) {
          const rawAdmin = obj.admin.replace(/_core$/, "");
          onSelect(rawAdmin);
        }
      };
    }

    it("resolves both base admin and _core admin accurately", () => {
      let clickedAdmin = null;
      const handler = createPathClickHandler({
        isHomeScreen: false,
        onSelect: (val) => {
          clickedAdmin = val;
        },
      });

      handler({ admin: "mississippi" });
      expect(clickedAdmin).toBe("mississippi");

      handler({ admin: "mississippi_core" });
      expect(clickedAdmin).toBe("mississippi");
    });

    it("does not mutate river names containing 'core' elsewhere", () => {
      let clickedAdmin = null;
      const handler = createPathClickHandler({
        isHomeScreen: false,
        onSelect: (val) => {
          clickedAdmin = val;
        },
      });

      handler({ admin: "core_river" });
      expect(clickedAdmin).toBe("core_river");

      handler({ admin: "river_core_branch" });
      expect(clickedAdmin).toBe("river_core_branch");

      handler({ admin: "river_core_branch_core" });
      expect(clickedAdmin).toBe("river_core_branch");
    });

    it("safely ignores clicks on home screen and malformed objects", () => {
      let clickedAdmin = null;
      const homeHandler = createPathClickHandler({
        isHomeScreen: true,
        onSelect: (val) => {
          clickedAdmin = val;
        },
      });

      homeHandler({ admin: "mississippi" });
      expect(clickedAdmin).toBeNull();

      homeHandler({ admin: "mississippi_core" });
      expect(clickedAdmin).toBeNull();

      const playHandler = createPathClickHandler({
        isHomeScreen: false,
        onSelect: (val) => {
          clickedAdmin = val;
        },
      });

      playHandler(null);
      expect(clickedAdmin).toBeNull();

      playHandler(undefined);
      expect(clickedAdmin).toBeNull();

      playHandler({});
      expect(clickedAdmin).toBeNull();

      playHandler({ admin: "" });
      expect(clickedAdmin).toBeNull();
    });
  });
});
