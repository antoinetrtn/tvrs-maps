import { afterEach, describe, expect, it } from "vitest";

import {
  clampGlobeAltitude,
  frameBoundsAltitude,
  GLOBE_MIN_ALTITUDE,
  REGIONAL_MIN_ALTITUDE,
  setGlobeMinAltitude,
} from "../globe/render/globeAltitude";

const FRANCE = { latMin: 41.3, latMax: 51.1, lngMin: -5.2, lngMax: 9.6 };
const US = { latMin: 24.5, latMax: 49.4, lngMin: -124.8, lngMax: -66.9 };

describe("frameBoundsAltitude", () => {
  afterEach(() => setGlobeMinAltitude(GLOBE_MIN_ALTITUDE));

  it("needs more altitude on a portrait phone than on a desktop", () => {
    setGlobeMinAltitude(REGIONAL_MIN_ALTITUDE);
    const desktop = frameBoundsAltitude(FRANCE, 1440 / 900);
    const phone = frameBoundsAltitude(FRANCE, 390 / 844, 0.8);
    expect(phone).toBeGreaterThan(desktop);
    expect(phone).toBeGreaterThan(0.35);
    expect(phone).toBeLessThan(0.7);
  });

  it("frames the US wider than France", () => {
    expect(frameBoundsAltitude(US, 1.6)).toBeGreaterThan(frameBoundsAltitude(FRANCE, 1.6));
  });

  it("honours the regional zoom floor", () => {
    expect(clampGlobeAltitude(0.1)).toBe(GLOBE_MIN_ALTITUDE);
    setGlobeMinAltitude(REGIONAL_MIN_ALTITUDE);
    expect(clampGlobeAltitude(0.1)).toBe(0.1);
    expect(clampGlobeAltitude(0.01)).toBe(REGIONAL_MIN_ALTITUDE);
  });
});
