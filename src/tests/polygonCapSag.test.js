// Régression « surfaces qui s'enfoncent » : la sphère d'océan ne doit jamais
// percer les calottes de polygones (losanges / lamelles sombres en mode États-Unis
// et départements), et aucune calotte ne doit avoir de trou. Une calotte est faite
// de triangles plats ; entre ses sommets elle plonge sous la sphère. Chaque couche
// doit donc rester sous sa propre marge d'altitude (altitude × rayon du globe),
// vérifié sur les vraies données GeoJSON.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getPolygonCapResolution,
  POLYGON_ALTITUDE,
  POLYGON_CAP_RESOLUTION,
} from "../config/gameConfig";
import ConicPolygonGeometry from "../globe/render/cachedConicPolygonGeometry";
import {
  isRefinable,
  registerRefinedPolygons,
  triangulateRefinedCap,
} from "../globe/render/refinedConicPolygonGeometry";

const GLOBE_RADIUS = 100;
const load = (name) =>
  JSON.parse(readFileSync(resolve(__dirname, "../../public/data", name), "utf8")).features;
const polygonsOf = ({ geometry }) =>
  geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
const nameOf = ({ properties: p }) => p.name || p.nom || p.ADMIN;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);

/** Distance de l'origine au point le plus proche du segment [a, b]. */
function distToSegment(a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, -dot(a, ab) / (dot(ab, ab) || 1)));
  return norm([a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]);
}

/** Distance de l'origine au triangle abc (point le plus proche, bords compris). */
function distToTriangle(a, b, c) {
  const n = cross(sub(b, a), sub(c, a));
  const nn = norm(n);
  const edges = () => Math.min(distToSegment(a, b), distToSegment(b, c), distToSegment(c, a));
  if (nn < 1e-9) return edges();
  const d = dot(n, a) / nn;
  const foot = [(n[0] * d) / nn, (n[1] * d) / nn, (n[2] * d) / nn];
  const inside = [
    dot(cross(sub(b, a), sub(foot, a)), n),
    dot(cross(sub(c, b), sub(foot, b)), n),
    dot(cross(sub(a, c), sub(foot, c)), n),
  ].every((v) => v >= 0);
  return inside ? Math.abs(d) : edges();
}

/**
 * Plongée max (unités du globe) des triangles de calotte sous le rayon.
 * `skipSlivers` ignore les lamelles de la tessellation d'origine (bords rectilignes,
 * quelques centièmes de degré de large : aucun pixel visible).
 */
function maxCapDip(features, resolution, { skipSlivers = false } = {}) {
  let worst = { dip: 0, name: "" };
  features.forEach((feature) => {
    polygonsOf(feature).forEach((coords) => {
      if (!isRefinable(coords)) return; // franchit l'antiméridien ou un pôle : tessellation d'origine
      const g = new ConicPolygonGeometry(coords, 0, GLOBE_RADIUS, false, true, false, resolution);
      const pos = g.attributes.position.array;
      const idx = g.index.array;
      const vertex = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      for (let k = 0; k < idx.length; k += 3) {
        const [a, b, c] = [vertex(idx[k]), vertex(idx[k + 1]), vertex(idx[k + 2])];
        const area = norm(cross(sub(b, a), sub(c, a))) / 2;
        const halfPerimeter = (norm(sub(b, a)) + norm(sub(c, b)) + norm(sub(a, c))) / 2;
        if (skipSlivers && area / halfPerimeter < 0.08) continue;
        const dip = GLOBE_RADIUS - distToTriangle(a, b, c);
        if (dip > worst.dip) worst = { dip, name: nameOf(feature) };
      }
    });
  });
  return worst;
}

const shoelace = (ring) =>
  ring.reduce((sum, [x, y], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length];
    return sum + (x * y2 - x2 * y);
  }, 0) / 2;

/** Aire (lng/lat) du polygone : anneau extérieur moins les trous. */
function polygonArea(rings) {
  const [outer, ...holes] = rings;
  return Math.abs(shoelace(outer)) - holes.reduce((s, h) => s + Math.abs(shoelace(h)), 0);
}

/** Aire signée (lng/lat) des triangles d'une calotte raffinée. */
function signedTriangleArea({ lngs, lats, indices }) {
  let area = 0;
  for (let k = 0; k < indices.length; k += 3) {
    const [a, b, c] = [indices[k], indices[k + 1], indices[k + 2]];
    area +=
      ((lngs[b] - lngs[a]) * (lats[c] - lats[a]) - (lngs[c] - lngs[a]) * (lats[b] - lats[a])) / 2;
  }
  return Math.abs(area);
}

/** Part de l'aire de la calotte (3D) dont les faces tournent le dos au spectateur (rejetées). */
function culledFraction(coords, resolution) {
  const g = new ConicPolygonGeometry(coords, 0, GLOBE_RADIUS, false, true, false, resolution);
  const pos = g.attributes.position.array;
  const idx = g.index.array;
  const vertex = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  let culled = 0;
  let total = 0;
  for (let k = 0; k < idx.length; k += 3) {
    const [a, b, c] = [vertex(idx[k]), vertex(idx[k + 1]), vertex(idx[k + 2])];
    const n = cross(sub(b, a), sub(c, a));
    const area = norm(n) / 2;
    total += area;
    if (dot(n, [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]]) < 0) culled += area;
  }
  return total ? culled / total : 0;
}

const margin = (altitude) => altitude * GLOBE_RADIUS;
const regionalFeatures = (name) =>
  load(name).map((feature) => ({
    ...feature,
    geometry: registerRefinedPolygons(feature.geometry),
  }));
const us = regionalFeatures("us-states.json");
const departments = regionalFeatures("departements-1000m.geojson");
const countries = load("countries-50m-low.json");

describe("calottes de polygones : la sphère ne perce pas", () => {
  const regional = getPolygonCapResolution({ baseResolution: 3, isRegional: true });

  it("États-Unis, profil mobile (3°) : plongée sous la marge régionale", () => {
    const { dip, name } = maxCapDip(us, regional);
    expect(dip, name).toBeLessThan(margin(POLYGON_ALTITUDE.departmentBase));
  });

  it("départements français, profil mobile : plongée sous la marge régionale", () => {
    const { dip, name } = maxCapDip(departments, regional);
    expect(dip, name).toBeLessThan(margin(POLYGON_ALTITUDE.departmentBase));
  });

  it("pays fantômes (mode régional) : plongée sous la marge fantôme", () => {
    const ghost = getPolygonCapResolution({ baseResolution: 3, isGhost: true });
    const { dip, name } = maxCapDip(countries, ghost, { skipSlivers: true });
    expect(dip, name).toBeLessThan(margin(POLYGON_ALTITUDE.ghostCountry));
  });

  it("monde, profil mobile : plongée sous la marge de base", () => {
    const world = getPolygonCapResolution({ baseResolution: 3 });
    const { dip, name } = maxCapDip(countries, world, { skipSlivers: true });
    expect(dip, name).toBeLessThan(margin(POLYGON_ALTITUDE.base));
  });

  it("garde-fou : un pas de 3° ferait percer les États (le test est sensible)", () => {
    const { dip } = maxCapDip(us, 3);
    expect(dip).toBeGreaterThan(margin(POLYGON_ALTITUDE.departmentBase));
  });
});

describe("calottes raffinées : couverture exacte, sans trou", () => {
  const step = POLYGON_CAP_RESOLUTION.regional;

  it("la somme des triangles recouvre exactement l'aire de chaque État et département", () => {
    [...us, ...departments].forEach((feature) => {
      polygonsOf(feature)
        .filter(isRefinable)
        .forEach((coords) => {
          // le contour est interpolé sur de grands cercles : on compare à son aire
          const cap = triangulateRefinedCap(coords, step);
          const expected = polygonArea(cap.contour);
          const error = Math.abs(signedTriangleArea(cap) - expected) / expected;
          expect(error, nameOf(feature)).toBeLessThan(2e-3);
        });
    });
  });

  it("quasi aucune face tournée vers le centre (le culling ne rouvre pas de trou)", () => {
    // des lamelles d'aire quasi nulle (points alignés) peuvent se retourner à la
    // découpe : elles sont ré-enroulées (reste < 0,1 % : arrondis float32 de lamelles
    // sub-pixel). L'ancienne tessellation laissait des trous
    // de ~1 % de l'aire (Oklahoma, Montana, Maryland…).
    [...us, ...departments].forEach((feature) => {
      polygonsOf(feature)
        .filter(isRefinable)
        .forEach((coords) => {
          expect(culledFraction(coords, step), nameOf(feature)).toBeLessThan(1e-3);
        });
    });
  });

  it("coupe les arêtes intérieures sans fissure : aucune arête plus longue que le pas", () => {
    const { lngs, lats, indices } = triangulateRefinedCap(us[0].geometry.coordinates, step);
    const unit = (i) => {
      const [lng, lat] = [(lngs[i] * Math.PI) / 180, (lats[i] * Math.PI) / 180];
      return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
    };
    const angle = (i, j) => (Math.acos(Math.min(1, dot(unit(i), unit(j)))) * 180) / Math.PI;
    for (let k = 0; k < indices.length; k += 3) {
      [
        [0, 1],
        [1, 2],
        [2, 0],
      ].forEach(([p, q]) => {
        expect(angle(indices[k + p], indices[k + q])).toBeLessThanOrEqual(step + 1e-6);
      });
    }
  });

  it("garde la géométrie d'origine pour les polygones qui franchissent l'antiméridien", () => {
    const crossing = [
      [
        [170, 0],
        [-170, 0],
        [-170, 10],
        [170, 10],
        [170, 0],
      ],
    ];
    expect(isRefinable(crossing)).toBe(false);
    expect(
      isRefinable([
        [
          [0, 85],
          [10, 89.5],
          [20, 85],
          [0, 85],
        ],
      ])
    ).toBe(false);
    expect(
      isRefinable([
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 0],
        ],
      ])
    ).toBe(true);
  });
});

describe("getPolygonCapResolution", () => {
  it("ne dépasse jamais le plafond de sa couche", () => {
    expect(getPolygonCapResolution({ baseResolution: 3, isRegional: true })).toBe(
      POLYGON_CAP_RESOLUTION.regional
    );
    expect(getPolygonCapResolution({ baseResolution: 3, isGhost: true, isRegional: true })).toBe(
      POLYGON_CAP_RESOLUTION.ghost
    );
  });

  it("aligne le monde mobile sur le profil bureau (2°), sans coût sur bureau", () => {
    expect(getPolygonCapResolution({ baseResolution: 3 })).toBe(2);
    expect(getPolygonCapResolution({ baseResolution: 2 })).toBe(2);
  });

  it("garde un profil plus fin que le plafond", () => {
    expect(getPolygonCapResolution({ baseResolution: 0.5, isRegional: true })).toBe(0.5);
  });
});
