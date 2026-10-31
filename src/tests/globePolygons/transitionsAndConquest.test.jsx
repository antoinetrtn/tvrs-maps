import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONQUEST_PLAYER_COLORS } from "../../config/designSystem";
import { POLYGON_ALTITUDE } from "../../config/gameConfig";
import { useGlobePolygons } from "../../globe/hooks/useGlobePolygons";
import { MODE_TRANSITION_MS } from "../../globe/render/modeTransition";
import {
  CONQUEST_OVERLAY_FIXTURE,
  createHookProps,
  FEATURE_BRAZIL,
  FEATURE_DEPT_AIN,
  FEATURE_FRANCE,
  FEATURE_JAPAN,
  FEATURE_SPAIN,
  resetGlobePolygonTestGlobals,
  summarizeFeatureOutput,
} from "./testHelpers";

describe("useGlobePolygons characterization — Conquest, Mode Transitions, and Selection Transitions", () => {
  beforeEach(() => {
    resetGlobePolygonTestGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGlobePolygonTestGlobals();
  });

  describe("Conquest mode matrix (owned by me, owned by opponent, locked, neutral, quiet focus, sticky focus)", () => {
    it("characterizes unselected conquest states", () => {
      const { result: monoRes } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            conquestOverlay: CONQUEST_OVERLAY_FIXTURE,
          })
        )
      );

      const franceMine = summarizeFeatureOutput(monoRes.current, FEATURE_FRANCE);
      const spainOpponent = summarizeFeatureOutput(monoRes.current, FEATURE_SPAIN);
      const brazilLocked = summarizeFeatureOutput(monoRes.current, FEATURE_BRAZIL);
      const japanNeutral = summarizeFeatureOutput(monoRes.current, FEATURE_JAPAN);

      // Colors depend on owner / locked / neutral
      expect(franceMine.color).toBe(CONQUEST_PLAYER_COLORS.teal);
      expect(spainOpponent.color).toBe(CONQUEST_PLAYER_COLORS.amber);
      expect(brazilLocked.color).toBe(CONQUEST_PLAYER_COLORS.locked);
      expect(japanNeutral.color).toBe(CONQUEST_PLAYER_COLORS.neutral);
      expect(franceMine.color).not.toBe(spainOpponent.color);
      expect(franceMine.color).not.toBe(japanNeutral.color);

      // Patterned opponent player gets ink outline stroke; solid owner gets standard unfound stroke
      expect(spainOpponent.stroke).toBe(CONQUEST_PLAYER_COLORS.ink);
      expect(franceMine.stroke).not.toBe(CONQUEST_PLAYER_COLORS.ink);
      expect(franceMine.stroke).toBe(japanNeutral.stroke);

      // CHARACTERIZATION: current behavior — getBaseColorForCountryAndKind checks
      // conquestOverlay.colors[admin] but NOT conquestOverlay.neutral, so unclaimed Japan
      // returns its regional surface color instead of darkened neutral.
      expect(franceMine.baseCapColor).not.toBe(monoRes.current.REGION_COLORS.Europe);
      expect(japanNeutral.baseCapColor).toBe(monoRes.current.REGION_COLORS.Asia);
    });

    it("characterizes just-captured transient focus (quietFocusId) vs sticky selection on owned and neutral countries", () => {
      // 1. Just captured / transient focus (quietFocusId === selectedCountry)
      const quietOverlay = {
        ...CONQUEST_OVERLAY_FIXTURE,
        quietFocusId: "France",
      };
      const { result: quietRes } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            selectedCountry: "France",
            conquestOverlay: quietOverlay,
          })
        )
      );
      const franceQuiet = summarizeFeatureOutput(quietRes.current, FEATURE_FRANCE);

      expect(quietRes.current.isQuietOwnedFocus("France")).toBe(true);
      expect(franceQuiet.color).toBe(CONQUEST_PLAYER_COLORS.teal);
      expect(franceQuiet.stroke).not.toBe(quietRes.current.UI_COLORS.accent);
      expect(franceQuiet.capMaterial.userData.isGlitchShaderCap).toBe(false);
      expect(franceQuiet.capMaterial.userData.isIsolated).toBe(false);
      // CHARACTERIZATION: current behavior — getPolygonAltitude, getPolygonStrokeWidth, and
      // getPolygonSideMaterial do NOT check isQuietOwnedFocus, so a quiet-focused owned country
      // still gets selected altitude (0.008), selected strokeWidth (7.5), and visible side walls!
      expect(franceQuiet.altitude).toBe(POLYGON_ALTITUDE.selected);
      expect(franceQuiet.strokeWidth).toBe(7.5);
      expect(franceQuiet.sideMaterial.visible).toBe(true);

      // 2. Sticky selection on solid-owner country (France) with error flash
      const { result: stickySolidErrorRes } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            selectedCountry: "France",
            isError: true,
            conquestOverlay: CONQUEST_OVERLAY_FIXTURE,
          })
        )
      );
      const franceStickyError = summarizeFeatureOutput(stickySolidErrorRes.current, FEATURE_FRANCE);
      // CHARACTERIZATION: current behavior — in Conquest, getBasePolygonColor returns
      // conquestOverlay.colors[admin] before checking isError, so color stays owner teal,
      // while stroke becomes UI_COLORS.error and the glitch shader sets uIsError=1.
      expect(franceStickyError.color).toBe(CONQUEST_PLAYER_COLORS.teal);
      expect(franceStickyError.stroke).toBe(stickySolidErrorRes.current.UI_COLORS.error);
      expect(franceStickyError.capMaterial.userData.isGlitchShaderCap).toBe(true);
      expect(franceStickyError.capMaterial.uniforms.uIsError).toBe(1);
      // CHARACTERIZATION: current behavior — resolveRestingColorForFeature ignores conquestOverlay,
      // so the underlying material.color of a selected owned country is UI_COLORS.mapBase.
      expect(franceStickyError.capMaterial.color).toBe(
        stickySolidErrorRes.current.UI_COLORS.mapBase
      );

      // 3. Sticky selection on patterned-owner country (Spain, which has conquestOverlay.strokes.Spain)
      const { result: stickyPatternedRes } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            selectedCountry: "Spain",
            isError: true,
            conquestOverlay: CONQUEST_OVERLAY_FIXTURE,
          })
        )
      );
      const spainStickyError = summarizeFeatureOutput(stickyPatternedRes.current, FEATURE_SPAIN);
      // CHARACTERIZATION: current behavior — getPolygonStroke returns conquestOverlay.strokes[admin]
      // BEFORE checking `if (isSelected)`, so patterned-owner countries keep their ink stroke
      // even when selected or flashing error/success!
      expect(spainStickyError.stroke).toBe(CONQUEST_PLAYER_COLORS.ink);

      // 4. Deselection transition on owned country suppresses cap glitch shader
      const { result: ownedDeselectRes } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            selectedCountry: null,
            conquestOverlay: CONQUEST_OVERLAY_FIXTURE,
            selectionTransition: {
              state: {
                transitioningPreviousCountryState: "France",
                transitioningIncomingCountryState: null,
              },
            },
          })
        )
      );
      const franceOwnedDeselect = summarizeFeatureOutput(ownedDeselectRes.current, FEATURE_FRANCE);
      expect(franceOwnedDeselect.capMaterial.userData.isGlitchShaderCap).toBe(false);
      // CHARACTERIZATION: current behavior — getPolygonSideMaterial and getPolygonAltitude do not
      // suppress transitioningPreviousCountryState for owned countries.
      expect(franceOwnedDeselect.altitude).toBe(POLYGON_ALTITUDE.selected);
      expect(franceOwnedDeselect.sideMaterial.visible).toBe(true);
    });
  });

  describe("Mode (layer) transitions across transitionStep = 0, mid, and end", () => {
    it("characterizes entering regional mode (countries -> departments) at step 0, mid (0.4), and end", () => {
      const nowSpy = vi.spyOn(performance, "now").mockReturnValue(1000);
      const modeTransitionRef = {
        current: {
          active: true,
          fromDept: false,
          fromUs: false,
          toDept: true,
          toUs: false,
          startTime: 1000,
          duration: MODE_TRANSITION_MS,
        },
      };

      const ghostSpain = { ...FEATURE_SPAIN, isGhostCountry: true };
      const parentFrance = { ...FEATURE_FRANCE, isParentCountryFeature: true };

      const { result, rerender } = renderHook(
        ({ step }) =>
          useGlobePolygons(
            createHookProps({
              mode: "departments",
              isDepartmentMode: true,
              modeTransitionRef,
              transitionStep: step,
            })
          ),
        { initialProps: { step: 0 } }
      );

      // Step 0 (elapsed = 0, progress = 0)
      const ainStep0 = summarizeFeatureOutput(result.current, FEATURE_DEPT_AIN);
      const ghostStep0 = summarizeFeatureOutput(result.current, ghostSpain);
      const parentStep0 = summarizeFeatureOutput(result.current, parentFrance);

      expect(ainStep0.color).toBe(result.current.REGION_COLORS.Europe); // starts at Europe world color
      expect(ainStep0.stroke).toBe(result.current.UI_COLORS.mapSea); // starts at mapSea
      expect(ainStep0.strokeWidth).toBe(0);
      expect(ghostStep0.color).toBe(result.current.REGION_COLORS.Europe); // starts at world color
      expect(ghostStep0.capMaterial.visible).toBe(true);
      expect(parentStep0.color).toBe(result.current.REGION_COLORS.Europe);
      expect(parentStep0.altitude).toBe(POLYGON_ALTITUDE.parentBackdrop);
      expect(parentStep0.strokeWidth).toBe(1.6);

      // Mid transition (elapsed = 50% of duration -> quantized stepProgress(0.5) = 0.4)
      nowSpy.mockReturnValue(1000 + MODE_TRANSITION_MS * 0.5);
      rerender({ step: 2 });

      const ainMid = summarizeFeatureOutput(result.current, FEATURE_DEPT_AIN);
      const ghostMid = summarizeFeatureOutput(result.current, ghostSpain);
      const parentMid = summarizeFeatureOutput(result.current, parentFrance);

      expect(ainMid.color).not.toBe(ainStep0.color);
      expect(ainMid.strokeWidth).toBe(0.44); // 1.1 * 0.4
      expect(ghostMid.capMaterial.visible).toBe(true);
      expect(ghostMid.capMaterial.opacity).toBe(1);
      expect(parentMid.strokeWidth).toBeCloseTo(0.96); // 1.6 * (1 - 0.4)

      // End of transition (elapsed >= duration -> getTransitionState sets active = false)
      nowSpy.mockReturnValue(1000 + MODE_TRANSITION_MS + 10);
      rerender({ step: 5 });

      const ainEnd = summarizeFeatureOutput(result.current, FEATURE_DEPT_AIN);
      const ghostEnd = summarizeFeatureOutput(result.current, ghostSpain);

      expect(modeTransitionRef.current.active).toBe(false);
      expect(ainEnd.strokeWidth).toBe(1.1);
      expect(ghostEnd.capMaterial.visible).toBe(true);
      expect(ghostEnd.capMaterial.opacity).toBe(1);
    });

    it("characterizes exiting regional mode (departments -> countries) and regional-to-regional transitions", () => {
      const nowSpy = vi.spyOn(performance, "now").mockReturnValue(2000 + MODE_TRANSITION_MS * 0.5);
      const modeTransitionRef = {
        current: {
          active: true,
          fromDept: true,
          fromUs: false,
          toDept: false,
          toUs: false,
          startTime: 2000,
          duration: MODE_TRANSITION_MS,
        },
      };

      const exitingAin = {
        ...FEATURE_DEPT_AIN,
        isDepartmentFeature: false,
        isExitingDepartmentFeature: true,
      };
      const parentFrance = { ...FEATURE_FRANCE, isParentCountryFeature: true };

      const { result } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            mode: "countries",
            isDepartmentMode: false,
            modeTransitionRef,
            transitionStep: 2,
          })
        )
      );

      const exitingAinOut = summarizeFeatureOutput(result.current, exitingAin);
      const parentFranceOut = summarizeFeatureOutput(result.current, parentFrance);
      const worldSpainOut = summarizeFeatureOutput(result.current, FEATURE_SPAIN);

      expect(exitingAinOut.altitude).toBe(POLYGON_ALTITUDE.exitingRegional);
      expect(exitingAinOut.strokeWidth).toBe(0.66); // 1.1 * (1 - 0.4)

      // CHARACTERIZATION: current behavior — in getPolygonAltitude, `d.isParentCountryFeature` only
      // gets POLYGON_ALTITUDE.parentBackdrop (0.0001) when `isRegionalMode` is true; when exiting
      // regional (isRegionalMode=false), it gets regular world altitude.
      expect(parentFranceOut.altitude).toBe(POLYGON_ALTITUDE.base);
      expect(parentFranceOut.strokeWidth).toBeCloseTo(0.64); // 1.6 * 0.4

      // World Spain is back to an opaque land cap.
      expect(worldSpainOut.capMaterial.visible).toBe(true);
      expect(worldSpainOut.capMaterial.opacity).toBe(1);

      // Regional-to-regional (departments -> us_states): ghost countries keep constant ghostColor
      nowSpy.mockReturnValue(3000 + MODE_TRANSITION_MS * 0.5);
      const regToRegRef = {
        current: {
          active: true,
          fromDept: true,
          fromUs: false,
          toDept: false,
          toUs: true,
          startTime: 3000,
          duration: MODE_TRANSITION_MS,
        },
      };
      const { result: regToRegRes } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            mode: "us_states",
            isUsStatesMode: true,
            modeTransitionRef: regToRegRef,
            transitionStep: 2,
          })
        )
      );
      const ghostInRegToReg = summarizeFeatureOutput(regToRegRes.current, {
        ...FEATURE_SPAIN,
        isGhostCountry: true,
      });
      expect(ghostInRegToReg.color).toMatchSnapshot();
    });
  });

  describe("Selection transitions (transitioningPreviousCountryState and transitioningIncomingCountryState)", () => {
    it("characterizes deselection glitch transition and incoming transition", () => {
      // 1. Deselection of unfound country: opaque glitch shader cap + visible side + selected altitude
      const { result: monoDeselect } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            selectedCountry: null,
            selectionTransition: {
              state: {
                transitioningPreviousCountryState: "France",
                transitioningIncomingCountryState: null,
              },
            },
          })
        )
      );
      const franceMonoDeselect = summarizeFeatureOutput(monoDeselect.current, FEATURE_FRANCE);
      expect(franceMonoDeselect.altitude).toBe(POLYGON_ALTITUDE.selected);
      expect(franceMonoDeselect.capMaterial.userData.isGlitchShaderCap).toBe(true);
      expect(franceMonoDeselect.capMaterial.transparent).toBe(false);
      expect(franceMonoDeselect.capMaterial.opacity).toBe(1);
      expect(franceMonoDeselect.sideMaterial.visible).toBe(true);

      // 3. Deselecting an already-found country: no glitch shader on cap, but altitude & side stay elevated
      const { result: foundDeselect } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            selectedCountry: null,
            foundSet: new Set(["Spain"]),
            selectionTransition: {
              state: {
                transitioningPreviousCountryState: "Spain",
                transitioningIncomingCountryState: null,
              },
            },
          })
        )
      );
      const spainFoundDeselect = summarizeFeatureOutput(foundDeselect.current, FEATURE_SPAIN);
      expect(spainFoundDeselect.capMaterial.userData.isGlitchShaderCap).toBe(false);
      expect(spainFoundDeselect.capMaterial.userData.isFoundCap).toBe(true);
      expect(spainFoundDeselect.altitude).toBe(POLYGON_ALTITUDE.selected);
      expect(spainFoundDeselect.sideMaterial.visible).toBe(true);

      // 4. Incoming selection transition sets uSelectInTransition = 1
      const { result: incomingRes } = renderHook(() =>
        useGlobePolygons(
          createHookProps({
            selectedCountry: "France",
            selectionTransition: {
              state: {
                transitioningPreviousCountryState: null,
                transitioningIncomingCountryState: "France",
              },
            },
          })
        )
      );
      const franceIncoming = summarizeFeatureOutput(incomingRes.current, FEATURE_FRANCE);
      expect(franceIncoming.capMaterial.uniforms.uSelectInTransition).toBe(1);
    });
  });
});
