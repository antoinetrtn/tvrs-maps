import { describe, expect, it } from "vitest";

import { isDeselectResettableMaterial } from "../globe/render/globePolygonMaterial";

describe("isDeselectResettableMaterial", () => {
  it("only re-bases glitch-shader caps, never Learn highlights or found caps", () => {
    expect(isDeselectResettableMaterial({ userData: { isGlitchShaderCap: true } })).toBe(true);
    expect(isDeselectResettableMaterial({ userData: { isGlitchShaderCap: false } })).toBe(false);
    expect(isDeselectResettableMaterial({ userData: {} })).toBe(false);
    expect(
      isDeselectResettableMaterial({ userData: { isGlitchShaderCap: true, isFoundCap: true } })
    ).toBe(false);
    expect(isDeselectResettableMaterial(null)).toBe(false);
  });
});
