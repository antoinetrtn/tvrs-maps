import { describe, expect, it } from "vitest";

import { DESELECT_FADE_START } from "../config/gameConfig";
import { GLITCH_FRAGMENT_BODY, GLITCH_FRAGMENT_DECLARATIONS } from "../globe/render/globeShaders";
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
    expect(GLITCH_FRAGMENT_BODY).toMatch(/vec3 settleColor = mix\(unfoundRestColor/);
    expect(GLITCH_FRAGMENT_BODY).not.toMatch(/settleColor = mix\(litRestingColor/);
    expect(GLITCH_FRAGMENT_BODY).toMatch(/mix\(staticVec, unfoundRestColor, deselectDone\)/);
    expect(GLITCH_FRAGMENT_BODY).toMatch(/mix\(0\.36, 0\.74, uIsRegionalMode\)/);
  });

  it("WebGPU TSL mirrors the same settle colour", () => {
    expect(glitchNodeSrc).toMatch(/uShowcaseLights: mirrorUniform/);
    expect(glitchNodeSrc).toMatch(/uIsRegionalMode: mirrorUniform/);
    expect(glitchNodeSrc).toMatch(/const settleColor = mix\(\s*restColor/);
    expect(glitchNodeSrc).toMatch(/mix\(staticVec, restColor, deselectDone\)/);
    expect(glitchNodeSrc).toMatch(/mix\(float\(0\.36\), float\(0\.74\), regional\)/);
  });
});
