import { describe, expect, it } from "vitest";

import { beaconColor, clusterScreenPoints } from "../globe/render/life/microBeacons";

describe("micro beacons", () => {
  it("clusters points closer than the radius, skips hidden ones", () => {
    const leader = clusterScreenPoints([{ x: 0, y: 0 }, { x: 5, y: 5 }, null, { x: 100, y: 0 }]);
    expect([...leader]).toEqual([0, 0, -1, 3]);
  });
  it("found beacons are brighter and more golden than unfound ones", () => {
    const off = beaconColor(0, 0);
    const on = beaconColor(1, 0);
    expect(on[1]).toBeGreaterThan(off[1]);
    expect(on[2] / on[0]).toBeGreaterThan(off[2] / off[0]);
  });
});
