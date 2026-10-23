import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ACCENT_PRESETS, setActiveAccent } from "../config/accentPresets";
import { getThemeRegionColor, GLITCH_EFFECT_SETTINGS } from "../config/designSystem";
import { POLYGON_ALTITUDE } from "../config/gameConfig";
import { buildMonochromePalette } from "../config/monochromeGlobe";
import { setGlobePref } from "../globe/globePrefs";
import { FOUND_HIGHLIGHT, FOUND_SURFACE_GREEN } from "../globe/render/polygonColorResolver";
import {
  FEATURE_BRAZIL,
  FEATURE_DEPT_AIN,
  FEATURE_FRANCE,
  FEATURE_JAPAN,
  FEATURE_RIVER_AMAZON,
  FEATURE_SOMALILAND,
  FEATURE_SPAIN,
  FEATURE_US_CALIFORNIA,
  renderPolygons,
  resetGlobePolygonTestGlobals,
  summarizeFeatureOutput,
} from "./globePolygons/testHelpers";

describe("useGlobePolygons characterization — modes, themes, and states", () => {
  beforeEach(() => {
    resetGlobePolygonTestGlobals();
  });

  afterEach(() => {
    resetGlobePolygonTestGlobals();
  });

  describe("Core state invariants (world countries mode)", () => {
    it("freezes neutral, selected, found, and selected+found outputs in monochrome dark theme", () => {
      const { result: neutralRes } = renderPolygons({
        globeTheme: "monochrome",
        selectedCountry: null,
        foundSet: new Set(["Spain"]),
      });

      const franceNeutral = summarizeFeatureOutput(neutralRes.current, FEATURE_FRANCE);
      const spainFound = summarizeFeatureOutput(neutralRes.current, FEATURE_SPAIN);
      const brazilNeutral = summarizeFeatureOutput(neutralRes.current, FEATURE_BRAZIL);

      // Neutral country uses regional surface color and shared non-shader material; side is invisible
      expect(franceNeutral.color).toBe(neutralRes.current.REGION_COLORS.Europe);
      expect(brazilNeutral.color).toBe(neutralRes.current.REGION_COLORS.Americas);
      expect(brazilNeutral.color).toBe(neutralRes.current.UI_COLORS.mapBase);
      expect(franceNeutral.color).not.toBe(brazilNeutral.color);
      expect(franceNeutral.altitude).toBe(POLYGON_ALTITUDE.base);
      expect(franceNeutral.strokeWidth).toBe(1.6);
      expect(franceNeutral.capMaterial.userData).toEqual({
        admin: "France",
        isGlitchShaderCap: false,
        isFoundCap: false,
        isIsolated: false,
        isShared: true,
      });
      expect(franceNeutral.sideMaterial.visible).toBe(false);
      expect(franceNeutral.sideMaterial.type).toBe("MeshBasicMaterial");

      // Found country uses FOUND_SURFACE_GREEN, emissive found-cap material, and thicker stroke
      expect(spainFound.color).toBe(FOUND_SURFACE_GREEN);
      expect(spainFound.color).not.toBe(franceNeutral.color);
      expect(spainFound.stroke).not.toBe(franceNeutral.stroke);
      expect(spainFound.strokeWidth).toBe(1.2);
      expect(spainFound.baseCapColor).toBe(FOUND_SURFACE_GREEN);
      expect(spainFound.baseSideColor).toBe(FOUND_SURFACE_GREEN);
      expect(spainFound.capMaterial.color).toBe(neutralRes.current.UI_COLORS.globeEmissive);
      expect(spainFound.capMaterial.emissive).toBe(FOUND_SURFACE_GREEN);
      expect(spainFound.capMaterial.emissiveIntensity).toBe(1);
      expect(spainFound.capMaterial.toneMapped).toBe(false);
      expect(spainFound.capMaterial.userData.isFoundCap).toBe(true);
      expect(spainFound.capMaterial.userData.isShared).toBe(false);
      expect(spainFound.sideMaterial.visible).toBe(false);

      // Selected unfound country
      const { result: selectedRes } = renderPolygons({
        globeTheme: "monochrome",
        selectedCountry: "France",
        foundSet: new Set(["Spain"]),
      });
      const franceSelected = summarizeFeatureOutput(selectedRes.current, FEATURE_FRANCE);
      const expectedSelectedCapTarget = selectedRes.current.lerpColor(
        selectedRes.current.UI_COLORS.mapBase,
        selectedRes.current.UI_COLORS.black,
        0.16
      );

      // CHARACTERIZATION: current behavior — selecting an unfound world country changes its
      // getPolygonColor from the region surface color to UI_COLORS.mapBase,
      // while the cap material switches to the isolated glitch shader using restingColor.
      expect(franceSelected.color).toBe(selectedRes.current.UI_COLORS.mapBase);
      expect(franceSelected.color).not.toBe(franceNeutral.color);
      expect(franceSelected.stroke).toBe(selectedRes.current.UI_COLORS.accent);
      expect(franceSelected.strokeWidth).toBe(7.5);
      expect(franceSelected.altitude).toBe(POLYGON_ALTITUDE.selected);
      expect(franceSelected.altitude).toBeGreaterThan(franceNeutral.altitude);
      expect(franceSelected.capMaterial.userData.isGlitchShaderCap).toBe(true);
      expect(franceSelected.capMaterial.userData.isIsolated).toBe(true);
      expect(franceSelected.capMaterial.transparent).toBe(false);
      expect(franceSelected.capMaterial.opacity).toBe(1);
      expect(franceSelected.capMaterial.uniforms).toMatchObject({
        uFadeProgress: 0,
        uTargetColor: expectedSelectedCapTarget,
        uIsError: 0,
        uIsSuccess: 0,
        uIsSelection: 0,
        uIsLight: 0,
        uTheme: 1,
        uIsSide: 0,
        uIsFound: 0,
        uIsSatellite: 0,
        uSelectInTransition: 0,
      });
      expect(franceSelected.sideMaterial.visible).toBe(true);
      expect(franceSelected.sideMaterial.type).toBe("MeshPhongMaterial");
      expect(franceSelected.sideMaterial.userData.isGlitchShaderCap).toBe(true);
      expect(franceSelected.sideMaterial.uniforms.uIsSide).toBe(1);

      // Selected + Found country (Spain selected when already in foundSet)
      const { result: selectedFoundRes } = renderPolygons({
        globeTheme: "monochrome",
        selectedCountry: "Spain",
        foundSet: new Set(["Spain"]),
      });
      const spainSelectedFound = summarizeFeatureOutput(selectedFoundRes.current, FEATURE_SPAIN);
      expect(spainSelectedFound.color).toBe(FOUND_SURFACE_GREEN);
      expect(spainSelectedFound.stroke).not.toBe(spainFound.stroke);
      expect(spainSelectedFound.strokeWidth).toBe(14);
      expect(spainSelectedFound.altitude).toBe(POLYGON_ALTITUDE.selected);
      expect(spainSelectedFound.capMaterial.userData.isGlitchShaderCap).toBe(false);
      expect(spainSelectedFound.capMaterial.userData.isFoundCap).toBe(true);
      expect(spainSelectedFound.sideMaterial.visible).toBe(true);
      expect(spainSelectedFound.sideMaterial.userData.isGlitchShaderCap).toBe(false);
    });

    it("freezes error flash and success flash states on a selected country", () => {
      const { result: errorRes } = renderPolygons({
        globeTheme: "monochrome",
        selectedCountry: "France",
        isError: true,
      });
      const franceError = summarizeFeatureOutput(errorRes.current, FEATURE_FRANCE);
      expect(franceError.color).toBe(errorRes.current.UI_COLORS.error);
      expect(franceError.stroke).toBe(errorRes.current.UI_COLORS.error);
      expect(franceError.baseCapColor).toBe(
        errorRes.current.lerpColor(
          errorRes.current.UI_COLORS.error,
          errorRes.current.UI_COLORS.black,
          0.16
        )
      );
      expect(franceError.capMaterial.uniforms.uIsError).toBe(1);
      expect(franceError.capMaterial.uniforms.uIsSuccess).toBe(0);
      expect(franceError.sideMaterial.uniforms.uIsError).toBe(1);

      const { result: successRes } = renderPolygons({
        globeTheme: "monochrome",
        selectedCountry: "France",
        isSuccess: true,
        foundSet: new Set(["France"]),
      });
      const franceSuccessFound = summarizeFeatureOutput(successRes.current, FEATURE_FRANCE);
      expect(franceSuccessFound.color).toBe(FOUND_SURFACE_GREEN);
      expect(franceSuccessFound.stroke).toBe(GLITCH_EFFECT_SETTINGS.selectionHighlight);
      expect(franceSuccessFound.capMaterial.userData.isGlitchShaderCap).toBe(true);
      expect(franceSuccessFound.capMaterial.uniforms.uIsSuccess).toBe(1);
      expect(franceSuccessFound.capMaterial.uniforms.uIsFound).toBe(1);

      // CHARACTERIZATION: current behavior — when isSuccess=true BEFORE the country is added to
      // foundSet, resolveCountryCapColor ignores _isSuccess and returns UI_COLORS.mapBase.
      const { result: successUnfoundRes } = renderPolygons({
        globeTheme: "monochrome",
        selectedCountry: "France",
        isSuccess: true,
        foundSet: new Set(),
      });
      const franceSuccessUnfound = summarizeFeatureOutput(
        successUnfoundRes.current,
        FEATURE_FRANCE
      );
      expect(franceSuccessUnfound.color).toBe(successUnfoundRes.current.UI_COLORS.mapBase);
      expect(franceSuccessUnfound.stroke).toBe(GLITCH_EFFECT_SETTINGS.selectionHighlight);
      expect(franceSuccessUnfound.capMaterial.uniforms.uIsSuccess).toBe(1);
      expect(franceSuccessUnfound.capMaterial.uniforms.uIsFound).toBe(0);
    });
  });

  describe("Themes matrix (satellite, monochrome, blackout, monochrome@accent, default, light/dark, foundStyle)", () => {
    it("characterizes satellite theme visibility, opacity, altitude, and stroke rules", () => {
      const { result } = renderPolygons({
        globeTheme: "satellite",
        selectedCountry: "France",
        foundSet: new Set(["Spain"]),
      });

      const franceSelected = summarizeFeatureOutput(result.current, FEATURE_FRANCE);
      const spainFound = summarizeFeatureOutput(result.current, FEATURE_SPAIN);
      const japanNeutral = summarizeFeatureOutput(result.current, FEATURE_JAPAN);

      expect(japanNeutral.color).toBe(result.current.REGION_COLORS.Asia);
      expect(japanNeutral.stroke).toBe(result.current.UI_COLORS.mapBorder);
      expect(japanNeutral.strokeWidth).toBe(0.95);
      expect(japanNeutral.altitude).toBe(POLYGON_ALTITUDE.satelliteBase);
      expect(japanNeutral.capMaterial.visible).toBe(false);
      expect(japanNeutral.capMaterial.transparent).toBe(true);
      expect(japanNeutral.sideMaterial.visible).toBe(false);

      expect(spainFound.color).toBe(FOUND_SURFACE_GREEN);
      expect(spainFound.capMaterial.visible).toBe(true);
      expect(spainFound.capMaterial.transparent).toBe(true);
      expect(spainFound.capMaterial.opacity).toBe(0.5);
      expect(spainFound.capMaterial.wireframe).toBe(false);
      expect(spainFound.altitude).toBe(POLYGON_ALTITUDE.satelliteBase);

      expect(franceSelected.capMaterial.visible).toBe(true);
      expect(franceSelected.capMaterial.transparent).toBe(false);
      expect(franceSelected.capMaterial.opacity).toBe(1);
      expect(franceSelected.capMaterial.uniforms.uIsSatellite).toBe(1);
      expect(franceSelected.capMaterial.uniforms.uTheme).toBe(0);
      expect(franceSelected.altitude).toBe(POLYGON_ALTITUDE.selected);
    });

    it("characterizes foundStyle='mesh' wireframe mode across themes", () => {
      act(() => {
        setGlobePref("foundStyle", "mesh");
      });

      const { result } = renderPolygons({
        globeTheme: "satellite",
        selectedCountry: "France",
        foundSet: new Set(["France", "Spain"]),
      });

      const spainFoundMesh = summarizeFeatureOutput(result.current, FEATURE_SPAIN);
      const franceSelectedFound = summarizeFeatureOutput(result.current, FEATURE_FRANCE);

      expect(spainFoundMesh.capMaterial.wireframe).toBe(true);
      expect(spainFoundMesh.capMaterial.visible).toBe(true);
      expect(spainFoundMesh.capMaterial.transparent).toBe(false);
      expect(spainFoundMesh.capMaterial.opacity).toBe(1);
      expect(franceSelectedFound.capMaterial.wireframe).toBe(false);
    });

    it("characterizes blackout alias, monochrome@accent, default fallback, and light theme", () => {
      const { result: blackoutRes } = renderPolygons({ globeTheme: "blackout" });
      const { result: monoRes } = renderPolygons({ globeTheme: "monochrome" });
      expect(summarizeFeatureOutput(blackoutRes.current, FEATURE_FRANCE).color).toBe(
        summarizeFeatureOutput(monoRes.current, FEATURE_FRANCE).color
      );

      const { result: monoTealRes } = renderPolygons({ globeTheme: "monochrome@teal" });
      const franceMonoTeal = summarizeFeatureOutput(monoTealRes.current, FEATURE_FRANCE);
      const tealMonoPalette = buildMonochromePalette("teal");
      expect(franceMonoTeal.color).toBe(tealMonoPalette.land.Europe);
      expect(franceMonoTeal.stroke).toBe(
        monoTealRes.current.lerpColor(
          tealMonoPalette.border,
          monoTealRes.current.UI_COLORS.paper,
          0.28
        )
      );

      act(() => {
        setActiveAccent("magenta");
      });
      const { result: magentaRes } = renderPolygons({
        globeTheme: "monochrome",
        selectedCountry: "France",
      });
      expect(summarizeFeatureOutput(magentaRes.current, FEATURE_FRANCE).stroke).toBe(
        ACCENT_PRESETS.magenta.accent
      );

      // CHARACTERIZATION: current behavior — globeTheme="default" is not in GLOBE_THEMES, so
      // getGlobeThemeCfg("default") falls back to GLOBE_THEMES.satellite, while strict
      // `globeTheme === "satellite"` checks evaluate to false (cap remains visible & opaque).
      const { result: defaultThemeRes } = renderPolygons({ globeTheme: "default" });
      const franceDefaultTheme = summarizeFeatureOutput(defaultThemeRes.current, FEATURE_FRANCE);
      expect(franceDefaultTheme.color).toBe(getThemeRegionColor("satellite", "dark", "Europe"));
      expect(franceDefaultTheme.capMaterial.visible).toBe(true);
      expect(franceDefaultTheme.altitude).toBe(POLYGON_ALTITUDE.base);

      // CHARACTERIZATION: current behavior — THEME in designSystem.js only defines `dark`, so
      // theme="light" keeps dark base hex tokens in UI_COLORS while isLight=true changes lerp
      // weights, stroke widths, lighting shininess, and shader uIsLight=1.
      const { result: lightRes } = renderPolygons({
        theme: "light",
        isLight: true,
        globeTheme: "satellite",
        selectedCountry: "France",
        foundSet: new Set(["Spain"]),
      });
      const franceLight = summarizeFeatureOutput(lightRes.current, FEATURE_FRANCE);
      const spainLight = summarizeFeatureOutput(lightRes.current, FEATURE_SPAIN);
      expect(franceLight.capMaterial.uniforms.uIsLight).toBe(1);
      expect(franceLight.baseCapColor).toBe(
        lightRes.current.lerpColor(
          lightRes.current.UI_COLORS.mapBase,
          lightRes.current.UI_COLORS.black,
          0.32
        )
      );
      expect(spainLight.strokeWidth).toBe(1.1);
    });
  });

  describe("Modes matrix (capitals, rivers_mountains, departments, us_states, learn, home, end)", () => {
    it("characterizes capitals and rivers_mountains modes on world and relief features", () => {
      const { result: capitalsRes } = renderPolygons({
        mode: "capitals",
        selectedCountry: "France",
        foundSet: new Set(["Spain"]),
      });
      const { result: countriesRes } = renderPolygons({
        mode: "countries",
        selectedCountry: "France",
        foundSet: new Set(["Spain"]),
      });
      expect(summarizeFeatureOutput(capitalsRes.current, FEATURE_FRANCE)).toEqual(
        summarizeFeatureOutput(countriesRes.current, FEATURE_FRANCE)
      );

      const { result: riversRes } = renderPolygons({
        mode: "rivers_mountains",
        selectedCountry: "Amazon",
        foundSet: new Set(["Himalayas"]),
      });
      const franceInRivers = summarizeFeatureOutput(riversRes.current, FEATURE_FRANCE);
      const amazonFeature = summarizeFeatureOutput(riversRes.current, FEATURE_RIVER_AMAZON);
      expect(franceInRivers.color).toBe(riversRes.current.REGION_COLORS.Europe);
      // CHARACTERIZATION: current behavior — in non-regional mode, getBasePolygonColor reads
      // countryDataMap[admin]?.region || "Unknown" instead of gameDataMap[admin]?.region.
      expect(amazonFeature.color).toBe(riversRes.current.UI_COLORS.mapBase);
      expect(amazonFeature.altitude).toBe(POLYGON_ALTITUDE.selected);
      expect(amazonFeature.capMaterial.userData.isGlitchShaderCap).toBe(true);

      const somalilandOut = summarizeFeatureOutput(countriesRes.current, FEATURE_SOMALILAND);
      expect(somalilandOut.admin).toBe("Somalia");
      expect(somalilandOut.color).toBe(countriesRes.current.REGION_COLORS.Africa);
    });

    it("characterizes regional modes (departments and us_states) including ghost countries", () => {
      const { result: deptRes } = renderPolygons({
        mode: "departments",
        isDepartmentMode: true,
        globeTheme: "satellite",
        selectedCountry: "01",
        foundSet: new Set(),
      });

      const ainSelected = summarizeFeatureOutput(deptRes.current, FEATURE_DEPT_AIN);
      const spainGhost = summarizeFeatureOutput(deptRes.current, {
        ...FEATURE_SPAIN,
        isGhostCountry: true,
      });

      // CHARACTERIZATION: current behavior — in regional mode, an unfound selected feature
      // gets UI_COLORS.accent as getPolygonColor, whereas its glitch shader cap
      // uses restingColor derived from getRegionalLandColor(region) + monochrome shade!
      expect(ainSelected.color).toBe(deptRes.current.UI_COLORS.accent);
      expect(ainSelected.altitude).toBe(POLYGON_ALTITUDE.departmentSelected);
      expect(ainSelected.strokeWidth).toBe(7.5);
      expect(ainSelected.capMaterial.userData.isGlitchShaderCap).toBe(true);
      // CHARACTERIZATION: current behavior — getBaseColorForCountryAndKind looks up countryDataMap["01"]
      // which is undefined, so region is "Unknown" and uTargetColor is darkened mapBase.
      expect(ainSelected.baseCapColor).toBe(
        deptRes.current.lerpColor(
          deptRes.current.UI_COLORS.mapBase,
          deptRes.current.UI_COLORS.black,
          0.16
        )
      );

      expect(spainGhost.color).toBe(deptRes.current.UI_COLORS.bg);
      expect(spainGhost.sideColor).toBe(deptRes.current.UI_COLORS.mapSea);
      expect(spainGhost.altitude).toBe(POLYGON_ALTITUDE.ghostCountry);
      expect(spainGhost.strokeWidth).toBe(0.15);
      expect(spainGhost.capMaterial.visible).toBe(true);
      expect(spainGhost.capMaterial.transparent).toBe(true);
      expect(spainGhost.capMaterial.opacity).toBe(0.58);

      const { result: usRes } = renderPolygons({
        mode: "us_states",
        isUsStatesMode: true,
        globeTheme: "monochrome",
        selectedCountry: null,
        foundSet: new Set(["California"]),
      });
      const caFound = summarizeFeatureOutput(usRes.current, FEATURE_US_CALIFORNIA);
      expect(caFound.color).toBe(FOUND_SURFACE_GREEN);
      expect(caFound.altitude).toBe(POLYGON_ALTITUDE.departmentBase);
      expect(caFound.strokeWidth).toBe(1.1);
    });

    it("characterizes learn mode, home screen, and end screen (normal vs perfect score)", () => {
      const { result: learnRes } = renderPolygons({
        mode: "learn",
        globeTheme: "monochrome",
        selectedCountry: "France",
      });
      const franceLearn = summarizeFeatureOutput(learnRes.current, FEATURE_FRANCE);
      expect(franceLearn.color).toBe(FOUND_HIGHLIGHT);
      expect(franceLearn.strokeWidth).toBe(14);
      expect(franceLearn.capMaterial.userData.isGlitchShaderCap).toBe(false);
      expect(franceLearn.capMaterial.emissiveIntensity).toBe(1);

      const { result: homeRes } = renderPolygons({
        isHomeScreen: true,
        globeTheme: "monochrome",
        selectedCountry: "France",
      });
      expect(
        summarizeFeatureOutput(homeRes.current, FEATURE_FRANCE).capMaterial.userData
          .isGlitchShaderCap
      ).toBe(true);
      expect(summarizeFeatureOutput(homeRes.current, FEATURE_SPAIN).stroke).toBe(
        homeRes.current.UI_COLORS.mapBorder
      );

      const { result: endRes } = renderPolygons({
        isEndScreen: true,
        isPerfectScore: false,
        globeTheme: "monochrome",
        foundSet: new Set(["Spain"]),
      });
      const franceMissedEnd = summarizeFeatureOutput(endRes.current, FEATURE_FRANCE);
      const spainFoundEnd = summarizeFeatureOutput(endRes.current, FEATURE_SPAIN);
      // Audit lot 4: missed countries sit on a sober tinted surface, no TV-static shader.
      expect(franceMissedEnd.color).toBe(
        endRes.current.lerpColor(
          endRes.current.UI_COLORS.mapBase,
          endRes.current.UI_COLORS.error,
          0.2
        )
      );
      expect(franceMissedEnd.capMaterial.userData.isGlitchShaderCap).toBe(false);
      expect(spainFoundEnd.color).toBe(endRes.current.UI_COLORS.success);
      expect(spainFoundEnd.capMaterial.userData.isGlitchShaderCap).toBe(false);

      const { result: endPerfectRes } = renderPolygons({
        isEndScreen: true,
        isPerfectScore: true,
        globeTheme: "monochrome",
        foundSet: new Set(["Spain"]),
      });
      expect(summarizeFeatureOutput(endPerfectRes.current, FEATURE_SPAIN).color).toBe(
        endPerfectRes.current.UI_COLORS.gold
      );

      // CHARACTERIZATION: current behavior — on the end screen in satellite theme, missed countries
      // have isGlitchShaderCap=true (via isEndMissed) yet applySatelliteVisibility sets visible=false!
      const { result: endSatRes } = renderPolygons({
        isEndScreen: true,
        globeTheme: "satellite",
        foundSet: new Set(["Spain"]),
      });
      const franceMissedSatEnd = summarizeFeatureOutput(endSatRes.current, FEATURE_FRANCE);
      expect(franceMissedSatEnd.capMaterial.userData.isGlitchShaderCap).toBe(false);
      expect(franceMissedSatEnd.capMaterial.visible).toBe(false);

      // CHARACTERIZATION: current behavior — on the end screen in regional mode, found features
      // return FOUND_SURFACE_GREEN instead of UI_COLORS.gold or UI_COLORS.success.
      const { result: endDeptRes } = renderPolygons({
        mode: "departments",
        isDepartmentMode: true,
        isEndScreen: true,
        isPerfectScore: true,
        foundSet: new Set(["01"]),
      });
      const ainEndDept = summarizeFeatureOutput(endDeptRes.current, FEATURE_DEPT_AIN);
      expect(ainEndDept.color).toBe(FOUND_SURFACE_GREEN);
      expect(ainEndDept.stroke).toBe(endDeptRes.current.UI_COLORS.gold);
    });
  });
});
