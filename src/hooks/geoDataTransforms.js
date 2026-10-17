import { registerRefinedPolygons } from "../globe/render/refinedConicPolygonGeometry";
import { getRenderGeometry } from "../utils/utils";

function mergeGeometries(geomA, geomB) {
  const getRing = (geom) => {
    if (!geom) return null;
    if (geom.type === "Polygon") {
      return geom.coordinates[0];
    } else if (geom.type === "MultiPolygon") {
      let maxLen = 0;
      let mainRing = null;
      for (const poly of geom.coordinates) {
        if (poly[0] && poly[0].length > maxLen) {
          maxLen = poly[0].length;
          mainRing = poly[0];
        }
      }
      return mainRing;
    }
    return null;
  };

  const ringA = getRing(geomA);
  const ringB = getRing(geomB);
  if (!ringA || !ringB) return geomA;

  const getEdges = (ring) => {
    const edges = [];
    for (let i = 0; i < ring.length - 1; i++) {
      edges.push([ring[i], ring[i + 1]]);
    }
    return edges;
  };

  const edgesA = getEdges(ringA);
  const edgesB = getEdges(ringB);

  const arePointsEqual = (p1, p2) =>
    Math.abs(p1[0] - p2[0]) < 1e-5 && Math.abs(p1[1] - p2[1]) < 1e-5;

  const isSharedEdge = (edge, otherEdges) => {
    const [u, v] = edge;
    return otherEdges.some(([x, y]) => arePointsEqual(u, y) && arePointsEqual(v, x));
  };

  const nonSharedA = edgesA.filter((e) => !isSharedEdge(e, edgesB));
  const nonSharedB = edgesB.filter((e) => !isSharedEdge(e, edgesA));

  const combinedEdges = [...nonSharedA, ...nonSharedB];

  const adj = new Map();
  for (const [u, v] of combinedEdges) {
    const key = `${u[0].toFixed(5)},${u[1].toFixed(5)}`;
    adj.set(key, v);
  }

  const result = [];
  if (combinedEdges.length > 0) {
    const firstEdge = combinedEdges[0];
    result.push(firstEdge[0]);
    let current = firstEdge[1];
    const visited = new Set();
    while (current) {
      const key = `${current[0].toFixed(5)},${current[1].toFixed(5)}`;
      if (visited.has(key)) break;
      visited.add(key);
      result.push(current);
      current = adj.get(key);
    }
    const start = result[0];
    const end = result[result.length - 1];
    if (!arePointsEqual(start, end)) {
      result.push(start);
    }
  }

  const islands = [];
  if (geomA.type === "MultiPolygon") {
    geomA.coordinates.forEach((poly) => {
      if (poly[0] !== ringA) islands.push(poly);
    });
  }
  if (geomB.type === "MultiPolygon") {
    geomB.coordinates.forEach((poly) => {
      if (poly[0] !== ringB) islands.push(poly);
    });
  }

  return {
    type: "MultiPolygon",
    coordinates: [[result], ...islands],
  };
}

export function transformCountries(rawFeatures) {
  const features = [...rawFeatures];
  const somaliaIdx = features.findIndex((f) => f.properties?.ADMIN === "Somalia");
  const somalilandIdx = features.findIndex((f) => f.properties?.ADMIN === "Somaliland");
  if (somaliaIdx !== -1 && somalilandIdx !== -1) {
    const somalia = features[somaliaIdx];
    const somaliland = features[somalilandIdx];
    somalia.geometry = mergeGeometries(somalia.geometry, somaliland.geometry);
    features.splice(somalilandIdx, 1);
  }

  return features.map((feature, idx) => ({
    ...feature,
    __id: `c${idx}`,
    renderGeometry: getRenderGeometry(feature),
  }));
}

export function transformDepartments(features) {
  return features.map((feature, idx) => ({
    ...feature,
    __id: `d${idx}`,
    renderGeometry: registerRefinedPolygons(getRenderGeometry(feature)),
  }));
}

export function transformUsStates(features) {
  return features.map((feature, idx) => ({
    ...feature,
    __id: `u${idx}`,
    renderGeometry: registerRefinedPolygons(getRenderGeometry(feature)),
  }));
}
