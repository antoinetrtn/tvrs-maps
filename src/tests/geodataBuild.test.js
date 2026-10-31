// Garde-fou de la diète des données : `public/data/*` doit être la sortie exacte de
// `scripts/build-geodata.mjs` appliqué aux sources de `data-src/geodata/`, sans
// entité ni polygone perdu, et ne contenir que les propriétés lues par le code.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildDataset, DATASETS } from "../../scripts/build-geodata.mjs";

const read = (...parts) => readFileSync(resolve(__dirname, "../..", ...parts), "utf8");
const countPolygons = ({ geometry }) =>
  geometry.type === "Polygon" ? 1 : geometry.coordinates.length;

describe.each(DATASETS)("données cartographiques $out", (config) => {
  const built = buildDataset(config);
  const served = JSON.parse(read("public/data", config.out));
  const source = JSON.parse(read("data-src/geodata", config.src));

  it("est à jour par rapport à la source (npm run build:geodata)", () => {
    expect(read("public/data", config.out)).toBe(built.text);
  });

  it("garde toutes les entités et tous les polygones, sans trou perdu", () => {
    expect(served.features).toHaveLength(source.features.length);
    expect(served.features.reduce((n, f) => n + countPolygons(f), 0)).toBe(
      source.features.reduce((n, f) => n + countPolygons(f), 0)
    );
    expect(built.stats.droppedPolygons).toBe(0);
    expect(built.stats.droppedHoles).toBe(0);
  });

  it("ne contient que les propriétés utiles et des coordonnées à précision réduite", () => {
    const allowed = new Set(config.keepProperties);
    const factor = 10 ** config.decimals;
    for (const feature of served.features) {
      expect(Object.keys(feature.properties).every((k) => allowed.has(k))).toBe(true);
      const rings =
        feature.geometry.type === "Polygon"
          ? feature.geometry.coordinates
          : feature.geometry.coordinates.flat();
      for (const ring of rings) {
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
        for (const [x, y] of ring) {
          expect(Math.abs(x * factor - Math.round(x * factor))).toBeLessThan(1e-6);
          expect(Math.abs(y * factor - Math.round(y * factor))).toBeLessThan(1e-6);
        }
      }
    }
  });
});
