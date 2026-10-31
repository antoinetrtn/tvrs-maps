import { getLngLatDistance } from "../utils/utils";

function distanceToSegmentDeg(lng, lat, lat1, lng1, lat2, lng2) {
  let dLng1 = lng1 - lng;
  while (dLng1 > 180) dLng1 -= 360;
  while (dLng1 < -180) dLng1 += 360;
  const x1 = dLng1;
  const y1 = lat1 - lat;

  let dLng2 = lng2 - lng;
  while (dLng2 > 180) dLng2 -= 360;
  while (dLng2 < -180) dLng2 += 360;
  const x2 = dLng2;
  const y2 = lat2 - lat;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(x1, y1);
  const t = Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(projX, projY);
}

/** Rivers & mountains mode: nearest river or mountain path segment or centroid (degrees). */
export function pickRiverOrRelief(gameDataMap, lng, lat) {
  let best = null;
  Object.entries(gameDataMap).forEach(([admin, data]) => {
    if (!data) return;
    let dist = Infinity;
    if (Array.isArray(data.path) && data.path.length >= 2) {
      for (let i = 0; i < data.path.length - 1; i++) {
        const [lat1, lng1] = data.path[i];
        const [lat2, lng2] = data.path[i + 1];
        const d = distanceToSegmentDeg(lng, lat, lat1, lng1, lat2, lng2);
        if (d < dist) dist = d;
      }
    } else if (Array.isArray(data.path) && data.path.length === 1) {
      const [pLat, pLng] = data.path[0];
      dist = getLngLatDistance(lng, lat, pLng, pLat);
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
