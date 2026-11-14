import { useEffect, useState } from "react";

import { getPolygonCapResolution, getStableGlobeCapResolution } from "../../config/gameConfig";
import ConicPolygonGeometry from "../render/cachedConicPolygonGeometry";
import GeoJsonGeometry from "../render/cachedGeoJsonGeometry";
import { ensurePaintedTerrain } from "../render/paintedTerrain";

// Must match three-globe's polygon layer call:
// new ConicPolygonGeometry(coords, 0, GLOBE_RADIUS, false, hasCap, hasSide, res)
const GLOBE_RADIUS = 100;
const IDLE_SLICE_MS = 8;

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// 40ms timeout: a busy globe RAF (or software GPU) rarely enters an idle period,
// and when requestIdleCallback fires via timeout its deadline.timeRemaining() is 0.
// We bound each slice explicitly with performance.now() to IDLE_SLICE_MS.
const scheduleIdle = (cb) =>
  typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(cb, { timeout: 40 })
    : window.setTimeout(cb, 16);

const cancelIdle = (id) =>
  typeof window.cancelIdleCallback === "function"
    ? window.cancelIdleCallback(id)
    : window.clearTimeout(id);

function markLayerReady(key) {
  return (prev) => (prev[key] ? prev : { ...prev, [key]: true });
}

const ringsOf = (feature) => {
  const geo = feature?.renderGeometry || feature?.geometry;
  if (!geo) return [];
  if (geo.type === "Polygon") return [geo.coordinates];
  if (geo.type === "MultiPolygon") return geo.coordinates;
  return [];
};

function enqueueRingJobs(features, resolutionFor, jobs) {
  (features || []).forEach((f) => {
    const res = resolutionFor(f);
    ringsOf(f).forEach((coords) => jobs.push({ coords, res }));
  });
}

function runPrewarmJob(job) {
  new ConicPolygonGeometry(job.coords, 0, GLOBE_RADIUS, false, true, true, job.res).dispose();
  new GeoJsonGeometry(
    { type: "Polygon", coordinates: job.coords },
    GLOBE_RADIUS,
    job.res
  ).dispose();
}

/**
 * After first load, triangulate (and memoize/pool, see cachedConicPolygonGeometry
 * and cachedGeoJsonGeometry) every polygon cap and border stroke geometry the
 * modes will need, in small bounded slices, then signal `useGlobeRenderData` to
 * mount dormant regional layers so the first switch to departments / US states
 * does zero geometry triangulation and zero VBO creation on click.
 */
export function useGlobeIdlePrewarm({ countriesData, departmentsData, usStatesData, resolution }) {
  const [residentLayers, setResidentLayers] = useState({
    departmentsReady: false,
    usStatesReady: false,
  });

  useEffect(() => {
    const jobs = [];
    const regionalRes = getPolygonCapResolution({
      baseResolution: resolution,
      isGhost: false,
      isRegional: true,
    });

    if (Array.isArray(departmentsData) && departmentsData.length > 0) {
      enqueueRingJobs(departmentsData, () => regionalRes, jobs);
      jobs.push({ done: "departments" });
    }

    if (Array.isArray(usStatesData) && usStatesData.length > 0) {
      enqueueRingJobs(usStatesData, () => regionalRes, jobs);
      jobs.push({ done: "usStates" });
    }

    if (Array.isArray(countriesData) && countriesData.length > 0) {
      enqueueRingJobs(countriesData, (f) => getStableGlobeCapResolution(f, resolution), jobs);
    }

    ensurePaintedTerrain();

    if (jobs.length === 0) return undefined;

    let index = 0;
    let handle = null;
    const work = () => {
      const sliceStart = nowMs();
      while (index < jobs.length && nowMs() - sliceStart < IDLE_SLICE_MS) {
        const job = jobs[index++];
        if (job.done === "departments") {
          setResidentLayers(markLayerReady("departmentsReady"));
          break;
        }
        if (job.done === "usStates") {
          setResidentLayers(markLayerReady("usStatesReady"));
          break;
        }
        try {
          runPrewarmJob(job);
        } catch {}
      }
      handle = index < jobs.length ? scheduleIdle(work) : null;
    };
    handle = scheduleIdle(work);
    return () => {
      if (handle != null) cancelIdle(handle);
    };
  }, [countriesData, departmentsData, usStatesData, resolution]);

  return residentLayers;
}
