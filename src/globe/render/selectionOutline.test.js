import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  INSIDE_VALUE,
  OUTLINE_CSS_PX,
  OUTLINE_TEX_SIZE,
  rasterizeOutline,
  selectionOutlinePx,
  setSelectionOutlineDpr,
} from "./selectionOutline";

const N = OUTLINE_TEX_SIZE;
const cellAt = (out, i, j) => out[j * N + i];
/** Mask value at a lng/lat, like the shader's nearest cell. */
const maskAt = (out, box, lng, lat) =>
  cellAt(out, Math.floor((lng - box.ox) / box.cell), Math.floor((lat - box.oy) / box.cell));

const world = JSON.parse(readFileSync("public/data/countries-50m-low.json", "utf8"));
const geo = (admin) => world.features.find((f) => f.properties.ADMIN === admin).geometry;

describe("rasterizeOutline — masque de couverture de la brique contour", () => {
  it("remplit l'intérieur (le shader trace le contour 0,5 en largeur écran constante)", () => {
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
    expect(maskAt(out, box, 6, 6)).toBe(INSIDE_VALUE);
    expect(maskAt(out, box, 0.05, 6)).toBe(INSIDE_VALUE);
    expect(maskAt(out, box, -0.05, 6)).toBe(0);
    expect(maskAt(out, box, 12.05, 6)).toBe(0);
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
    expect(maskAt(out, box, 179.95, -17)).toBe(INSIDE_VALUE);
    expect(maskAt(out, box, 180.05, -17)).toBe(INSIDE_VALUE);
  });

  it("Antarctique : pas d'anneau au pôle ni de couture sur l'antiméridien", () => {
    const out = new Uint8Array(N * N);
    const box = rasterizeOutline(geo("Antarctica"), out);
    expect(box.period).toBe(Math.round(360 / box.cell));
    // Lignes au-delà du pôle = dernière ligne du globe (intérieur), pas un bord.
    for (const lng of [-179.9, -90, 0, 90, 179.9]) {
      expect(maskAt(out, box, lng, -89.9)).toBe(INSIDE_VALUE);
      expect(maskAt(out, box, lng, -90.5)).toBe(INSIDE_VALUE);
      expect(maskAt(out, box, lng, -86)).toBe(INSIDE_VALUE);
    }
    // Colonnes de bourrage = copie périodique (pas de bord vertical à ±180°).
    const j = Math.floor((-86 - box.oy) / box.cell);
    expect(cellAt(out, 0, j)).toBe(INSIDE_VALUE);
    expect(cellAt(out, 1, j)).toBe(INSIDE_VALUE);
  });

  it("renvoie null sans géométrie", () => {
    expect(rasterizeOutline(null)).toBeNull();
  });

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
    expect(out.filter((v) => v === INSIDE_VALUE).length).toBeGreaterThan(200);
  });

  it("allume au moins un pixel pour les micro-États (Monaco, Vatican)", () => {
    for (const admin of ["Monaco", "Vatican"]) {
      const out = new Uint8Array(N * N);
      rasterizeOutline(geo(admin), out);
      expect(out.some((v) => v === INSIDE_VALUE)).toBe(true);
    }
  });

  it("épaisseur du trait en CSS px, convertie en px physiques selon le DPR", () => {
    setSelectionOutlineDpr(3);
    expect(selectionOutlinePx.value).toBeCloseTo(OUTLINE_CSS_PX * 3);
    setSelectionOutlineDpr(1);
    expect(selectionOutlinePx.value).toBeCloseTo(OUTLINE_CSS_PX);
  });
});
