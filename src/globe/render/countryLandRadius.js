/**
 * Farthest polygon vertex of a country from its capital (radians on the unit sphere),
 * so the discovery land front covers huge countries (Russia, Canada) entirely.
 * Features are registered lazily when their material is first resolved.
 */
const DEG = Math.PI / 180;
const features = new Map();
const cache = new Map();

export function registerCountryFeature(admin, feature) {
  if (!admin || !feature?.geometry || features.has(admin)) return;
  features.set(admin, feature.geometry);
}

function forEachVertex(geometry, fn) {
  const { type, coordinates } = geometry || {};
  if (!coordinates) return;
  const rings =
    type === "Polygon" ? coordinates : type === "MultiPolygon" ? coordinates.flat() : [];
  rings.forEach((ring) => ring.forEach(([lng, lat]) => fn(lat, lng)));
}

export function angularDistance(lat1, lng1, lat2, lng2) {
  const a =
    Math.sin(lat1 * DEG) * Math.sin(lat2 * DEG) +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos((lng2 - lng1) * DEG);
  return Math.acos(Math.min(1, Math.max(-1, a)));
}

/** Max angular distance capital -> polygon vertex, or null when the geometry is unknown. */
export function getCountryLandRadius(admin, lat, lng) {
  const key = `${admin}|${lat}|${lng}`;
  if (cache.has(key)) return cache.get(key);
  const geometry = features.get(admin);
  if (!geometry) return null;
  let r = 0;
  forEachVertex(geometry, (vLat, vLng) => {
    r = Math.max(r, angularDistance(lat, lng, vLat, vLng));
  });
  const out = r > 0 ? r : null;
  cache.set(key, out);
  return out;
}
