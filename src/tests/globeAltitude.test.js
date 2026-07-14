import { describe, expect, it } from "vitest";
import {
  clampGlobeAltitude,
  GLOBE_MAX_ALTITUDE,
  GLOBE_MIN_ALTITUDE,
} from "../utils/globeAltitude";

describe("globeAltitude", () => {
  it("clamps below the zoom floor", () => {
    expect(clampGlobeAltitude(0)).toBe(GLOBE_MIN_ALTITUDE);
    expect(clampGlobeAltitude(0.1)).toBe(GLOBE_MIN_ALTITUDE);
    expect(clampGlobeAltitude(-0.5)).toBe(GLOBE_MIN_ALTITUDE);
  });

  it("clamps above the overview ceiling", () => {
    expect(clampGlobeAltitude(10)).toBe(GLOBE_MAX_ALTITUDE);
  });

  it("preserves valid in-range altitude", () => {
    expect(clampGlobeAltitude(0.68)).toBe(0.68);
  });
});