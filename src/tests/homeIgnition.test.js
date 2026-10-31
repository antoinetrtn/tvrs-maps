import { describe, expect, it } from "vitest";

import { HOME_WAKE_SECONDS, stepHomeWake } from "../globe/hooks/useGlobeShaderClock";
import { applyCountrySurfaceGrainShader } from "../globe/render/globePolygonMaterial";
import { COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY } from "../globe/render/globeShaders";
import { polygonGlitchUniforms } from "../globe/render/polygonGlitchShader";
import { homeShowcase } from "../globe/render/webgpu/igniteNodes";
import { countryGrainOutputNode } from "../globe/render/webgpu/surfaceNodes";

describe("Homepage wake-up", () => {
  it("gates showcase lights and blackout by the sweep in GLSL", () => {
    const body = COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY;
    expect(body).not.toContain("homeCycle");
    // Whole-world pixel ignition, no coarse tiles.
    expect(body).not.toContain("homeBlockHash");
    expect(body).toContain("igniteFlash = max(igniteFlash, homeFlash);");
    // One radial wave from Paris, not per-pixel random noise.
    expect(body).toContain("float homeLandAt = homeDist / 3.6;");
    expect(body).toContain("float homeIgnite = max(step(homeWakeAt, uHomeWake), homeOn);");
    expect(body).toContain("float homeOn = max(uReducedMotion, uIsRegionalMode);");
    expect(body).toContain("showcaseNow * isUnfoundDarkCap");
    expect(body).toContain("float blackoutAmt = (1.0 - showcaseLand)");
    expect(body).not.toContain("(1.0 - uShowcaseLights)");
  });

  it("wires uReducedMotion into the surface shader", () => {
    const shader = {
      uniforms: {},
      vertexShader: "#include <begin_vertex>",
      fragmentShader: "#include <dithering_fragment>",
    };
    applyCountrySurfaceGrainShader(shader);
    expect(shader.uniforms.uReducedMotion).toBe(polygonGlitchUniforms.uReducedMotion);
    expect(shader.uniforms.uHomeWake).toBe(polygonGlitchUniforms.uHomeWake);
    expect(shader.fragmentShader).toContain("homeIgnite");
  });

  it("builds the TSL twin", () => {
    expect(typeof homeShowcase).toBe("function");
    expect(countryGrainOutputNode().isNode).toBe(true);
  });

  it("wakes up once from blackout and stays awake", () => {
    expect(stepHomeWake(0, HOME_WAKE_SECONDS / 2, false)).toBeCloseTo(0.5);
    expect(stepHomeWake(0.9, HOME_WAKE_SECONDS, false)).toBe(1);
    expect(stepHomeWake(1, 0.1, false)).toBe(1);
    expect(stepHomeWake(0, 0.016, true)).toBe(1);
  });
});
