import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import HomeScreenCategoryCarousel from "../components/HomeScreenCategoryCarousel";
import { THEME } from "../config/designSystem";
import { departmentsDataMap } from "../data/departmentsData";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { usStatesDataMap } from "../data/usStatesData";
import {
  FOUND_HIGHLIGHT,
  FOUND_SURFACE_GREEN,
  getCachedMaterial,
  getFeatureMonochromeShade,
  getTransitionState,
  isSameAdmin,
  mutedFoundGreen,
  resolveCountryCapColor,
  resolveFoundCountryColor,
  resolveGhostCountryColor,
  resolveModeTransitionColor,
  resolvePolygonShaderMode,
  resolvePolygonStrokeWidth,
  resolveRegionalLandColor,
} from "../globe/render/polygonColorResolver";
import { getCapitalVector3, syncPolygonShaderUniforms } from "../globe/render/polygonGlitchShader";

describe("Adversarial M3 Stress Tests — polygonColorResolver.js", () => {
  const dummyLerp = (a, b, t) => `lerp(${a},${b},${t})`;
  const mockUIColors = {
    mapBase: THEME.dark.mapBase,
    mapSea: "var(--sea)",
    mapBorder: "var(--border)",
    accent: "var(--accent)",
    paper: "var(--paper)",
    black: "var(--black)",
    gold: "var(--gold)",
    success: "var(--success)",
    error: "var(--error)",
    textMain: "var(--text-main)",
    textMuted: "var(--text-muted)",
    textInverse: "var(--text-inverse)",
    strokeWidthDesktop: "1.2",
    strokeWidthMobile: "0.8",
  };

  describe("resolveRegionalLandColor & resolveGhostCountryColor fallback robustness", () => {
    it("safely handles undefined/null/empty parameters without throwing", () => {
      // 1. undefined fallbackRegionColor
      expect(resolveRegionalLandColor("Europe", {})).toBe(THEME.dark.mapBase);
      expect(resolveRegionalLandColor(undefined, {})).toBe(THEME.dark.mapBase);
      expect(resolveRegionalLandColor(null, {})).toBe(THEME.dark.mapBase);

      // 2. null / empty fallbackRegionColor
      expect(resolveRegionalLandColor("Asia", { fallbackRegionColor: null })).toBe(
        THEME.dark.mapBase
      );
      expect(resolveRegionalLandColor("Asia", { fallbackRegionColor: "" })).toBe(
        THEME.dark.mapBase
      );
      expect(resolveRegionalLandColor("Asia", { fallbackRegionColor: undefined })).toBe(
        THEME.dark.mapBase
      );

      // 3. valid fallbackRegionColor
      expect(resolveRegionalLandColor("Asia", { fallbackRegionColor: "var(--accent)" })).toBe(
        "var(--accent)"
      );

      // 4. resolveGhostCountryColor with varied null/undefined opts
      expect(resolveGhostCountryColor(null, null, null)).toBe(THEME.dark.mapBase);
      expect(resolveGhostCountryColor(undefined, undefined, undefined)).toBe(THEME.dark.mapBase);
      expect(resolveGhostCountryColor({}, {}, {})).toBe(THEME.dark.mapBase);
      expect(resolveGhostCountryColor({}, {}, { fallbackRegionColor: null })).toBe(
        THEME.dark.mapBase
      );
      expect(resolveGhostCountryColor({}, {}, { fallbackRegionColor: undefined })).toBe(
        THEME.dark.mapBase
      );
      expect(
        resolveGhostCountryColor({}, {}, { fallbackRegionColor: "var(--selection-highlight)" })
      ).toBe("var(--selection-highlight)");
    });
  });

  describe("isSameAdmin stress testing", () => {
    it("handles falsy, asymmetric, and aliased lookups", () => {
      expect(isSameAdmin(null, null)).toBe(false);
      expect(isSameAdmin(undefined, "France")).toBe(false);
      expect(isSameAdmin("France", undefined)).toBe(false);
      expect(isSameAdmin("", "")).toBe(false);
      expect(isSameAdmin("France", "France")).toBe(true);

      const customAliasMap = {
        FRA: { admin: "France", name_en: "France", name_fr: "France" },
        France: { admin: "France", name_en: "France", name_fr: "France" },
      };
      expect(isSameAdmin("France", "FRA", customAliasMap)).toBe(true);
      expect(isSameAdmin("FRA", "France", customAliasMap)).toBe(true);
      expect(isSameAdmin("UnknownCountry1", "UnknownCountry1")).toBe(true);
      expect(isSameAdmin("UnknownCountry1", "UnknownCountry2")).toBe(false);
    });
  });

  describe("getCachedMaterial stress testing", () => {
    it("handles null/undefined and key aliasing", () => {
      const cache = new Map();
      expect(getCachedMaterial(cache, null)).toBe(null);
      expect(getCachedMaterial(cache, undefined)).toBe(null);

      const fakeMaterial = { id: "mat-1" };
      cache.set("France", fakeMaterial);

      expect(getCachedMaterial(cache, "France")).toBe(fakeMaterial);

      const customAliasMap = {
        FRA: { admin: "France", name_en: "France", name_fr: "France" },
        France: { admin: "France", name_en: "France", name_fr: "France" },
      };
      expect(getCachedMaterial(cache, "FRA", customAliasMap)).toBe(fakeMaterial);
      expect(getCachedMaterial(cache, "Germany")).toBe(null);
    });
  });

  describe("getFeatureMonochromeShade stress testing", () => {
    it("is deterministic and handles non-string / null inputs gracefully", () => {
      const base = "var(--map-base)";
      expect(getFeatureMonochromeShade(null, base, dummyLerp, mockUIColors)).toBe(base);
      expect(getFeatureMonochromeShade(12345, base, dummyLerp, mockUIColors)).toBe(base);
      expect(getFeatureMonochromeShade(undefined, base, dummyLerp, mockUIColors)).toBe(base);

      const shade1 = getFeatureMonochromeShade("Texas", base, dummyLerp, mockUIColors);
      const shade2 = getFeatureMonochromeShade("Texas", base, dummyLerp, mockUIColors);
      expect(shade1).toBe(shade2);
      expect(shade1).toContain("lerp(");
    });
  });

  describe("resolveCountryCapColor stress testing", () => {
    it("handles all game mode branches and state combinations", () => {
      const baseArgs = {
        admin: "France",
        foundSet: new Set(),
        selectedCountry: null,
        isError: false,
        isSuccess: false,
        isEndScreen: false,
        isPerfectScore: false,
        isLearn: false,
        UI_COLORS: mockUIColors,
        lerpColor: dummyLerp,
        mapBase: mockUIColors.mapBase,
      };

      // Unfound resting
      expect(resolveCountryCapColor(baseArgs)).toBe(mockUIColors.mapBase);

      // Found resting
      expect(resolveCountryCapColor({ ...baseArgs, foundSet: new Set(["France"]) })).toBe(
        FOUND_SURFACE_GREEN
      );
      expect(resolveFoundCountryColor()).toBe(FOUND_SURFACE_GREEN);
      expect(mutedFoundGreen(mockUIColors.mapBase, dummyLerp)).toBe(FOUND_SURFACE_GREEN);

      // Selected unfound (normal play mode)
      expect(resolveCountryCapColor({ ...baseArgs, selectedCountry: "France" })).toBe(
        mockUIColors.mapBase
      );

      // Selected unfound error
      expect(
        resolveCountryCapColor({
          ...baseArgs,
          selectedCountry: "France",
          isError: true,
        })
      ).toBe(mockUIColors.error);

      // Learn mode selected
      expect(
        resolveCountryCapColor({
          ...baseArgs,
          isLearn: true,
          selectedCountry: "France",
        })
      ).toBe(FOUND_HIGHLIGHT);

      // End Screen permutations
      expect(
        resolveCountryCapColor({
          ...baseArgs,
          isEndScreen: true,
          foundSet: new Set(),
        })
      ).toBe(mockUIColors.error);

      expect(
        resolveCountryCapColor({
          ...baseArgs,
          isEndScreen: true,
          foundSet: new Set(["France"]),
          isPerfectScore: false,
        })
      ).toBe(mockUIColors.success);

      expect(
        resolveCountryCapColor({
          ...baseArgs,
          isEndScreen: true,
          foundSet: new Set(["France"]),
          isPerfectScore: true,
        })
      ).toBe(mockUIColors.gold);
    });
  });

  describe("resolvePolygonStrokeWidth & resolvePolygonShaderMode", () => {
    it("resolves stroke widths with scale modifiers without crashing", () => {
      const width = resolvePolygonStrokeWidth({
        admin: "France",
        isGhostCountry: false,
        selectedCountry: "France",
        isRegionalMode: false,
        foundSet: new Set(),
        mode: "countries",
        isLight: false,
        globeLightingEnabled: false,
        perfProfile: { isMobile: true },
        UI_COLORS: mockUIColors,
      });
      expect(typeof width).toBe("number");
      expect(width).toBeGreaterThan(0);
    });

    it("resolves shader mode correctly for edge conditions", () => {
      const shaderMode = resolvePolygonShaderMode({
        admin: "France",
        kind: "cap",
        mode: "countries",
        foundSet: new Set(),
        isIsolated: true,
        isPrevTransitioning: false,
        isEndScreen: false,
        isHomeScreen: false,
        isError: false,
        isSuccess: false,
      });
      expect(shaderMode.useShader).toBe(true);
      expect(shaderMode.isSelectionHighlight).toBe(false);
    });
  });

  describe("getTransitionState & resolveModeTransitionColor", () => {
    it("handles null / inactive transitions gracefully", () => {
      expect(getTransitionState(null)).toBe(null);
      expect(getTransitionState({ current: null })).toBe(null);
      expect(getTransitionState({ current: { active: false } })).toBe(null);

      const transState = {
        progress: 0.5,
        isEnteringRegional: true,
        isExitingRegional: false,
        fromDept: false,
        fromUs: false,
        toDept: true,
        toUs: false,
      };

      const ghostColor = resolveModeTransitionColor({
        d: { isGhostCountry: true, properties: { ADMIN: "France" } },
        transState,
        countryDataMap,
        gameDataMap: {},
        UI_COLORS: mockUIColors,
        getRegionSurfaceColor: () => "var(--accent)",
        getRegionSurfaceColorDimmed: () => "var(--text-muted)",
        getFeatureMonochromeShade: () => "var(--paper)",
        lerpColor: dummyLerp,
      });
      expect(ghostColor).toBe("lerp(var(--accent),var(--text-muted),0.5)");
    });
  });
});

describe("Adversarial M3 Stress Tests — HomeScreenCategoryCarousel.jsx", () => {
  it("computes exact category dataset counts matching authoritative source maps", () => {
    const expectedCountriesCount = Object.keys(countryDataMap).length;
    const expectedCapitalsCount = Object.keys(countryDataMap).filter(
      (k) => countryDataMap[k]?.capital
    ).length;
    const expectedDeptsCount = Object.keys(departmentsDataMap).length;
    const expectedStatesCount = Object.keys(usStatesDataMap).length;
    const expectedReliefsCount = Object.keys(riversMountainsDataMap).length;

    // Render French version
    const { unmount: unmountFr } = render(
      <HomeScreenCategoryCarousel
        onStartGame={vi.fn()}
        lang="fr"
        homeMode="countries"
        setHomeMode={vi.fn()}
      />
    );

    expect(
      screen.getByText(new RegExp(`${expectedCountriesCount} pays et territoires`, "i"))
    ).toBeDefined();
    expect(
      screen.getByText(new RegExp(`\\(${expectedCapitalsCount} au total\\)`, "i"))
    ).toBeDefined();
    expect(
      screen.getByText(new RegExp(`des ${expectedDeptsCount} départements`, "i"))
    ).toBeDefined();
    expect(screen.getByText(new RegExp(`les ${expectedStatesCount} États`, "i"))).toBeDefined();
    expect(
      screen.getByText(new RegExp(`${expectedReliefsCount} reliefs majeurs`, "i"))
    ).toBeDefined();
    unmountFr();

    // Render English version
    const { unmount: unmountEn } = render(
      <HomeScreenCategoryCarousel
        onStartGame={vi.fn()}
        lang="en"
        homeMode="countries"
        setHomeMode={vi.fn()}
      />
    );

    expect(
      screen.getByText(new RegExp(`${expectedCountriesCount} countries and territories`, "i"))
    ).toBeDefined();
    expect(screen.getByText(new RegExp(`\\(${expectedCapitalsCount} total\\)`, "i"))).toBeDefined();
    expect(
      screen.getByText(new RegExp(`all ${expectedDeptsCount} French departments`, "i"))
    ).toBeDefined();
    expect(screen.getByText(new RegExp(`all ${expectedStatesCount} US States`, "i"))).toBeDefined();
    expect(
      screen.getByText(new RegExp(`${expectedReliefsCount} major reliefs`, "i"))
    ).toBeDefined();
    unmountEn();
  });

  it("triggers onStartGame callbacks with accurate mode and learn arguments on button click", () => {
    const handleStartGame = vi.fn();
    const handleSetHomeMode = vi.fn();

    render(
      <HomeScreenCategoryCarousel
        onStartGame={handleStartGame}
        lang="fr"
        homeMode="countries"
        setHomeMode={handleSetHomeMode}
      />
    );

    const playBtn = screen.getAllByRole("button", { name: /jouer/i })[0];
    fireEvent.click(playBtn);
    expect(handleStartGame).toHaveBeenCalledWith("countries");

    const learnBtns = document.querySelectorAll(".card-learn-btn");
    expect(learnBtns.length).toBe(5);
    fireEvent.click(learnBtns[0]);
    expect(handleStartGame).toHaveBeenCalledWith("learn", "countries");
  });

  it("handles left and right arrow keyboard navigation", () => {
    vi.useFakeTimers();
    const handleSetHomeMode = vi.fn();

    render(
      <HomeScreenCategoryCarousel
        onStartGame={vi.fn()}
        lang="fr"
        homeMode="countries"
        setHomeMode={handleSetHomeMode}
      />
    );

    // Right Arrow triggers rightSwipe (reveals previous card: index 4 = rivers_mountains)
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(handleSetHomeMode).toHaveBeenCalledWith("rivers_mountains");

    // Advance beyond the 200ms animation debounce window
    vi.advanceTimersByTime(250);

    // Left Arrow triggers leftSwipe (reveals next card: index 1 = capitals)
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(handleSetHomeMode).toHaveBeenCalledWith("capitals");

    vi.useRealTimers();
  });
});

describe("Adversarial M3 Stress Tests — polygonGlitchShader.js & globeLabelBuilder.js", () => {
  it("getCapitalVector3 handles missing/undefined data and uses normalized fallback", () => {
    const nullVec = getCapitalVector3(null);
    expect(nullVec.length()).toBe(1);
    expect(nullVec.y).toBe(1);

    const unknownVec = getCapitalVector3("UnknownNonExistentPlace");
    expect(unknownVec.length()).toBe(1);
    expect(unknownVec.y).toBe(1);

    const fraVec = getCapitalVector3("France");
    expect(fraVec.length()).toBeCloseTo(1, 4);
  });

  it("syncPolygonShaderUniforms updates uniforms defensively without throwing on null shader", () => {
    expect(() => syncPolygonShaderUniforms(null, {})).not.toThrow();

    const mockShader = {
      uniforms: {
        uIsError: { value: 0 },
        uIsSuccess: { value: 0 },
        uIsFound: { value: 0 },
        uIsSatellite: { value: 0 },
        uFadeProgress: { value: 1 },
      },
    };

    syncPolygonShaderUniforms(mockShader, {
      admin: "France",
      selectedCountry: "France",
      isError: true,
      isSuccess: false,
      isFound: false,
      isIsolated: true,
      isSatellite: true,
    });

    expect(mockShader.uniforms.uIsError.value).toBe(1.0);
    expect(mockShader.uniforms.uIsSatellite.value).toBe(1.0);
    expect(mockShader.uniforms.uFadeProgress.value).toBe(0.0);
  });
});
