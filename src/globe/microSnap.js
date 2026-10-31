// Micro-territory "magnet" picking (<1000 km²: Vatican, Monaco, Caribbean islets…).
// List lives in public/data/micro-territories.json (out of the JS bundle).
const MICRO_SNAP_RADIUS_PX = { mouse: 22, touch: 32 };
// Zoomed far out, a 22 px disc around Vatican covers Rome: halve the radius
// that lets a micro steal a click landing inside another country.
const STEAL_FULL_RADIUS_MAX_ALT = 1.2;
const DEG = Math.PI / 180;

let microAdmins = null;
let loading = null;
export const setMicroAdmins = (list) => {
  microAdmins = list ? new Set(list) : null;
};
export function loadMicroAdmins() {
  if (microAdmins) return Promise.resolve(microAdmins);
  if (loading || typeof fetch !== "function") return loading;
  loading = fetch(`${import.meta.env.BASE_URL}data/micro-territories.json`)
    .then((r) => r.json())
    .then((d) => {
      setMicroAdmins(d.admins);
      return microAdmins;
    })
    .catch(() => (loading = null));
  return loading;
}

const isFacing = (lng, lat, cLng, cLat) =>
  Math.sin(lat * DEG) * Math.sin(cLat * DEG) +
    Math.cos(lat * DEG) * Math.cos(cLat * DEG) * Math.cos((lng - cLng) * DEG) >
  0;

/**
 * Nearest micro-territory (screen px) to a click. `project(lat,lng)` → {x,y}.
 * `insideOther`: the click already lies in a bigger country (steal case).
 * With >2 candidates in the disc we still pick the nearest (documented
 * trade-off: Caribbean clusters when zoomed out; zooming in resolves it).
 */
export function pickMicroTerritory({
  admins = microAdmins,
  gameDataMap,
  project,
  click,
  lng,
  lat,
  pointerType,
  altitude = 1,
  insideOther = false,
}) {
  if (!admins || !project || !click) return null;
  let r = pointerType === "touch" ? MICRO_SNAP_RADIUS_PX.touch : MICRO_SNAP_RADIUS_PX.mouse;
  if (insideOther && altitude > STEAL_FULL_RADIUS_MAX_ALT) r /= 2;
  let best = null;
  let count = 0;
  for (const admin of admins) {
    const d = gameDataMap[admin];
    if (!d || d.lat === undefined || !isFacing(lng, lat, d.lng, d.lat)) continue;
    const p = project(d.lat, d.lng);
    if (!p) continue;
    const dist = Math.hypot(p.x - click.x, p.y - click.y);
    if (dist > r) continue;
    count++;
    if (!best || dist < best.dist) best = { admin, dist };
  }
  return best && { ...best, count };
}

/** Nearest centroid in screen px (replaces the fixed 6° fallback). */
export function pickNearestByPixels({ gameDataMap, project, click, lng, lat, radiusPx }) {
  let best = null;
  for (const [admin, d] of Object.entries(gameDataMap)) {
    if (!d || d.lat === undefined || !isFacing(lng, lat, d.lng, d.lat)) continue;
    const p = project(d.lat, d.lng);
    if (!p) continue;
    const dist = Math.hypot(p.x - click.x, p.y - click.y);
    if (dist <= radiusPx && (!best || dist < best.dist)) best = { admin, dist };
  }
  return best;
}

/** Screen projection helpers (canvas-relative px), null-safe for tests. */
export function getProjector(globeEl) {
  const g = globeEl?.current;
  if (!g?.getScreenCoords) return null;
  return (lat, lng) => g.getScreenCoords(lat, lng, 0.01);
}
export function toCanvasPx(globeEl, clientX, clientY) {
  const rect = globeEl?.current?.renderer?.()?.domElement?.getBoundingClientRect?.();
  return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY };
}
export function snapMicroAtScreen({
  globeEl,
  project,
  gameDataMap,
  lng,
  lat,
  screen,
  insideOther,
}) {
  return pickMicroTerritory({
    gameDataMap,
    project,
    click: screen,
    lng,
    lat,
    pointerType: screen.pointerType,
    altitude: globeEl.current?.pointOfView?.()?.altitude,
    insideOther,
  });
}
