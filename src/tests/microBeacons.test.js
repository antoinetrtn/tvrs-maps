import { describe, expect, it } from "vitest";

import { beaconColor, beaconPop, clusterScreenPoints } from "../globe/render/life/microBeacons";

describe("micro beacons", () => {
  it("clusters points closer than the radius, skips hidden ones", () => {
    const leader = clusterScreenPoints([{ x: 0, y: 0 }, { x: 5, y: 5 }, null, { x: 100, y: 0 }]);
    expect([...leader]).toEqual([0, 0, -1, 3]);
  });
  it("found beacons are brighter and warmer than unfound ones", () => {
    const off = beaconColor(0, 0);
    const on = beaconColor(1, 0);
    expect(on[1]).toBeGreaterThan(off[1]);
    expect(on[0] / on[2]).toBeGreaterThan(off[0] / off[2]); // warmer
  });
  it("unfound beacons are a dim neutral (blue-leaning), not amber", () => {
    for (const t of [0, 1.3, 2.5]) {
      const [r, g, b] = beaconColor(0, t);
      expect(b).toBeGreaterThan(r);
      expect(Math.max(r, g, b)).toBeLessThan(0.25);
    }
  });
  it("discovery pop steps 12 px then settles", () => {
    expect(beaconPop(0.1).scale).toBe(1.2);
    expect(beaconPop(0.4).scale).toBe(1);
    expect(beaconPop(1)).toEqual({ scale: 1, gain: 1 });
    expect(beaconPop(-1)).toEqual({ scale: 1, gain: 1 });
  });
});
