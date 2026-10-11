/**
 * « Curseurs spatiaux » — where each Conquête player is looking on the globe.
 * Ephemeral: Realtime broadcast on the match channel, never written to the DB.
 * Pure helpers + a tiny external store (no React, unit-testable).
 */

/** ~6.7 Hz max while the camera moves; heartbeat keeps a still cursor alive. */
export const CURSOR_SEND_INTERVAL_MS = 150;
export const CURSOR_HEARTBEAT_MS = 2000;
/** Below this move (degrees) a new position is not worth a message. */
const CURSOR_MIN_MOVE_DEG = 0.25;
/** A cursor with no news for this long is hidden (player left / tab asleep). */
export const CURSOR_STALE_MS = 7000;

const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

/** Validates an incoming payload; null when it is not a usable cursor. */
export function sanitizeCursor(payload) {
  const lat = Number(payload?.lat);
  const lng = Number(payload?.lng);
  const userId = typeof payload?.u === "string" ? payload.u.slice(0, 64) : "";
  if (!userId || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    userId,
    lat: Math.max(-90, Math.min(90, lat)),
    lng: wrapLng(lng),
  };
}

/** Great-circle-ish distance in degrees, good enough for throttling. */
export function angularDistanceDeg(a, b) {
  const dLat = a.lat - b.lat;
  const dLng = wrapLng(a.lng - b.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

/** Throttle decision for the sender. */
export function shouldSendCursor(last, next, now) {
  if (!next) return false;
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed < CURSOR_SEND_INTERVAL_MS) return false;
  if (elapsed >= CURSOR_HEARTBEAT_MS) return true;
  return angularDistanceDeg(last, next) >= CURSOR_MIN_MOVE_DEG;
}

const toUnit = ({ lat, lng }) => {
  const phi = (lat * Math.PI) / 180;
  const lam = (lng * Math.PI) / 180;
  return [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)];
};

/** Spherical interpolation between two lat/lng points (shortest path). */
export function slerpLatLng(a, b, t) {
  if (t >= 1) return { lat: b.lat, lng: b.lng };
  if (t <= 0) return { lat: a.lat, lng: a.lng };
  const p = toUnit(a);
  const q = toUnit(b);
  const dot = Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return { lat: b.lat, lng: b.lng };
  const s = Math.sin(omega);
  const k1 = Math.sin((1 - t) * omega) / s;
  const k2 = Math.sin(t * omega) / s;
  const v = [0, 1, 2].map((i) => p[i] * k1 + q[i] * k2);
  return {
    lat: (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI,
    lng: (Math.atan2(v[1], v[0]) * 180) / Math.PI,
  };
}

/** Frame-rate independent easing factor (≈ 90 % of the way in ~0.3 s). */
export const easeFactor = (dtMs, reducedMotion) =>
  reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, dtMs) / 130);

/**
 * Last known cursor per opponent. `receive` ignores the local player and
 * anyone who is not in the match; `visible` drops stale cursors.
 */
export function createCursorStore() {
  let cursors = {};
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  return {
    receive(payload, { selfId, playerIds, now = Date.now() }) {
      const cursor = sanitizeCursor(payload);
      if (!cursor || cursor.userId === selfId) return false;
      if (playerIds && !playerIds.has(cursor.userId)) return false;
      cursors = { ...cursors, [cursor.userId]: { ...cursor, at: now } };
      emit();
      return true;
    },
    visible(now = Date.now()) {
      return Object.values(cursors).filter((c) => now - c.at < CURSOR_STALE_MS);
    },
    clear() {
      cursors = {};
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Shared store: the match channel writes, the globe layer reads. */
export const conquestCursorStore = createCursorStore();
