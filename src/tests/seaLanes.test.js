import { describe, expect, it } from "vitest";

import { isLand, loadLandMask, sampleLeg } from "../../scripts/lib/landMask.mjs";
import { countryDataMap } from "../data/gameData";
import { buildSeaGraph, planBoatRoutes } from "../globe/render/life/lifeBoats";
import { SEA_LANES, SEA_NODE_POS } from "../globe/render/life/seaLanes.generated";
import { SEA_EDGES } from "../globe/render/life/seaRoutes";

// Unit vector (three-globe axes) → [lat, lng].
const toLatLng = ([x, y, z]) => [
  (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI,
  90 - (Math.atan2(z, x) * 180) / Math.PI,
];

describe("boat sea lanes never cross land", () => {
  const mask = loadLandMask();
  const landHits = (line) => {
    const hits = [];
    for (let i = 1; i < line.length; i++)
      sampleLeg(line[i - 1], line[i], 0.01).forEach(([la, lo]) => {
        if (isLand(mask, la, lo)) hits.push([+la.toFixed(2), +lo.toFixed(2)]);
      });
    return hits;
  };

  it("bakes every authored edge (generated file is up to date)", () => {
    SEA_EDGES.split(/\s+/)
      .filter(Boolean)
      .forEach((edge) => expect(SEA_LANES[edge], edge).toBeDefined());
  });

  it("samples every lane densely against the land mask", () => {
    const bad = {};
    SEA_EDGES.split(/\s+/)
      .filter(Boolean)
      .forEach((edge) => {
        const [a, b] = edge.split("-");
        const hits = landHits([SEA_NODE_POS[a], ...SEA_LANES[edge], SEA_NODE_POS[b]]);
        if (hits.length) bad[edge] = hits.slice(0, 3);
      });
    expect(bad).toEqual({});
  });

  it("keeps every planned boat route at sea, Malacca included", () => {
    const graph = buildSeaGraph();
    const sets = [
      Object.keys(countryDataMap),
      ["Malaysia", "Singapore", "Thailand", "Indonesia", "India", "Myanmar"],
    ];
    sets.forEach((found) => {
      planBoatRoutes(graph, found, countryDataMap).forEach((nodes) => {
        expect(landHits(graph.points(nodes).map(toLatLng))).toEqual([]);
      });
    });
  });
});
