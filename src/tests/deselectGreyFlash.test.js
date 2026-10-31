import { describe, expect, it } from "vitest";

import { DESELECT_FADE_START } from "../config/gameConfig";
import { WORLD_PALETTE } from "../config/worldPaletteTokens";
import { GLITCH_FRAGMENT_BODY, GLITCH_FRAGMENT_DECLARATIONS } from "../globe/render/globeShaders";
import {
  REGIONAL_HOME_RESTING_LAND,
  resolveRestingColorForFeature,
} from "../globe/render/polygonColorResolver";
import glitchNodeSrc from "../globe/render/webgpu/glitchNode.js?raw";

// Regression: deselecting an unfound country (France → Belgium) flashed the raw lit grey
// (cold, undimmed) during the fade, then the selection umber for one frame, before the
// resting blackout look. The fade must settle to the blackout formula on both renderers.
describe("deselect fade settles to the unfound blackout look", () => {
  it("starts above the shader transition threshold", () => {
    expect(DESELECT_FADE_START).toBeGreaterThan(0.006);
    expect(DESELECT_FADE_START).toBeLessThan(0.05);
  });

  it("GLSL: settle colour is the blackout rest colour, not the raw lit grey", () => {
    expect(GLITCH_FRAGMENT_DECLARATIONS).toMatch(/uniform float uShowcaseLights;/);
    expect(GLITCH_FRAGMENT_DECLARATIONS).toMatch(/uniform float uIsRegionalMode;/);
    expect(GLITCH_FRAGMENT_DECLARATIONS).toMatch(/uniform sampler2D uBiomeMap;/);
    expect(GLITCH_FRAGMENT_BODY).toMatch(/vec3 settleColor = mix\(unfoundRestColor/);
    expect(GLITCH_FRAGMENT_BODY).not.toMatch(/settleColor = mix\(litRestingColor/);
    expect(GLITCH_FRAGMENT_BODY).toMatch(/mix\(staticVec, unfoundRestColor, deselectDone\)/);
    expect(GLITCH_FRAGMENT_BODY).toMatch(/mix\(0\.36, 0\.74, uIsRegionalMode\)/);
    expect(GLITCH_FRAGMENT_BODY).toMatch(/uBiomeMap/);
    // Outline and halo dissolve progressively without abruptly vanishing on frame 1 of deselect
    expect(GLITCH_FRAGMENT_BODY).not.toMatch(/edgeOn = .*\(1\.0 - transitionActive\)/);
    expect(GLITCH_FRAGMENT_BODY).toMatch(
      /step\(0\.01, cityOn \+ wallOn \+ edgeOuter \+ edgeHalo\)/
    );
  });

  it("WebGPU TSL mirrors the same settle colour", () => {
    expect(glitchNodeSrc).toMatch(/uShowcaseLights: mirrorUniform/);
    expect(glitchNodeSrc).toMatch(/uIsRegionalMode: mirrorUniform/);
    expect(glitchNodeSrc).toMatch(/getBiomeTexture/);
    expect(glitchNodeSrc).toMatch(/const settleColor = mix\(\s*restColor/);
    expect(glitchNodeSrc).toMatch(/mix\(staticVec, restColor, deselectDone\)/);
    expect(glitchNodeSrc).toMatch(/mix\(float\(0\.36\), float\(0\.74\), regional\)/);
    expect(glitchNodeSrc).toMatch(/biomeLand/);
    // Parity: no abrupt cut of outline on transition start, halo included in pixelOn
    expect(glitchNodeSrc).not.toMatch(/edgeOn = .*sub\(transitionActive\)/);
    expect(glitchNodeSrc).toMatch(
      /pixelOn: step\(0\.01, cityOn\.add\(wallOn\)\.add\(edgeOuter\)\.add\(edgeHalo\)\)/
    );
  });

  it("resolveRestingColorForFeature targets the regional resting land color on home, not grey", () => {
    const UI_COLORS = { mapBase: "map-base", black: "black" };
    const getRegionalLandColor = (region) => (region === "Europe" ? "europe-land" : "other-land");
    const countryDataMap = { France: { region: "Europe" } };

    // In-game: unfound country resting color resolves to mapBase (blackout look)
    const inGameResting = resolveRestingColorForFeature({
      kind: "cap",
      admin: "France",
      isFound: false,
      isHomeScreen: false,
      UI_COLORS,
      countryDataMap,
      getRegionalLandColor,
    });
    expect(inGameResting).toBe(UI_COLORS.mapBase);

    // Home screen: unfound country resting color resolves directly to regional resting land
    const homeResting = resolveRestingColorForFeature({
      kind: "cap",
      admin: "France",
      isFound: false,
      isHomeScreen: true,
      UI_COLORS,
      countryDataMap,
      getRegionalLandColor,
    });
    expect(homeResting).toBe("europe-land");

    // Home screen in regional mode (e.g. départements): returns the green resting land color
    const homeDeptResting = resolveRestingColorForFeature({
      kind: "cap",
      admin: "75",
      isFound: false,
      isHomeScreen: true,
      isRegionalMode: true,
      UI_COLORS,
      countryDataMap: {},
      getRegionalLandColor,
    });
    expect(homeDeptResting).toBe(REGIONAL_HOME_RESTING_LAND);
    expect(homeDeptResting).toBe(WORLD_PALETTE.temperate[1]);
  });
});
