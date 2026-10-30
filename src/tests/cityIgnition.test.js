import { describe, expect, it } from "vitest";

import { stampCityIgnition } from "../globe/render/applyPolygonFeedbackUniforms";
import { COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY } from "../globe/render/globeShaders";
import { polygonGlitchUniforms } from "../globe/render/polygonGlitchShader";
import { countryGrainOutputNode } from "../globe/render/webgpu/surfaceNodes";

describe("discovery city ignition", () => {
  it("aims the wave at the capital with a radius covering the urban network", () => {
    const r = stampCityIgnition("France", 10);
    expect(r).toBeTruthy();
    const o = polygonGlitchUniforms.uIgniteOrigin.value;
    expect(o.length()).toBeCloseTo(1, 5);
    // Paris ≈ 48.9°N → y = sin(lat)
    expect(o.y).toBeGreaterThan(0.7);
    expect(r.radius).toBeGreaterThan(0.05);
    expect(r.radius).toBeLessThanOrEqual(0.6);
    expect(polygonGlitchUniforms.uIgniteStart.value).toBeGreaterThan(10);
  });

  it("ignores unknown countries", () => {
    expect(stampCityIgnition("Atlantis", 1)).toBeNull();
  });

  it("gates city power by a per-pixel ignition front in GLSL", () => {
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("isAwakenedCap * igniteMask");
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("(1.0 - uReducedMotion)");
  });

  it("builds the WebGPU twin", () => {
    expect(countryGrainOutputNode(false)).toBeTruthy();
  });
});
