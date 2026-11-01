import { describe, expect, it } from "vitest";

import { COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY } from "./globeShaders";
import {
  PAINTED_FRANCE_BOUNDS,
  PAINTED_GLSL_BODY,
  PAINTED_RECT,
  paintedTerrainUniforms,
} from "./paintedTerrain";

describe("painted France terrain", () => {
  it("keeps the injection anchor present in the surface shader", () => {
    expect(COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY).toContain(
      "      // Found land (solo tone or Conquête"
    );
  });

  it("maps the France bounds onto the shader cartUv rectangle", () => {
    const b = PAINTED_FRANCE_BOUNDS;
    const toUv = (lng, lat) => [
      (lng / 360 + 0.5 - PAINTED_RECT.x) / PAINTED_RECT.z,
      (lat / 180 + 0.5 - PAINTED_RECT.y) / PAINTED_RECT.w,
    ];
    expect(toUv(b.lngMin, b.latMin)[0]).toBeCloseTo(0);
    expect(toUv(b.lngMax, b.latMax)[1]).toBeCloseTo(1);
    const [u, v] = toUv(2.35, 48.86); // Paris
    expect(u).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it("is off until the lazy texture is decoded and outside regional mode", () => {
    expect(paintedTerrainUniforms.uPaintedReady.value).toBe(0);
    expect(PAINTED_GLSL_BODY).toContain("uPaintedReady * uIsRegionalMode * (1.0 - uIsGhost)");
  });
});
