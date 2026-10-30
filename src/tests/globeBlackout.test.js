import { describe, expect, it } from "vitest";

import { COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY } from "../globe/render/globeShaders";
import { countryGrainOutputNode } from "../globe/render/webgpu/surfaceNodes";

describe("globe blackout (Terre sans électricité)", () => {
  it("desaturates unfound land from the base colour instead of a hard-coded terrain hue", () => {
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("float blackoutAmt");
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("vec3 blackoutGrey = vec3(surfaceLuma)");
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toMatch(
      /blackoutAmt = \(1\.0 - uShowcaseLights\)[^;]*\(1\.0 - uIsRegionalMode\)/
    );
  });

  it("turns the rivers of blacked-out land neutral grey", () => {
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain("vec3 darkRiverTone");
  });

  it("builds the WebGPU twin node without throwing", () => {
    expect(countryGrainOutputNode(false)).toBeTruthy();
    expect(countryGrainOutputNode(true)).toBeTruthy();
  });
});
