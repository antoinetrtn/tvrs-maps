import { describe, expect, it } from "vitest";

import {
  buildRibbonGeometry,
  createCountryHighlight,
  featurePolygons,
  llToXyz,
  polygonsAnchor,
  ringSignedArea,
  ringToDirections,
} from "../globe/render/countryHighlight";

// A 10°×10° box around (0°, 0°), counter-clockwise, closed.
const SQUARE = [
  [
    [-5, -5],
    [5, -5],
    [5, 5],
    [-5, 5],
    [-5, -5],
  ],
];
const radial = (positions, i) => Math.hypot(positions[i], positions[i + 1], positions[i + 2]);

describe("country highlight geometry", () => {
  it("reads polygons from a feature (render geometry first)", () => {
    expect(featurePolygons(null)).toEqual([]);
    const poly = { type: "Polygon", coordinates: SQUARE };
    expect(featurePolygons({ geometry: poly })).toEqual([SQUARE]);
    expect(
      featurePolygons({ geometry: { type: "MultiPolygon", coordinates: [SQUARE, SQUARE] } })
    ).toHaveLength(2);
    expect(
      featurePolygons({
        geometry: poly,
        renderGeometry: { type: "MultiPolygon", coordinates: [SQUARE] },
      })
    ).toHaveLength(1);
  });

  it("tells the winding of a ring, also across the antimeridian", () => {
    expect(ringSignedArea(SQUARE[0])).toBeGreaterThan(0);
    expect(ringSignedArea([...SQUARE[0]].reverse())).toBeLessThan(0);
    const across = [
      [175, -5],
      [-175, -5],
      [-175, 5],
      [175, 5],
      [175, -5],
    ];
    expect(ringSignedArea(across)).toBeGreaterThan(0);
  });

  it("subdivides long edges so the outline follows the sphere", () => {
    const dirs = ringToDirections(SQUARE[0]);
    expect(dirs.length).toBeGreaterThan(4);
    for (const d of dirs) expect(Math.hypot(...d)).toBeCloseTo(1, 6);
  });

  it("builds an outline ribbon at the requested altitude, two vertices per point", () => {
    const geo = buildRibbonGeometry([SQUARE], { alt: 0.01, half: 0.2 });
    const pos = geo.attributes.position.array;
    expect(pos.length / 3).toBe(ringToDirections(SQUARE[0]).length * 2);
    for (let i = 0; i < pos.length; i += 3) expect(radial(pos, i)).toBeCloseTo(101, 0);
    expect(geo.index.count).toBe((pos.length / 3 / 2) * 6);
    expect(pos.every(Number.isFinite)).toBe(true);
  });

  it("insets the ribbon toward the inside of the country (double outline)", () => {
    const centre = llToXyz(0, 0, 100);
    const meanDist = (inset) => {
      const pos = buildRibbonGeometry([SQUARE], { alt: 0.01, half: 0.01, inset }).attributes
        .position.array;
      let sum = 0;
      for (let i = 0; i < pos.length; i += 3)
        sum += Math.hypot(pos[i] - centre[0], pos[i + 1] - centre[1], pos[i + 2] - centre[2]);
      return sum / (pos.length / 3);
    };
    expect(meanDist(1)).toBeLessThan(meanDist(0) - 0.5);
    // A clockwise outer ring is inset the same way (winding does not matter)
    const cw = [[...SQUARE[0]].reverse()];
    const cwPos = buildRibbonGeometry([cw], { alt: 0.01, half: 0.01, inset: 1 }).attributes.position
      .array;
    let sum = 0;
    for (let i = 0; i < cwPos.length; i += 3)
      sum += Math.hypot(cwPos[i] - centre[0], cwPos[i + 1] - centre[1], cwPos[i + 2] - centre[2]);
    expect(sum / (cwPos.length / 3)).toBeLessThan(meanDist(0) - 0.5);
  });

  it("anchors the link inside the largest polygon, even for a concave shape", () => {
    // U shape: the bbox centre (0, 0) is in the notch, outside the country.
    const U = [
      [
        [-10, -10],
        [10, -10],
        [10, 10],
        [4, 10],
        [4, -4],
        [-4, -4],
        [-4, 10],
        [-10, 10],
        [-10, -10],
      ],
    ];
    const small = [
      [
        [50, 50],
        [51, 50],
        [51, 51],
        [50, 51],
        [50, 50],
      ],
    ];
    const a = polygonsAnchor([small, U]);
    expect(Math.abs(a.lng)).toBeGreaterThan(3.9);
    expect(a.lat).toBeLessThan(10.001);
    expect(polygonsAnchor([])).toBeNull();
  });

  it("creates fill + outline meshes, flat when alone and dithered when shared", () => {
    const solo = createCountryHighlight([SQUARE], { color: "orange", alt: 0.003 });
    expect(solo.group.children).toHaveLength(2);
    expect(solo.group.children[0].material.alphaMap).toBeNull();
    solo.setPixelUnit(0.5);
    solo.setOpacity(0.5);
    expect(solo.group.children[1].material.opacity).toBeCloseTo(0.5);
    solo.dispose();

    const a = createCountryHighlight([SQUARE], { color: "orange", alt: 0.003, slot: 0, count: 2 });
    const b = createCountryHighlight([SQUARE], { color: "teal", alt: 0.003, slot: 1, count: 2 });
    expect(a.group.children[0].material.alphaMap).toBeTruthy();
    // Complementary phases: the two players never hide each other.
    expect(Array.from(a.group.children[0].material.alphaMap.image.data)).not.toEqual(
      Array.from(b.group.children[0].material.alphaMap.image.data)
    );
    a.dispose();
    b.dispose();
  });
});
