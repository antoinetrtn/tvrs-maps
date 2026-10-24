import { GLOBE_MAX_ALTITUDE, GLOBE_MIN_ALTITUDE } from "../globe/render/globeAltitude";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export const ZOOM_HAPTIC_DETENTS = 16;
const ZOOM_HAPTIC_COOLDOWN_MS = 50;
export const ZOOM_HAPTIC_TICK_MS = 2;
export const ZOOM_HAPTIC_BOUNDARY_MS = 5;
const ZOOM_HAPTIC_ACTIVE_WINDOW_MS = 240;

const BOUNDARY_EPS = 0.004;

/**
 * Maps an altitude in [minAltitude, maxAltitude] to a discrete logarithmic detent
 * index in [0, detents] so equal perceptual zoom steps trigger uniform tactile ticks
 * (like sliding a control in Figma).
 */
export function computeZoomDetentIndex(
  altitude,
  {
    minAltitude = GLOBE_MIN_ALTITUDE,
    maxAltitude = GLOBE_MAX_ALTITUDE,
    detents = ZOOM_HAPTIC_DETENTS,
  } = {}
) {
  if (!Number.isFinite(altitude) || detents <= 0) return null;
  const safeMin = Math.max(0.01, minAltitude);
  const safeMax = Math.max(safeMin + 0.01, maxAltitude);
  const clamped = Math.max(safeMin, Math.min(safeMax, altitude));
  const logRatio = Math.log(clamped / safeMin) / Math.log(safeMax / safeMin);
  return Math.max(0, Math.min(detents, Math.round(logRatio * detents)));
}

/**
 * Triggers a very subtle haptic micro-pulse via navigator.vibrate when supported
 * and when prefers-reduced-motion is not active.
 */
export function triggerSubtleHapticTick(
  durationMs = ZOOM_HAPTIC_TICK_MS,
  nav = typeof navigator !== "undefined" ? navigator : null
) {
  if (prefersReducedMotion()) return false;
  if (!nav || typeof nav.vibrate !== "function") return false;
  try {
    return Boolean(nav.vibrate(durationMs));
  } catch {
    return false;
  }
}

/**
 * Stateful tracker for globe zoom detents. Only fires during an active user zoom
 * gesture (wheel / trackpad pinch / 2-finger touch pinch / double-tap zoom drag),
 * never during 1-finger pan/rotation or programmatic pointOfView camera animations.
 */
export function createZoomHapticTracker({
  detents = ZOOM_HAPTIC_DETENTS,
  cooldownMs = ZOOM_HAPTIC_COOLDOWN_MS,
  activeWindowMs = ZOOM_HAPTIC_ACTIVE_WINDOW_MS,
  vibrate = triggerSubtleHapticTick,
} = {}) {
  let lastDetent = null;
  let lastBoundary = null;
  let lastPulseAt = -Infinity;
  let activeUntil = -Infinity;

  return {
    markZoomGesture(now = performance.now()) {
      activeUntil = Math.max(activeUntil, now + activeWindowMs);
    },
    clearZoomGesture() {
      activeUntil = -Infinity;
      lastDetent = null;
      lastBoundary = null;
    },
    onAltitudeChange(
      altitude,
      {
        now = performance.now(),
        isZoomGesture = false,
        minAltitude = GLOBE_MIN_ALTITUDE,
        maxAltitude = GLOBE_MAX_ALTITUDE,
      } = {}
    ) {
      if (!Number.isFinite(altitude)) return { pulsed: false, reason: "invalid-altitude" };
      if (isZoomGesture) {
        activeUntil = Math.max(activeUntil, now + activeWindowMs);
      }
      const gestureActive = isZoomGesture || now <= activeUntil;
      const detent = computeZoomDetentIndex(altitude, { minAltitude, maxAltitude, detents });
      if (!gestureActive) {
        lastDetent = detent;
        lastBoundary = null;
        return { pulsed: false, reason: "inactive", detent };
      }

      const atMin = altitude <= minAltitude + BOUNDARY_EPS;
      const atMax = altitude >= maxAltitude - BOUNDARY_EPS;
      const boundary = atMin ? "min" : atMax ? "max" : null;

      if (lastDetent === null) {
        lastDetent = detent;
        lastBoundary = boundary;
        return { pulsed: false, reason: "seeded", detent };
      }

      const crossedBoundary = boundary !== null && boundary !== lastBoundary;
      const crossedDetent = detent !== lastDetent;
      lastDetent = detent;
      lastBoundary = boundary;

      if (!crossedBoundary && !crossedDetent) {
        return { pulsed: false, reason: "same-detent", detent };
      }

      if (now - lastPulseAt < cooldownMs) {
        return { pulsed: false, reason: "cooldown", detent };
      }

      lastPulseAt = now;
      const duration = crossedBoundary ? ZOOM_HAPTIC_BOUNDARY_MS : ZOOM_HAPTIC_TICK_MS;
      const ok = vibrate(duration);
      return {
        pulsed: Boolean(ok),
        duration,
        boundary,
        detent,
      };
    },
  };
}
