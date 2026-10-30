import { describe, expect, it } from "vitest";

import { applyCountrySurfaceGrainShader } from "../globe/render/globePolygonMaterial";
import { COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY } from "../globe/render/globeShaders";
import { polygonGlitchUniforms } from "../globe/render/polygonGlitchShader";
import { homeShowcase } from "../globe/render/webgpu/igniteNodes";
import { countryGrainOutputNode } from "../globe/render/webgpu/surfaceNodes";

describe("Homepage ignition sweep", () => {
  it("gates showcase lights and blackout by the sweep in GLSL", () => {
    const body = COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY;
    expect(body).toContain("float homeCycle = fract(uTime / 18.0");
    expect(body).toContain("homeIgnite = max(homeIgnite, max(uReducedMotion, uIsRegionalMode));");
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
    expect(shader.fragmentShader).toContain("homeIgnite");
  });

  it("builds the TSL twin", () => {
    expect(typeof homeShowcase).toBe("function");
    expect(countryGrainOutputNode().isNode).toBe(true);
  });
});
