import { useEffect } from "react";

import ConicPolygonGeometry from "../render/cachedConicPolygonGeometry";

// Must match three-globe's polygon layer call:
// new ConicPolygonGeometry(coords, 0, GLOBE_RADIUS, false, hasCap, hasSide, res)
const GLOBE_RADIUS = 100;
// Curvature used for dimmed "ghost" countries in regional modes (GlobeMap.jsx).
const GHOST_CURVATURE_RESOLUTION = 1;
const IDLE_SLICE_MS = 8;

const scheduleIdle = (cb) =>
  typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(cb, { timeout: 2000 })
    : window.setTimeout(() => cb({ timeRemaining: () => IDLE_SLICE_MS }), 50);

const cancelIdle = (id) =>
  typeof window.cancelIdleCallback === "function"
    ? window.cancelIdleCallback(id)
    : window.clearTimeout(id);

const ringsOf = (feature) => {
  const geo = feature?.renderGeometry;
  if (!geo) return [];
  if (geo.type === "Polygon") return [geo.coordinates];
  if (geo.type === "MultiPolygon") return geo.coordinates;
  return [];
};

/**
 * After first load, triangulate (and memoize, see cachedConicPolygonGeometry)
 * every polygon variant the modes will need, in small idle slices, so the first
 * switch to departments / US states (ghost world) or back doesn't block.
 */
export function useGlobeIdlePrewarm({ countriesData, departmentsData, usStatesData, resolution }) {
  useEffect(() => {
    const jobs = [];
    const add = (features, res) => {
      if (!Array.isArray(features) || !Number.isFinite(res)) return;
      features.forEach((f) => ringsOf(f).forEach((coords) => jobs.push([coords, res])));
    };
    add(countriesData, resolution);
    add(countriesData, GHOST_CURVATURE_RESOLUTION);
    add(departmentsData, resolution);
    add(usStatesData, resolution);
    if (jobs.length === 0) return undefined;

    let index = 0;
    let handle = null;
    const work = (deadline) => {
      while (index < jobs.length && deadline.timeRemaining() > 1) {
        const [coords, res] = jobs[index++];
        try {
          new ConicPolygonGeometry(coords, 0, GLOBE_RADIUS, false, true, true, res).dispose();
        } catch {}
      }
      handle = index < jobs.length ? scheduleIdle(work) : null;
    };
    handle = scheduleIdle(work);
    return () => {
      if (handle != null) cancelIdle(handle);
    };
  }, [countriesData, departmentsData, usStatesData, resolution]);
}
