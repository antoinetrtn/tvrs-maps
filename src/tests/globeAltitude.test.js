import { describe, expect, it } from "vitest";

import { clampGlobeAltitude, GLOBE_MAX_ALTITUDE, GLOBE_MIN_ALTITUDE } from "../utils/globeAltitude";

describe("globeAltitude", () => {
  it("clamps below the zoom floor", () => {
    expect(clampGlobeAltitude(0)).toBe(GLOBE_MIN_ALTITUDE);
    expect(clampGlobeAltitude(0.1)).toBe(GLOBE_MIN_ALTITUDE);
    expect(clampGlobeAltitude(-0.5)).toBe(GLOBE_MIN_ALTITUDE);
  });

  it("allows increased max zoom (lower min alt) for small features without traversing", () => {
    // 0.22 is the new floor — must stay >= surface (1 + alt) * radius
    expect(GLOBE_MIN_ALTITUDE).toBeLessThan(0.26);
    expect(GLOBE_MIN_ALTITUDE).toBeGreaterThanOrEqual(0.18);
  });

  it("clamps above the overview ceiling", () => {
    expect(clampGlobeAltitude(10)).toBe(GLOBE_MAX_ALTITUDE);
  });

  it("preserves valid in-range altitude", () => {
    expect(clampGlobeAltitude(0.68)).toBe(0.68);
  });
});
