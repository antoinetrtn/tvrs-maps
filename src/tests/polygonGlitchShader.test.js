import { describe, expect, it } from "vitest";

import {
  clearAnimatedPolygonMaterials,
  getAnimatedPolygonMaterialCount,
  getCapitalVector3,
  polygonGlitchUniforms,
  registerAnimatedPolygonMaterial,
  unregisterAnimatedPolygonMaterial,
} from "../globe/render/polygonGlitchShader";

describe("polygonGlitchShader shared uniforms", () => {
  it("exposes a single shared uTime uniform object", () => {
    expect(polygonGlitchUniforms.uTime).toBeDefined();
    polygonGlitchUniforms.uTime.value = 1.25;
    expect(polygonGlitchUniforms.uTime.value).toBe(1.25);
  });

  it("tracks animated materials for loop scheduling", () => {
    clearAnimatedPolygonMaterials();
    const mat = { userData: {} };
    registerAnimatedPolygonMaterial(mat);
    expect(getAnimatedPolygonMaterialCount()).toBe(1);
    unregisterAnimatedPolygonMaterial(mat);
    expect(getAnimatedPolygonMaterialCount()).toBe(0);
    clearAnimatedPolygonMaterials();
  });

  describe("getCapitalVector3", () => {
    it("returns a normalized Vector3 for a known country", () => {
      const vec = getCapitalVector3("FRA");
      expect(vec).toBeDefined();
      expect(vec.length()).toBeCloseTo(1, 4);
    });

    it("uses canonicalPositions override when passed", () => {
      const canonicals = {
        custom_place: { lat: 48.8566, lng: 2.3522 },
      };
      const vec = getCapitalVector3("custom_place", canonicals);
      expect(vec).toBeDefined();
      expect(vec.length()).toBeCloseTo(1, 4);
    });

    it("returns default vector for null admin", () => {
      const vec = getCapitalVector3(null);
      expect(vec.x).toBe(0);
      expect(vec.y).toBe(1);
      expect(vec.z).toBe(0);
    });
  });
});
