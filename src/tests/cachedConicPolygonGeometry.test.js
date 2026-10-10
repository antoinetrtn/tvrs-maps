import OriginalConicPolygonGeometry from "three-conic-polygon-geometry-original";
import { describe, expect, it } from "vitest";

import ConicPolygonGeometry from "../globe/render/cachedConicPolygonGeometry";

const square = [
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ],
];

describe("cachedConicPolygonGeometry", () => {
  it("produces the same buffers as the original geometry", () => {
    const original = new OriginalConicPolygonGeometry(square, 0, 100, false, true, true, 2);
    const cached = new ConicPolygonGeometry(square, 0, 100, false, true, true, 2);
    expect(cached.parameters).toEqual(original.parameters);
    expect(Array.from(cached.index.array)).toEqual(Array.from(original.index.array));
    Object.keys(original.attributes).forEach((name) => {
      expect(Array.from(cached.attributes[name].array)).toEqual(
        Array.from(original.attributes[name].array)
      );
    });
    expect(cached.groups).toEqual(original.groups);
  });

  it("reuses the triangulation for the same ring array and parameters", () => {
    const a = new ConicPolygonGeometry(square, 0, 100, false, true, true, 1);
    const b = new ConicPolygonGeometry(square, 0, 100, false, true, true, 1);
    const c = new ConicPolygonGeometry(square, 0, 100, false, true, true, 3);
    expect(b.attributes.position).not.toBe(a.attributes.position);
    expect(b.attributes.position.array).toBe(a.attributes.position.array);
    expect(c.attributes.position.array).not.toBe(a.attributes.position.array);
    expect(b.parameters.polygonGeoJson).toBe(square);
  });
});
