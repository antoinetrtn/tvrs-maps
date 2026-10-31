import { describe, expect, it } from "vitest";

import {
  cullPolygonsBeyondHorizon,
  featureCap,
  isCapVisible,
} from "../globe/render/horizonCulling";

const square = (lng, lat, half = 2) => ({
  renderGeometry: {
    type: "Polygon",
    coordinates: [
      [
        [lng - half, lat - half],
        [lng + half, lat - half],
        [lng + half, lat + half],
        [lng - half, lat + half],
        [lng - half, lat - half],
      ],
    ],
  },
});

// three-globe convention: lng 0 / lat 0 faces +Z.
const camAbove = (lng, lat, dist = 250) => {
  const phi = (lat * Math.PI) / 180;
  const th = (lng * Math.PI) / 180;
  return {
    x: dist * Math.cos(phi) * Math.sin(th),
    y: dist * Math.sin(phi),
    z: dist * Math.cos(phi) * Math.cos(th),
  };
};

describe("horizon culling", () => {
  it("computes a cap centred on the feature", () => {
    const cap = featureCap(square(0, 0));
    expect(cap.z).toBeCloseTo(1, 2);
    expect(cap.radius).toBeGreaterThan(0.03);
    expect(cap.radius).toBeLessThan(0.06);
  });

  it("keeps the facing side and hides the antipode", () => {
    const cam = camAbove(2.3, 46.5);
    expect(isCapVisible(featureCap(square(2, 46)), cam, 100)).toBe(true);
    expect(isCapVisible(featureCap(square(-178, -46)), cam, 100)).toBe(false);
  });

  it("keeps a huge country visible when part of it is over the horizon", () => {
    const russia = square(100, 60, 40);
    expect(isCapVisible(featureCap(russia), camAbove(0, 20), 100)).toBe(true);
  });

  it("the horizon gets closer when the camera zooms in", () => {
    const f = featureCap(square(60, 0));
    expect(isCapVisible(f, camAbove(0, 0, 400), 100)).toBe(true);
    expect(isCapVisible(f, camAbove(0, 0, 110), 100)).toBe(false);
  });

  it("toggles polygon objects only", () => {
    const front = { __globeObjType: "polygon", __data: square(0, 0), visible: true, children: [] };
    const back = { __globeObjType: "polygon", __data: square(180, 0), visible: true, children: [] };
    const other = { __globeObjType: "point", visible: true, children: [] };
    const scene = { children: [{ children: [front, back, other] }] };
    const hidden = cullPolygonsBeyondHorizon(scene, { position: camAbove(0, 0) }, 100);
    expect(hidden).toBe(1);
    expect(front.visible).toBe(true);
    expect(back.visible).toBe(false);
    expect(other.visible).toBe(true);
  });
});

describe("three-globe polygon datum", () => {
  it("reads the per-part rings (coords)", () => {
    const cap = featureCap({ coords: square(0, 0).renderGeometry.coordinates });
    expect(cap.z).toBeCloseTo(1, 2);
  });
});
