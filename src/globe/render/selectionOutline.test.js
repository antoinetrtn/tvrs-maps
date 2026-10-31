import { describe, expect, it } from "vitest";

import { EDGE_VALUE, HALO_VALUES, rasterizeOutline } from "./selectionOutline";

const N = 128;
const cellAt = (out, i, j) => out[(j * N + i) * 4];

describe("rasterizeOutline — contour pixel du pays sélectionné", () => {
  it("trace une bordure fine (255) puis un halo doux dégressif, sans remplir le centre", () => {
    const out = new Uint8Array(N * N * 4);
    const square = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [12, 0],
          [12, 12],
          [0, 12],
          [0, 0],
        ],
      ],
    };
    const box = rasterizeOutline(square, out);
    expect(box.cell).toBe(0.15);
    const i0 = Math.round((0.075 - box.ox) / box.cell - 0.5);
    const mid = i0 + 40;
    expect(cellAt(out, i0, mid)).toBe(EDGE_VALUE);
    HALO_VALUES.forEach((v, k) => expect(cellAt(out, i0 + 1 + k, mid)).toBe(v));
    expect(cellAt(out, i0 + 1 + HALO_VALUES.length, mid)).toBe(0);
    expect(cellAt(out, mid, mid)).toBe(0);
    expect(cellAt(out, i0 - 1, mid)).toBe(0);
  });

  it("garde un pays à cheval sur l'antiméridien d'un seul tenant", () => {
    const out = new Uint8Array(N * N * 4);
    const fiji = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [178, -18],
            [180, -18],
            [180, -16],
            [178, -16],
            [178, -18],
          ],
        ],
        [
          [
            [-180, -18],
            [-179, -18],
            [-179, -16],
            [-180, -16],
            [-180, -18],
          ],
        ],
      ],
    };
    const box = rasterizeOutline(fiji, out);
    expect(box.cell).toBeLessThanOrEqual(0.1);
    expect(out.some((v) => v === EDGE_VALUE)).toBe(true);
  });

  it("renvoie null sans géométrie", () => {
    expect(rasterizeOutline(null)).toBeNull();
  });
});
