import { useEffect, useMemo, useState } from "react";

import { DEFAULT_LEARN_SUB_MODE } from "../config/gameConfig";
import { DATA_URLS } from "../config/gameConstants";
import { departmentsDataMap } from "../data/departmentsData";
import { countryDataMap } from "../data/gameData";
import { riversMountainsDataMap } from "../data/riversMountainsData";
import { usStatesDataMap } from "../data/usStatesData";
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

export function useGeoData({ mode, learnSubMode = DEFAULT_LEARN_SUB_MODE }) {
  const [countriesData, setCountriesData] = useState([]);
  const [departmentsData, setDepartmentsData] = useState([]);
  const [usStatesData, setUsStatesData] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URLS.countriesGeoJson)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.features) {
          const features = [...data.features];
          const somaliaIdx = features.findIndex((f) => f.properties?.ADMIN === "Somalia");
          const somalilandIdx = features.findIndex((f) => f.properties?.ADMIN === "Somaliland");
          if (somaliaIdx !== -1 && somalilandIdx !== -1) {
            const somalia = features[somaliaIdx];
            const somaliland = features[somalilandIdx];
            somalia.geometry = mergeGeometries(somalia.geometry, somaliland.geometry);
            features.splice(somalilandIdx, 1);
          }

          const mapped = features.map((feature) => ({
            ...feature,
            renderGeometry: getRenderGeometry(feature),
          }));
          setCountriesData(mapped);
        }
        return;
      })
      .catch((err) => console.error("Failed to load map data", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URLS.departmentsGeoJson)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.features) {
          const mapped = data.features.map((feature) => ({
            ...feature,
            renderGeometry: getRenderGeometry(feature),
          }));
          setDepartmentsData(mapped);
        }
        return;
      })
      .catch((err) => console.error("Failed to load departments map data", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/us-states.json")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.features) {
          const mapped = data.features.map((feature) => ({
            ...feature,
            renderGeometry: getRenderGeometry(feature),
          }));
          setUsStatesData(mapped);
        }
        return;
      })
      .catch((err) => console.error("Failed to load US states map data", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const isLearn = mode === "learn";
  const isDepartmentsMode = mode === "departments" || (isLearn && learnSubMode === "departments");
  const isRiversMountainsMode =
    mode === "rivers_mountains" || (isLearn && learnSubMode === "rivers_mountains");
  const isUsStatesMode = mode === "us_states" || (isLearn && learnSubMode === "us_states");

  const activeDataMap = useMemo(() => {
    if (isRiversMountainsMode) return riversMountainsDataMap;
    if (isDepartmentsMode) return departmentsDataMap;
    if (isUsStatesMode) return usStatesDataMap;
    return countryDataMap;
  }, [isDepartmentsMode, isRiversMountainsMode, isUsStatesMode]);

  const allCountryKeys = useMemo(() => Object.keys(activeDataMap), [activeDataMap]);
  const totalPossible = allCountryKeys.length;

  return {
    countriesData,
    departmentsData,
    usStatesData,
    activeDataMap,
    allCountryKeys,
    totalPossible,
  };
}
