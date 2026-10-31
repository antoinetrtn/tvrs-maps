import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getThemeRegionColorAttenuated, GLITCH_EFFECT_SETTINGS } from "../config/designSystem";
import { POLYGON_ALTITUDE } from "../config/gameConfig";
import { GLOBE_PALETTE } from "../config/globePalette";
import {
  FOUND_HIGHLIGHT,
  FOUND_SURFACE_GREEN,
  GHOST_DIM_AMOUNT,
} from "../globe/render/polygonColorResolver";
import {
  FEATURE_BRAZIL,
  FEATURE_DEPT_AIN,
  FEATURE_FRANCE,
  FEATURE_RIVER_AMAZON,
  FEATURE_SOMALILAND,
  FEATURE_SPAIN,
  FEATURE_US_CALIFORNIA,
  renderPolygons,
  resetGlobePolygonTestGlobals,
  summarizeFeatureOutput,
} from "./globePolygons/testHelpers";

describe("useGlobePolygons characterization — modes, theme, and states", () => {
  beforeEach(() => {
    resetGlobePolygonTestGlobals();
  });

  afterEach(() => {
    resetGlobePolygonTestGlobals();
  });

  describe("Core state invariants (world countries mode)", () => {
    it("freezes neutral, selected, found, and selected+found outputs in monochrome dark theme", () => {
      const { result: neutralRes } = renderPolygons({
        selectedCountry: null,
        foundSet: new Set(["Spain"]),
      });

      const franceNeutral = summarizeFeatureOutput(neutralRes.current, FEATURE_FRANCE);
      const spainFound = summarizeFeatureOutput(neutralRes.current, FEATURE_SPAIN);
      const brazilNeutral = summarizeFeatureOutput(neutralRes.current, FEATURE_BRAZIL);

      // Neutral country uses regional surface color and shared non-shader material; side is invisible
      expect(franceNeutral.color).toBe(neutralRes.current.REGION_COLORS.Europe);
      expect(brazilNeutral.color).toBe(neutralRes.current.REGION_COLORS.Americas);
      expect(franceNeutral.color).toBe(GLOBE_PALETTE.land.Europe);
      expect(brazilNeutral.color).toBe(GLOBE_PALETTE.land.Americas);
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
        uIsSide: 0,
        uIsFound: 0,
        uSelectInTransition: 0,
      });
      expect(franceSelected.sideMaterial.visible).toBe(true);
      expect(franceSelected.sideMaterial.type).toBe("MeshPhongMaterial");
      expect(franceSelected.sideMaterial.userData.isGlitchShaderCap).toBe(true);
      expect(franceSelected.sideMaterial.uniforms.uIsSide).toBe(1);

      // Selected + Found country (Spain selected when already in foundSet)
      const { result: selectedFoundRes } = renderPolygons({
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

      expect(spainGhost.color).toBe(
        deptRes.current.lerpColor(
          getThemeRegionColorAttenuated("Europe"),
          deptRes.current.UI_COLORS.mapSea,
          GHOST_DIM_AMOUNT
        )
      );
      expect(spainGhost.sideColor).toBe(deptRes.current.UI_COLORS.mapSea);
      expect(spainGhost.altitude).toBe(POLYGON_ALTITUDE.ghostCountry);
      expect(spainGhost.strokeWidth).toBe(0.15);
      expect(spainGhost.capMaterial.visible).toBe(true);
      expect(spainGhost.capMaterial.transparent).toBe(false);
      expect(spainGhost.capMaterial.opacity).toBe(1);

      const { result: usRes } = renderPolygons({
        mode: "us_states",
        isUsStatesMode: true,
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
        selectedCountry: "France",
      });
      const franceLearn = summarizeFeatureOutput(learnRes.current, FEATURE_FRANCE);
      expect(franceLearn.color).toBe(FOUND_HIGHLIGHT);
      expect(franceLearn.strokeWidth).toBe(14);
      expect(franceLearn.capMaterial.userData.isGlitchShaderCap).toBe(false);
      expect(franceLearn.capMaterial.emissiveIntensity).toBe(1);

      const { result: homeRes } = renderPolygons({
        isHomeScreen: true,
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
        foundSet: new Set(["Spain"]),
      });
      expect(summarizeFeatureOutput(endPerfectRes.current, FEATURE_SPAIN).color).toBe(
        endPerfectRes.current.UI_COLORS.gold
      );

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
