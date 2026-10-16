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

const COUNTRY_ID_MAX = 64;

/** Optional selected-country id (`c`); absent / empty / non-string → null. */
export function sanitizeCountryId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim().slice(0, COUNTRY_ID_MAX);
  return id || null;
}

/**
 * Validates an incoming payload; null when it is not a usable cursor.
 * `c` (selected country) is optional: messages from older clients simply
 * have no country, and older clients ignore the extra field.
 */
export function sanitizeCursor(payload) {
  const lat = Number(payload?.lat);
  const lng = Number(payload?.lng);
  const userId = typeof payload?.u === "string" ? payload.u.slice(0, 64) : "";
  if (!userId || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const country = sanitizeCountryId(payload?.c);
  return {
    userId,
    lat: Math.max(-90, Math.min(90, lat)),
    lng: wrapLng(lng),
    ...(country ? { country } : {}),
  };
}

/** Great-circle-ish distance in degrees, good enough for throttling. */
export function angularDistanceDeg(a, b) {
  const dLat = a.lat - b.lat;
  const dLng = wrapLng(a.lng - b.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

/**
 * Throttle decision for the sender. A change of selected country is sent as
 * soon as the rate limit allows, even if the camera did not move.
 */
export function shouldSendCursor(last, next, now) {
  if (!next) return false;
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed < CURSOR_SEND_INTERVAL_MS) return false;
  if (elapsed >= CURSOR_HEARTBEAT_MS) return true;
  if ((last.country || null) !== (next.country || null)) return true;
  return angularDistanceDeg(last, next) >= CURSOR_MIN_MOVE_DEG;
}

/** Payload for the `cursor` broadcast (country only when there is one). */
export function buildCursorPayload(userId, { lat, lng, country }) {
  const id = sanitizeCountryId(country);
  return {
    u: userId,
    lat: Number(lat.toFixed(3)),
    lng: Number(lng.toFixed(3)),
    ...(id ? { c: id } : {}),
  };
}

export const toUnit = ({ lat, lng }) => {
  const phi = (lat * Math.PI) / 180;
  const lam = (lng * Math.PI) / 180;
  return [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)];
};

export const fromUnit = (v) => ({
  lat: (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI,
  lng: (Math.atan2(v[1], v[0]) * 180) / Math.PI,
});

const normalize3 = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= n;
  v[1] /= n;
  v[2] /= n;
  return v;
};

/** Network samples closer than this say nothing reliable about the speed. */
const VELOCITY_MIN_DT_MS = 60;
/** Beyond this gap the player stopped: no inertia carried over. */
const VELOCITY_MAX_DT_MS = 1500;
/** Cap (rad/s): a flick of the globe, not a teleport. */
const VELOCITY_MAX_RAD_S = 6;
/** How far ahead of the last sample the target may be extrapolated (ms). */
export const EXTRAPOLATE_MAX_MS = 260;

/**
 * Angular velocity of the gaze point (unit-vector units per second) from two
 * consecutive samples; `previous` is returned when the samples are too close
 * to tell, zeros when they are too far apart.
 */
export function velocityBetween(a, b, previous = [0, 0, 0]) {
  const dt = b.at - a.at;
  if (dt < VELOCITY_MIN_DT_MS) return previous;
  if (dt > VELOCITY_MAX_DT_MS) return [0, 0, 0];
  const p = toUnit(a);
  const q = toUnit(b);
  const v = [0, 1, 2].map((i) => ((q[i] - p[i]) / dt) * 1000);
  const speed = Math.hypot(v[0], v[1], v[2]);
  if (speed > VELOCITY_MAX_RAD_S) return v.map((c) => (c / speed) * VELOCITY_MAX_RAD_S);
  return v;
}

/**
 * Where the opponent most likely is now: the last sample pushed forward by its
 * velocity, fading out so a stopped globe does not drift (unit vector).
 */
export function extrapolateTarget(sample, ageMs) {
  const base = toUnit(sample);
  const vel = sample.vel;
  if (!vel) return base;
  const t = Math.min(Math.max(ageMs, 0), EXTRAPOLATE_MAX_MS);
  // Ease-out: the push saturates instead of growing linearly.
  const push = (t / 1000) * (1 - t / (2 * EXTRAPOLATE_MAX_MS));
  return normalize3([base[0] + vel[0] * push, base[1] + vel[1] * push, base[2] + vel[2] * push]);
}

/** Spring: ≈ 4.5 % overshoot, settles in ~0.35 s. Pure maths, no THREE. */
const SPRING_OMEGA = 15; // rad/s
const SPRING_ZETA = 0.72;
const SPRING_STEP_MS = 8;
const SPRING_MAX_FRAME_MS = 64;
/** Reduced motion: near-direct follow, no velocity, no overshoot. */
const REDUCED_FOLLOW_MS = 45;

/**
 * Smooth follower for one opponent's gaze point. `step` is called every
 * display frame with the (network-rate) target: damped spring on the unit
 * sphere, so the cursor glides with a little inertia and overshoot between
 * the ~7 messages/s instead of stepping.
 */
export function createCursorMotion(start) {
  const pos = toUnit(start);
  const vel = [0, 0, 0];

  /** Near-direct follow (reduced motion): no velocity, no overshoot. */
  const follow = (dt, target) => {
    const k = 1 - Math.exp(-dt / REDUCED_FOLLOW_MS);
    for (let i = 0; i < 3; i++) pos[i] += (target[i] - pos[i]) * k;
    vel.fill(0);
  };

  /** Damped spring, integrated in small fixed sub-steps (stable at any frame rate). */
  const spring = (dt, target) => {
    for (let left = dt; left > 0; left -= SPRING_STEP_MS) {
      const h = Math.min(left, SPRING_STEP_MS) / 1000;
      for (let i = 0; i < 3; i++) {
        const pull = SPRING_OMEGA * SPRING_OMEGA * (target[i] - pos[i]);
        vel[i] += (pull - 2 * SPRING_ZETA * SPRING_OMEGA * vel[i]) * h;
        pos[i] += vel[i] * h;
      }
    }
  };

  return {
    step(dtMs, target, { reduced = false } = {}) {
      const dt = Math.min(Math.max(dtMs, 0), SPRING_MAX_FRAME_MS);
      if (reduced) follow(dt, target);
      else spring(dt, target);
      normalize3(pos);
      return fromUnit(pos);
    },
    unit: () => pos,
  };
}

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
      const before = cursors[cursor.userId];
      const next = { ...cursor, at: now, vel: [0, 0, 0] };
      // Inertia source for the receiver-side smoothing (no extra payload).
      if (before) next.vel = velocityBetween(before, next, before.vel);
      cursors = { ...cursors, [cursor.userId]: next };
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
