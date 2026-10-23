import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONQUEST_PLAYER_COLORS, getThemeColors } from "../../config/designSystem";
import {
  getDeselectGlitchFadeProgress,
  getFeatureCapResolution,
  getPolygonAltitudeFor,
  getPolygonCapResolution,
  POLYGON_ALTITUDE,
  POLYGON_CAP_RESOLUTION,
} from "../../config/gameConfig";
import { countryDataMap } from "../../data/gameData";
import { setGlobePref } from "../../globe/globePrefs";
import { useGlobePolygons } from "../../globe/hooks/useGlobePolygons";
import {
  FOUND_SURFACE_GREEN,
  getCachedMaterial,
  getFeatureMonochromeShade,
  isQuietOwnedFocusFor,
  isSameAdmin,
  mutedFoundGreen,
  resolveOwnerBaseColor,
  resolvePolygonStrokeWidth,
  resolveRestingColorForFeature,
} from "../../globe/render/polygonColorResolver";
import { getAnimatedPolygonMaterialCount } from "../../globe/render/polygonGlitchShader";
import {
  CONQUEST_OVERLAY_FIXTURE,
  createHookProps,
  FEATURE_DEPT_AIN,
  FEATURE_FRANCE,
  FEATURE_SPAIN,
  resetGlobePolygonTestGlobals,
  summarizeMaterial,
} from "./testHelpers";

const ACCESSOR_KEYS = [
  "getPolygonCapMaterial",
  "getPolygonSideMaterial",
  "getPolygonAltitude",
  "getPolygonStrokeWidth",
  "getPolygonCurvatureResolution",
  "getPolygonCapColorWrapped",
  "getPolygonSideColorWrapped",
  "getPolygonStrokeColorWrapped",
  "getBaseColorForCountryAndKind",
  "lerpColor",
  "getPolygonColor",
  "getPolygonSideColor",
  "getPolygonStroke",
  "isQuietOwnedFocus",
];

function diffAccessors(prev, next) {
  return ACCESSOR_KEYS.filter((key) => prev[key] !== next[key]);
}

// Common rebuilt accessor groups for G-2 characterization assertions
const REBUILT_ON_FEEDBACK_OR_SCORE = [
  "getPolygonCapMaterial",
  "getPolygonSideMaterial",
  "getPolygonCapColorWrapped",
  "getPolygonSideColorWrapped",
  "getPolygonStrokeColorWrapped",
  "getBaseColorForCountryAndKind",
  "getPolygonColor",
  "getPolygonSideColor",
  "getPolygonStroke",
];

const REBUILT_ON_FOUND_MODE_THEME = [
  "getPolygonCapMaterial",
  "getPolygonSideMaterial",
  "getPolygonStrokeWidth",
  "getPolygonCapColorWrapped",
  "getPolygonSideColorWrapped",
  "getPolygonStrokeColorWrapped",
  "getBaseColorForCountryAndKind",
  "getPolygonColor",
  "getPolygonSideColor",
  "getPolygonStroke",
];

const REBUILT_ON_SELECTION_OR_GLOBE_THEME = [
  "getPolygonCapMaterial",
  "getPolygonSideMaterial",
  "getPolygonAltitude",
  "getPolygonStrokeWidth",
  "getPolygonCapColorWrapped",
  "getPolygonSideColorWrapped",
  "getPolygonStrokeColorWrapped",
  "getBaseColorForCountryAndKind",
  "getPolygonColor",
  "getPolygonSideColor",
  "getPolygonStroke",
];

describe("useGlobePolygons characterization — Accessor Identity (G-2), Cache Lifecycle, and Resolvers", () => {
  beforeEach(() => {
    resetGlobePolygonTestGlobals();
  });

  afterEach(() => {
    resetGlobePolygonTestGlobals();
  });

  describe("G-2 Accessor identity stability across prop updates", () => {
    it("records exactly which returned accessor functions change identity for each input change", () => {
      const runDiff = (overrideFn) => {
        const initialProps = createHookProps();
        const { result, rerender, unmount } = renderHook((p) => useGlobePolygons(p), {
          initialProps,
        });
        const before = { ...result.current };
        rerender(overrideFn(initialProps));
        const changed = diffAccessors(before, result.current);
        unmount();
        return changed;
      };

      const identityMatrix = {
        noChange: runDiff((p) => ({ ...p })),
        unusedFoundList: runDiff((p) => ({ ...p, _foundList: ["France"] })),
        selectionTransitionWrapperOnly: runDiff((p) => ({
          ...p,
          selectionTransition: {
            state: {
              transitioningPreviousCountryState: null,
              transitioningIncomingCountryState: null,
            },
          },
        })),
        selectedCountry: runDiff((p) => ({ ...p, selectedCountry: "France" })),
        foundSet: runDiff((p) => ({ ...p, foundSet: new Set(["Spain"]) })),
        isError: runDiff((p) => ({ ...p, isError: true })),
        isSuccess: runDiff((p) => ({ ...p, isSuccess: true })),
        conquestOverlay: runDiff((p) => ({ ...p, conquestOverlay: CONQUEST_OVERLAY_FIXTURE })),
        mode: runDiff((p) => ({ ...p, mode: "learn" })),
        globeTheme: runDiff((p) => ({ ...p, globeTheme: "satellite" })),
        theme: runDiff((p) => ({ ...p, theme: "light" })),
        isLight: runDiff((p) => ({ ...p, isLight: true })),
        globeLightingEnabled: runDiff((p) => ({ ...p, globeLightingEnabled: false })),
        perfProfileSameResolution: runDiff((p) => ({
          ...p,
          perfProfile: { isMobile: true, polygonCapCurvatureResolution: 1.5 },
        })),
        perfProfileNewResolution: runDiff((p) => ({
          ...p,
          perfProfile: { isMobile: false, polygonCapCurvatureResolution: 2.0 },
        })),
        isHomeScreen: runDiff((p) => ({ ...p, isHomeScreen: true })),
        isEndScreen: runDiff((p) => ({ ...p, isEndScreen: true })),
        isPerfectScore: runDiff((p) => ({ ...p, isPerfectScore: true })),
        isDepartmentMode: runDiff((p) => ({ ...p, isDepartmentMode: true })),
        gameDataMap: runDiff((p) => ({ ...p, gameDataMap: { ...countryDataMap } })),
        transitioningPrevCountry: runDiff((p) => ({
          ...p,
          selectionTransition: {
            state: {
              transitioningPreviousCountryState: "France",
              transitioningIncomingCountryState: null,
            },
          },
        })),
        transitionStepWhenIdle: runDiff((p) => ({ ...p, transitionStep: 1 })),
      };

      expect(identityMatrix).toEqual({
        noChange: [],
        unusedFoundList: [],
        selectionTransitionWrapperOnly: [],
        // G-2: changing selectedCountry or globeTheme rebuilds 11 of 14 accessors
        selectedCountry: REBUILT_ON_SELECTION_OR_GLOBE_THEME,
        globeTheme: REBUILT_ON_SELECTION_OR_GLOBE_THEME,
        // Changing foundSet, mode, theme, or isLight rebuilds 10 of 14 accessors (all except altitude, curvature, lerpColor, isQuietOwnedFocus)
        foundSet: REBUILT_ON_FOUND_MODE_THEME,
        mode: REBUILT_ON_FOUND_MODE_THEME,
        theme: REBUILT_ON_FOUND_MODE_THEME,
        isLight: REBUILT_ON_FOUND_MODE_THEME,
        // CHARACTERIZATION: current behavior — isSuccess and isPerfectScore rebuild 9 accessors
        // (including getPolygonColor) even when isSuccess/isPerfectScore do not change the cap color!
        isError: REBUILT_ON_FEEDBACK_OR_SCORE,
        isSuccess: REBUILT_ON_FEEDBACK_OR_SCORE,
        isPerfectScore: REBUILT_ON_FEEDBACK_OR_SCORE,
        conquestOverlay: [...REBUILT_ON_FEEDBACK_OR_SCORE, "isQuietOwnedFocus"],
        globeLightingEnabled: [
          "getPolygonCapMaterial",
          "getPolygonSideMaterial",
          "getPolygonStrokeWidth",
        ],
        perfProfileSameResolution: [
          "getPolygonCapMaterial",
          "getPolygonSideMaterial",
          "getPolygonStrokeWidth",
        ],
        perfProfileNewResolution: [
          "getPolygonCapMaterial",
          "getPolygonSideMaterial",
          "getPolygonStrokeWidth",
          "getPolygonCurvatureResolution",
        ],
        // isHomeScreen rebuilds stroke + material, NOT getPolygonColor
        isHomeScreen: [
          "getPolygonCapMaterial",
          "getPolygonSideMaterial",
          "getPolygonStrokeColorWrapped",
          "getPolygonStroke",
        ],
        // isEndScreen rebuilds color + material, NOT getPolygonStroke
        isEndScreen: [
          "getPolygonCapMaterial",
          "getPolygonSideMaterial",
          "getPolygonCapColorWrapped",
          "getPolygonSideColorWrapped",
          "getBaseColorForCountryAndKind",
          "getPolygonColor",
          "getPolygonSideColor",
        ],
        // isDepartmentMode does NOT rebuild getBaseColorForCountryAndKind
        isDepartmentMode: [
          "getPolygonCapMaterial",
          "getPolygonSideMaterial",
          "getPolygonAltitude",
          "getPolygonStrokeWidth",
          "getPolygonCapColorWrapped",
          "getPolygonSideColorWrapped",
          "getPolygonStrokeColorWrapped",
          "getPolygonColor",
          "getPolygonSideColor",
          "getPolygonStroke",
        ],
        // gameDataMap does NOT rebuild getPolygonStrokeWidth
        gameDataMap: [
          "getPolygonCapMaterial",
          "getPolygonSideMaterial",
          "getPolygonAltitude",
          "getPolygonCapColorWrapped",
          "getPolygonSideColorWrapped",
          "getPolygonStrokeColorWrapped",
          "getBaseColorForCountryAndKind",
          "getPolygonColor",
          "getPolygonSideColor",
          "getPolygonStroke",
          "isQuietOwnedFocus",
        ],
        transitioningPrevCountry: [
          "getPolygonCapMaterial",
          "getPolygonSideMaterial",
          "getPolygonAltitude",
        ],
        // CHARACTERIZATION: current behavior — transitionStep rebuilds 9 accessors even when
        // modeTransitionRef.current is inactive/null
        transitionStepWhenIdle: [
          "getPolygonCapMaterial",
          "getPolygonSideMaterial",
          "getPolygonStrokeWidth",
          "getPolygonCapColorWrapped",
          "getPolygonSideColorWrapped",
          "getPolygonStrokeColorWrapped",
          "getPolygonColor",
          "getPolygonSideColor",
          "getPolygonStroke",
        ],
      });
    });

    it("rebuilds only getPolygonCapMaterial and getPolygonSideMaterial when foundStyle external store changes", () => {
      const stableProps = createHookProps();
      const { result, unmount } = renderHook(() => useGlobePolygons(stableProps));
      const before = { ...result.current };

      act(() => {
        setGlobePref("foundStyle", "mesh");
      });

      expect(diffAccessors(before, result.current)).toEqual([
        "getPolygonCapMaterial",
        "getPolygonSideMaterial",
      ]);
      expect(result.current.lerpColor).toBe(before.lerpColor);
      unmount();
    });
  });

  describe("Material cache and shared pool lifecycle", () => {
    it("clears polygonMaterialCacheRef on mode switch while keeping sharedMaterialsRef until theme/lighting changes", () => {
      const { result, rerender, unmount } = renderHook((p) => useGlobePolygons(p), {
        initialProps: createHookProps({
          globeTheme: "monochrome",
          selectedCountry: "France",
          foundSet: new Set(["Spain"]),
        }),
      });

      const franceCapMat1 = result.current.getPolygonCapMaterial(FEATURE_FRANCE);
      const spainCapMat1 = result.current.getPolygonCapMaterial(FEATURE_SPAIN);
      summarizeMaterial(franceCapMat1); // triggers onBeforeCompile and registers animated material

      expect(result.current.polygonMaterialCacheRef.current.cap.size).toBe(2);
      expect(result.current.sharedMaterialsRef.current.size).toBe(2);
      expect(getAnimatedPolygonMaterialCount()).toBe(1);

      // Switching mode ("countries" -> "capitals") clears polygonMaterialCacheRef, NOT sharedMaterialsRef
      rerender(
        createHookProps({
          mode: "capitals",
          globeTheme: "monochrome",
          selectedCountry: "France",
          foundSet: new Set(["Spain"]),
        })
      );
      expect(result.current.polygonMaterialCacheRef.current.cap.size).toBe(0);
      expect(result.current.sharedMaterialsRef.current.size).toBe(2);

      // Re-fetching returns the exact same compiled Three.Material instances from sharedMaterialsRef
      expect(result.current.getPolygonCapMaterial(FEATURE_FRANCE)).toBe(franceCapMat1);
      expect(result.current.getPolygonCapMaterial(FEATURE_SPAIN)).toBe(spainCapMat1);

      // CHARACTERIZATION: current behavior — transitioning to isEndScreen=true does NOT clear
      // sharedMaterialsRef, and found-cap cacheKey (`found-cap-desktop-monochrome`) does not
      // include isEndScreen or color, so Spain reuses its play-mode FOUND_SURFACE_GREEN material!
      rerender(
        createHookProps({
          mode: "capitals",
          globeTheme: "monochrome",
          isEndScreen: true,
          isPerfectScore: true,
          foundSet: new Set(["Spain"]),
        })
      );
      expect(result.current.getPolygonColor(FEATURE_SPAIN)).toBe(result.current.UI_COLORS.gold);
      const spainEndMat = result.current.getPolygonCapMaterial(FEATURE_SPAIN);
      expect(spainEndMat).toBe(spainCapMat1);
      expect(`#${spainEndMat.emissive.getHexString()}`).toBe(FOUND_SURFACE_GREEN);

      // Switching globeTheme disposes sharedMaterialsRef and clears animated materials
      const disposeSpy = vi.spyOn(franceCapMat1, "dispose");
      rerender(
        createHookProps({
          mode: "capitals",
          globeTheme: "satellite",
          isEndScreen: true,
          foundSet: new Set(["Spain"]),
        })
      );
      expect(disposeSpy).toHaveBeenCalledTimes(1);
      expect(result.current.sharedMaterialsRef.current.size).toBe(0);
      expect(getAnimatedPolygonMaterialCount()).toBe(0);

      unmount();
    });

    it("characterizes syncPolygonShaderUniforms behavior before vs after onBeforeCompile", () => {
      // CHARACTERIZATION: current behavior — in WebGL mode, material.userData.shader is only
      // populated when Three.js invokes material.onBeforeCompile. If a rerender updates isError
      // BEFORE onBeforeCompile has run, syncPolygonShaderUniforms(undefined) is a no-op and
      // a later onBeforeCompile uses the initial closure's isError=false!
      const { result, rerender } = renderHook((p) => useGlobePolygons(p), {
        initialProps: createHookProps({ selectedCountry: "France", isError: false }),
      });

      const matBeforeCompile = result.current.getPolygonCapMaterial(FEATURE_FRANCE);
      expect(matBeforeCompile.userData.shader).toBeUndefined();

      rerender(createHookProps({ selectedCountry: "France", isError: true }));
      const matAfterRerenderWithoutCompile = result.current.getPolygonCapMaterial(FEATURE_FRANCE);
      expect(matAfterRerenderWithoutCompile).toBe(matBeforeCompile);

      const summaryStale = summarizeMaterial(matAfterRerenderWithoutCompile);
      expect(summaryStale.uniforms.uIsError).toBe(0);

      // Once material.userData.shader exists, subsequent getPolygonCapMaterial calls sync uniforms
      const summarySynced = summarizeMaterial(result.current.getPolygonCapMaterial(FEATURE_FRANCE));
      expect(summarySynced.uniforms.uIsError).toBe(1);
    });
  });

  describe("Direct pure resolvers and altitude/resolution helpers", () => {
    it("characterizes polygon altitude and cap curvature resolution helpers", () => {
      expect(
        getPolygonAltitudeFor({
          isDepartmentMode: false,
          isGhostCountry: false,
          isSelected: false,
          globeTheme: "monochrome",
        })
      ).toBe(POLYGON_ALTITUDE.base);
      expect(
        getPolygonAltitudeFor({
          isDepartmentMode: false,
          isGhostCountry: false,
          isSelected: false,
          globeTheme: "satellite",
        })
      ).toBe(POLYGON_ALTITUDE.satelliteBase);
      expect(
        getPolygonAltitudeFor({
          isDepartmentMode: true,
          isGhostCountry: true,
          isSelected: true,
          globeTheme: "monochrome",
        })
      ).toBe(POLYGON_ALTITUDE.ghostCountry); // ghost check precedes isSelected!

      expect(getPolygonCapResolution({ baseResolution: 3, isGhost: true, isRegional: false })).toBe(
        POLYGON_CAP_RESOLUTION.ghost
      );
      expect(getPolygonCapResolution({ baseResolution: 3, isGhost: false, isRegional: true })).toBe(
        POLYGON_CAP_RESOLUTION.regional
      );
      expect(
        getPolygonCapResolution({ baseResolution: 3, isGhost: false, isRegional: false })
      ).toBe(POLYGON_CAP_RESOLUTION.world);
      expect(getFeatureCapResolution(FEATURE_DEPT_AIN, 3)).toBe(POLYGON_CAP_RESOLUTION.regional);
      expect(getFeatureCapResolution(FEATURE_FRANCE, 1.2)).toBe(1.2);

      expect(getDeselectGlitchFadeProgress(0, 360)).toBe(0);
      expect(getDeselectGlitchFadeProgress(180, 360)).toBeCloseTo(0.5, 5);
      expect(getDeselectGlitchFadeProgress(360, 360)).toBe(1);
      expect(getDeselectGlitchFadeProgress(-50, 360)).toBe(0);
      expect(getDeselectGlitchFadeProgress(500, 360)).toBe(1);
    });

    it("characterizes polygonColorResolver edge cases", () => {
      expect(isSameAdmin("France", "France")).toBe(true);
      expect(isSameAdmin("Espagne", "Spain")).toBe(true);
      expect(isSameAdmin("Spain", "Espagne")).toBe(true);
      expect(isSameAdmin(null, "France")).toBe(false);
      expect(isSameAdmin("France", "")).toBe(false);

      const map = new Map([["Spain", { id: "spain-mat" }]]);
      expect(getCachedMaterial(map, "Spain")).toEqual({ id: "spain-mat" });
      expect(getCachedMaterial(map, "Espagne")).toEqual({ id: "spain-mat" });
      expect(getCachedMaterial(map, "France")).toBeNull();
      expect(getCachedMaterial(map, null)).toBeNull();

      const uiColors = getThemeColors("monochrome", "dark");
      expect(mutedFoundGreen(uiColors.mapBase, () => uiColors.black)).toBe(FOUND_SURFACE_GREEN);
      expect(getFeatureMonochromeShade(null, uiColors.mapBase, (a) => a, uiColors)).toBe(
        uiColors.mapBase
      );
      expect(getFeatureMonochromeShade("", uiColors.mapBase, (a) => a, uiColors)).toBe(
        uiColors.mapBase
      );

      const baseStroke = resolvePolygonStrokeWidth({
        admin: "France",
        isGhostCountry: false,
        selectedCountry: null,
        isRegionalMode: false,
        foundSet: new Set(),
        mode: "countries",
        isLight: false,
        globeLightingEnabled: true,
        perfProfile: { isMobile: true },
        UI_COLORS: { isBlackoutTheme: false, strokeWidthDesktop: 0.75 },
      });
      expect(baseStroke).toBeCloseTo((0.75 + 0.2) * 0.94, 5);

      expect(
        isQuietOwnedFocusFor(
          { quietFocusId: "Espagne", colors: { Spain: CONQUEST_PLAYER_COLORS.teal } },
          "Spain",
          countryDataMap
        )
      ).toBe(true);
      const lerpMock = (a, b, t) => `${a}->${b}@${t}`;
      expect(
        resolveOwnerBaseColor(CONQUEST_PLAYER_COLORS.teal, "side", {
          lerpColor: lerpMock,
          UI_COLORS: { black: uiColors.black },
          isLight: false,
        })
      ).toBe(`${CONQUEST_PLAYER_COLORS.teal}->${uiColors.black}@0.16->${uiColors.black}@0.08`);

      expect(
        resolveRestingColorForFeature({
          d: FEATURE_FRANCE,
          kind: "side",
          admin: "France",
          isFound: false,
          isEndScreen: true,
          isPerfectScore: false,
          isRegionalMode: false,
          isLight: false,
          UI_COLORS: { mapBase: "#34423d", error: uiColors.error, black: uiColors.black },
          lerpColor: lerpMock,
        })
      ).toBe(`#34423d->${uiColors.error}@0.2->${uiColors.black}@0.06`);
    });
  });
});
