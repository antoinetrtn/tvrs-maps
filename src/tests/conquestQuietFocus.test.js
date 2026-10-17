import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useGlobePolygons } from "../globe/hooks/useGlobePolygons";
import { withQuietFocus } from "../multiplayer/conquestFocus";

describe("withQuietFocus", () => {
  const overlay = {
    colors: { France: "#22c55e" },
    strokes: {},
    rings: [],
    neutral: "#334155",
  };

  it("returns null when overlay is null", () => {
    expect(withQuietFocus(null, { id: "France", sticky: false })).toBeNull();
    expect(withQuietFocus(null, null)).toBeNull();
  });

  it("returns the exact overlay reference when focus is null or undefined", () => {
    expect(withQuietFocus(overlay, null)).toBe(overlay);
    expect(withQuietFocus(overlay, undefined)).toBe(overlay);
  });

  it("returns the exact overlay reference when focus is sticky", () => {
    const stickyFocus = { id: "France", sticky: true };
    expect(withQuietFocus(overlay, stickyFocus)).toBe(overlay);
  });

  it("returns a new overlay with quietFocusId when focus is transient", () => {
    const transientFocus = { id: "France", sticky: false };
    const result = withQuietFocus(overlay, transientFocus);

    expect(result).not.toBe(overlay);
    expect(result).toEqual({
      ...overlay,
      quietFocusId: "France",
    });
    expect(overlay.quietFocusId).toBeUndefined();
  });

  it("preserves reference stability when focus is absent", () => {
    const first = withQuietFocus(overlay, null);
    const second = withQuietFocus(overlay, null);
    expect(first).toBe(second);
    expect(first).toBe(overlay);
  });
});

describe("useGlobePolygons with quiet focus", () => {
  const createProps = (overrides = {}) => ({
    mode: "countries",
    theme: "default",
    globeTheme: "blackout",
    isLight: false,
    globeLightingEnabled: false,
    perfProfile: {},
    selectedCountry: null,
    foundSet: new Set(),
    _foundList: [],
    conquestOverlay: null,
    isHomeScreen: false,
    isEndScreen: false,
    isDepartmentMode: false,
    isUsStatesMode: false,
    isPerfectScore: false,
    isError: false,
    isSuccess: false,
    selectionTransition: {
      state: {
        transitioningPreviousCountryState: null,
        transitioningIncomingCountryState: null,
      },
    },
    modeTransitionRef: { current: null },
    transitionStep: 0,
    ...overrides,
  });

  it("renders quiet owned focus like a non-selected owned country", () => {
    const conquestOverlay = {
      colors: { France: "#22c55e" },
      strokes: {},
      rings: [],
      neutral: "#334155",
      quietFocusId: "France",
    };

    const { result } = renderHook(() =>
      useGlobePolygons(
        createProps({
          selectedCountry: "France",
          conquestOverlay,
        })
      )
    );

    const feature = { properties: { ADMIN: "France" } };

    // 1. isQuietOwnedFocus returns true for France, false for others
    expect(result.current.isQuietOwnedFocus("France")).toBe(true);
    expect(result.current.isQuietOwnedFocus("Germany")).toBe(false);

    // 2. getBasePolygonColor returns the owner colour
    expect(result.current.getBasePolygonColor(feature)).toBe("#22c55e");

    // 3. getPolygonStroke uses the non-selected stroke (not UI_COLORS.accent)
    const stroke = result.current.getPolygonStroke(feature);
    expect(stroke).not.toBe(result.current.UI_COLORS.accent);

    // 4. getPolygonMaterial uses shared owner material rather than isolated shader
    const mat = result.current.getPolygonCapMaterial(feature);
    expect(mat.userData.isIsolated).toBe(false);
    expect(mat.userData.isGlitchShaderCap).toBe(false);

    // 5. getBaseColorForCountryAndKind returns the owner colour lerped with black
    const baseColorCap = result.current.getBaseColorForCountryAndKind("France", "cap");
    const expectedCap = result.current.lerpColor("#22c55e", result.current.UI_COLORS.black, 0.16);
    expect(baseColorCap).toBe(expectedCap);

    const baseColorSide = result.current.getBaseColorForCountryAndKind("France", "side");
    const expectedSide = result.current.lerpColor(
      expectedCap,
      result.current.UI_COLORS.black,
      0.08
    );
    expect(baseColorSide).toBe(expectedSide);
  });

  it("preserves selection styling for sticky selections on owned countries", () => {
    const conquestOverlay = {
      colors: { France: "#22c55e" },
      strokes: {},
      rings: [],
      neutral: "#334155",
      quietFocusId: null, // sticky selection, not quiet
    };

    const { result } = renderHook(() =>
      useGlobePolygons(
        createProps({
          selectedCountry: "France",
          conquestOverlay,
        })
      )
    );

    const feature = { properties: { ADMIN: "France" } };

    expect(result.current.isQuietOwnedFocus("France")).toBe(false);

    // getPolygonStroke returns accent when selected
    const stroke = result.current.getPolygonStroke(feature);
    expect(stroke).toBe(result.current.UI_COLORS.accent);

    // getBaseColorForCountryAndKind still returns owner colour so dissolve fades to owner
    const baseColorCap = result.current.getBaseColorForCountryAndKind("France", "cap");
    const expectedCap = result.current.lerpColor("#22c55e", result.current.UI_COLORS.black, 0.16);
    expect(baseColorCap).toBe(expectedCap);
  });

  it("is a no-op when conquestOverlay is null", () => {
    const { result } = renderHook(() =>
      useGlobePolygons(
        createProps({
          selectedCountry: "France",
          conquestOverlay: null,
        })
      )
    );

    expect(result.current.isQuietOwnedFocus("France")).toBe(false);

    const feature = { properties: { ADMIN: "France" } };
    expect(result.current.getPolygonStroke(feature)).toBe(result.current.UI_COLORS.accent);
  });
});
