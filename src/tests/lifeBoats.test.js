import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { countryDataMap } from "../data/gameData";
import {
  buildSeaGraph,
  createBoatLayer,
  MAX_BOATS,
  planBoatRoutes,
} from "../globe/render/life/lifeBoats";

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

  it("places every boat at a finite position", () => {
    const scene = new THREE.Scene();
    const layer = createBoatLayer({ scene: () => scene, getGlobeRadius: () => 100 });
    layer.setFound(
      ["France", "Spain", "Italy", "Greece", "India", "Malaysia", "Singapore", "Japan"],
      countryDataMap
    );
    const camera = new THREE.PerspectiveCamera(50, 1.6, 1, 5000);
    camera.position.set(0, 0, 400);
    camera.updateMatrixWorld();
    layer.mesh.onBeforeRender({ domElement: { clientHeight: 900 } }, scene, camera);
    const m = new THREE.Matrix4();
    expect(layer.mesh.count).toBeGreaterThan(0);
    for (let i = 0; i < layer.mesh.count; i++) {
      layer.mesh.getMatrixAt(i, m);
      expect(m.elements.every(Number.isFinite)).toBe(true);
    }
    layer.dispose();
  });
});
