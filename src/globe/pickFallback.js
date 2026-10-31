import { getLngLatDistance } from "../utils/utils";

/** Rivers & mountains mode: nearest river path point or relief centroid (degrees). */
export function pickRiverOrRelief(gameDataMap, lng, lat) {
  let best = null;
  Object.entries(gameDataMap).forEach(([admin, data]) => {
    if (!data) return;
    let dist;
    if (data.type === "river" && Array.isArray(data.path) && data.path.length > 0) {
      dist = data.path.reduce((min, [pLat, pLng]) => {
        const d = getLngLatDistance(lng, lat, pLng, pLat);
        return d < min ? d : min;
      }, Infinity);
    } else if (data.lat !== undefined && data.lng !== undefined) {
      dist = getLngLatDistance(lng, lat, data.lng, data.lat);
    } else {
      return;
    }
    if (!best || dist < best.dist) best = { admin, dist };
  });
  if (!best) return null;
  const threshold = gameDataMap[best.admin].type === "river" ? 5.5 : 6.0;
  return best.dist < threshold ? best.admin : null;
}

/** Legacy degree fallback, used only when no screen projection is available (tests/SSR). */
export function pickNearestByDegrees(gameDataMap, lng, lat, maxDist) {
  let best = null;
  Object.entries(gameDataMap).forEach(([admin, data]) => {
    if (!data || data.lat === undefined || data.lng === undefined) return;
    const dist = getLngLatDistance(lng, lat, data.lng, data.lat);
    if (!best || dist < best.dist) best = { admin, dist };
  });
  return best && best.dist < maxDist ? best.admin : null;
}
