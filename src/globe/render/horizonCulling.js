/**
 * Horizon culling for the polygon layer.
 *
 * three-globe builds every country as a conic mesh that reaches down to the
 * globe centre, so its bounding sphere always contains the origin and three's
 * frustum culling never rejects a country on the far side of the planet:
 * ~half the polygon draw calls were spent on hidden faces. We hide polygon
 * objects whose whole footprint lies beyond the horizon, using a cached
 * spherical cap (centre direction + angular radius) per feature.
 */

import { stylePolygonBorderLine } from "./globePolygonMaterial";

const DEG = Math.PI / 180;
// Extra angle so extruded caps / borders near the limb never pop.
const HORIZON_MARGIN = 4 * DEG;

const capCache = new WeakMap();

function forEachCoordinate(geometry, fn) {
  if (!geometry) return;
  const { type, coordinates } = geometry;
  if (type === "Polygon") coordinates.forEach((ring) => ring.forEach(fn));
  else if (type === "MultiPolygon")
    coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(fn)));
}

function toUnit(lng, lat) {
  const phi = lat * DEG;
  const theta = lng * DEG;
  return [Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)];
}

/**
 * Spherical cap {x,y,z (unit), radius (rad)} covering a GeoJSON feature, or a
 * three-globe polygon datum ({ coords: rings } — one part of a MultiPolygon,
 * so islands are culled on their own).
 */
export function featureCap(feature) {
  if (!feature || typeof feature !== "object") return null;
  const key = feature.coords || feature;
  const cached = capCache.get(key);
  if (cached !== undefined) return cached;
  const geometry = feature.coords
    ? { type: "Polygon", coordinates: feature.coords }
    : feature.renderGeometry || feature.geometry;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  const points = [];
  forEachCoordinate(geometry, ([lng, lat]) => {
    const p = toUnit(lng, lat);
    points.push(p);
    sx += p[0];
    sy += p[1];
    sz += p[2];
  });
  const len = Math.hypot(sx, sy, sz);
  let cap = null;
  if (points.length && len > 1e-6) {
    const c = [sx / len, sy / len, sz / len];
    let minDot = 1;
    for (const p of points) minDot = Math.min(minDot, p[0] * c[0] + p[1] * c[1] + p[2] * c[2]);
    cap = { x: c[0], y: c[1], z: c[2], radius: Math.acos(Math.max(-1, Math.min(1, minDot))) };
  }
  capCache.set(key, cap);
  return cap;
}

/**
 * True when a cap is (at least partly) on the visible hemisphere for a camera
 * at `camPos` (globe centred at the origin, radius `globeRadius`).
 */
export function isCapVisible(cap, camPos, globeRadius) {
  if (!cap) return true;
  const dist = Math.hypot(camPos.x, camPos.y, camPos.z);
  if (dist <= globeRadius) return true;
  const cosToCap = (cap.x * camPos.x + cap.y * camPos.y + cap.z * camPos.z) / dist;
  const angle = Math.acos(Math.max(-1, Math.min(1, cosToCap)));
  const horizon = Math.acos(globeRadius / dist);
  return angle - cap.radius < horizon + HORIZON_MARGIN;
}

/**
 * Hide/show polygon objects of `scene` for `camera`. Returns the number of
 * polygons hidden. Objects are matched by three-globe's `__globeObjType`.
 */
export function cullPolygonsBeyondHorizon(scene, camera, globeRadius = 100) {
  let hidden = 0;
  const camPos = camera.position;
  const visit = (obj) => {
    if (obj.__globeObjType === "polygon") {
      const visible = isCapVisible(featureCap(obj.__data), camPos, globeRadius);
      if (obj.visible !== visible) obj.visible = visible;
      if (!visible) {
        hidden += 1;
      } else if (obj.children?.[1]) {
        stylePolygonBorderLine(obj.children[1]);
      }
      return;
    }
    for (const child of obj.children) visit(child);
  };
  visit(scene);
  return hidden;
}
