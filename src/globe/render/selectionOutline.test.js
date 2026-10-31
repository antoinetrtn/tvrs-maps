import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { EDGE_VALUE, HALO_VALUES, OUTLINE_TEX_SIZE, rasterizeOutline } from "./selectionOutline";

const N = OUTLINE_TEX_SIZE;
const cellAt = (out, i, j) => out[j * N + i];

describe("rasterizeOutline — contour pixel du pays sélectionné", () => {
  it("trace une bordure fine (255) puis un halo doux dégressif, sans remplir le centre", () => {
    const out = new Uint8Array(N * N);
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
    expect(box.cell).toBeLessThanOrEqual(0.1);
    const i0 = Math.round((0.001 - box.ox) / box.cellX - 0.5);
    const mid = Math.round((6.0 - box.ox) / box.cellX - 0.5);
    expect(cellAt(out, i0, mid)).toBe(EDGE_VALUE);
    HALO_VALUES.forEach((v, k) => expect(cellAt(out, i0 + 1 + k, mid)).toBe(v));
    expect(cellAt(out, i0 + 1 + HALO_VALUES.length, mid)).toBe(0);
    expect(cellAt(out, mid, mid)).toBe(0);
    expect(cellAt(out, i0 - 1, mid)).toBe(0);
  });

  it("garde un pays à cheval sur l'antiméridien d'un seul tenant", () => {
    const out = new Uint8Array(N * N);
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

  // Régression de la PR 263 : la bbox de la France (Guyane, Réunion…) grossissait la grille à
  // 1,5° et la métropole se remplissait de gros blocs ambre au lieu d'un contour fin.
  const world = JSON.parse(readFileSync("public/data/countries-50m-low.json", "utf8"));
  const geo = (admin) => world.features.find((f) => f.properties.ADMIN === admin).geometry;

  it.each([
    ["France", 0.15],
    ["Norway", 0.1],
    ["Indonesia", 0.1],
    ["United States of America", 0.15],
    ["Russia", 0.4],
  ])("garde une grille fine pour %s (territoires lointains compris)", (admin, maxCell) => {
    const out = new Uint8Array(N * N);
    const box = rasterizeOutline(geo(admin), out);
    expect(box.cell).toBeLessThanOrEqual(maxCell);
    let edge = 0,
      halo = 0;
    for (const v of out) {
      if (v === EDGE_VALUE) edge++;
      else if (v) halo++;
    }
    expect(edge).toBeGreaterThan(200);
    // Bordure + 3 anneaux de halo : jamais plus de ~4x la bordure (pas de pays rempli).
    expect(halo).toBeLessThan(edge * HALO_VALUES.length * 1.2);
  });

  it("allume au moins un pixel pour les micro-États (Monaco, Vatican)", () => {
    for (const admin of ["Monaco", "Vatican"]) {
      const out = new Uint8Array(N * N);
      rasterizeOutline(geo(admin), out);
      expect(out.some((v) => v === EDGE_VALUE)).toBe(true);
    }
  });

  const depts = JSON.parse(readFileSync("public/data/departements-1000m.geojson", "utf8"));
  const deptGeo = (code) => depts.features.find((f) => f.properties.code === code).geometry;

  it.each([
    ["75", 0.05],
    ["01", 0.05],
    ["13", 0.05],
    ["33", 0.05],
  ])("départements FR : grille fine et pixels carrés à l'échelle pour %s", (code, maxCell) => {
    const out = new Uint8Array(N * N);
    const box = rasterizeOutline(deptGeo(code), out);
    expect(box.cellY).toBeLessThanOrEqual(maxCell);
    expect(box.cellY).toBeGreaterThanOrEqual(0.03);
    // True square pixels on the globe surface: cellX is wider in degrees by 1 / cosLat.
    expect(box.cellX).toBeGreaterThan(box.cellY);
    let edge = 0,
      halo = 0;
    for (const v of out) {
      if (v === EDGE_VALUE) edge++;
      else if (v) halo++;
    }
    expect(edge).toBeGreaterThan(5);
    // Bordure + 3 anneaux de halo : le département n'est pas rempli de gros blocs
    expect(halo).toBeLessThanOrEqual(edge * HALO_VALUES.length * 3.5);
  });
});
