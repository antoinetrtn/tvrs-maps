import { describe, expect, it } from "vitest";

import {
  clearAnimatedPolygonMaterials,
  getAnimatedPolygonMaterialCount,
  polygonGlitchUniforms,
  registerAnimatedPolygonMaterial,
  unregisterAnimatedPolygonMaterial,
} from "../utils/polygonGlitchShader";

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
});
