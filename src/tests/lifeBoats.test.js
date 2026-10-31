import { describe, expect, it } from "vitest";

import { countryDataMap } from "../data/gameData";
import { buildSeaGraph, MAX_BOATS, planBoatRoutes } from "../globe/render/life/lifeBoats";

describe("life boats sea graph", () => {
  const graph = buildSeaGraph();

  it("is a single connected sea network", () => {
    for (let i = 1; i < graph.nodeCount; i++) expect(graph.path(0, i)).not.toBeNull();
  });

  it("links only found coastal countries, never landlocked ones", () => {
    const routes = planBoatRoutes(
      graph,
      ["France", "Switzerland", "Spain", "Italy"],
      countryDataMap
    );
    expect(routes.length).toBeGreaterThan(0);
    expect(planBoatRoutes(graph, ["Switzerland", "Austria"], countryDataMap)).toEqual([]);
  });

  it("caps the fleet", () => {
    const routes = planBoatRoutes(graph, Object.keys(countryDataMap), countryDataMap);
    expect(routes.length).toBe(MAX_BOATS);
  });
});
