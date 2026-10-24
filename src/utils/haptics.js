import { GLOBE_MAX_ALTITUDE, GLOBE_MIN_ALTITUDE } from "../globe/render/globeAltitude";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export const ZOOM_HAPTIC_DETENTS = 28;
const ZOOM_HAPTIC_COOLDOWN_MS = 38;
export const ZOOM_HAPTIC_TICK_MS = 16;
export const ZOOM_HAPTIC_BOUNDARY_MS = 26;
const ZOOM_HAPTIC_ACTIVE_WINDOW_MS = 240;
const ZOOM_PINCH_STEP_PX = 14;
const ZOOM_WHEEL_STEP_DELTA = 36;

const BOUNDARY_EPS = 0.004;

let sharedAudioCtx = null;
let iosHapticLabel = null;

function ensureIosHapticSwitch() {
  if (typeof document === "undefined" || !document.body) return null;
  if (iosHapticLabel && iosHapticLabel.isConnected) return iosHapticLabel;
  try {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText =
      "position:fixed;top:-99px;left:-99px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);
    document.body.appendChild(label);
    iosHapticLabel = label;
    return label;
  } catch {
    return null;
  }
}

function triggerIosSwitchHaptic() {
  const label = ensureIosHapticSwitch();
  if (!label) return false;
  try {
    label.click();
    return true;
  } catch {
    return false;
  }
}

export function primeHapticsOnUserGesture() {
  if (typeof window === "undefined") return;
  ensureIosHapticSwitch();
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(0);
    } catch {}
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    sharedAudioCtx ||= new AudioCtx();
    if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume().catch(() => {});
  } catch {}
}

function playTactileAudioTick(isBoundary = false) {
  if (typeof window === "undefined") return false;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return false;
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    if (sharedAudioCtx.state !== "running") return false;
    const now = sharedAudioCtx.currentTime;
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(isBoundary ? 150 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(isBoundary ? 54 : 44, now + 0.0055);
    gain.gain.setValueAtTime(isBoundary ? 0.032 : 0.022, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.006);
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.0065);
    return true;
  } catch {
    return false;
  }
}

/**
 * Maps an altitude in [minAltitude, maxAltitude] to a discrete logarithmic detent
 * index in [0, detents] so equal perceptual zoom steps trigger uniform tactile ticks.
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
 * Triggers a subtle haptic pulse via navigator.vibrate (Android), iOS 17.4+ switch
 * Taptic Engine fallback (iPhone Safari), and WebAudio tactile micro-click.
 */
function tryNativeVibrate(nav, durationMs) {
  if (!nav || typeof nav.vibrate !== "function") return triggerIosSwitchHaptic();
  try {
    return Boolean(nav.vibrate(durationMs));
  } catch {
    return false;
  }
}

export function triggerSubtleHapticTick(
  durationMs = ZOOM_HAPTIC_TICK_MS,
  nav = typeof navigator !== "undefined" ? navigator : null
) {
  if (prefersReducedMotion()) return false;
  const vibrated = tryNativeVibrate(nav, durationMs);
  const audioClicked = playTactileAudioTick(durationMs >= ZOOM_HAPTIC_BOUNDARY_MS);
  return vibrated || audioClicked;
}

/**
 * Stateful tracker for globe zoom detents.
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
  let lastPinchBucket = null;
  let wheelAccum = 0;

  return {
    markZoomGesture(now = performance.now()) {
      activeUntil = Math.max(activeUntil, now + activeWindowMs);
    },
    clearZoomGesture() {
      activeUntil = -Infinity;
      lastDetent = null;
      lastBoundary = null;
      lastPinchBucket = null;
      wheelAccum = 0;
    },
    onPinchDistance(distancePx, { now = performance.now(), stepPx = ZOOM_PINCH_STEP_PX } = {}) {
      if (!Number.isFinite(distancePx) || distancePx <= 0 || stepPx <= 0) {
        return { pulsed: false, reason: "invalid-distance" };
      }
      activeUntil = Math.max(activeUntil, now + activeWindowMs);
      const bucket = Math.floor(distancePx / stepPx);
      if (lastPinchBucket === null) {
        lastPinchBucket = bucket;
        return { pulsed: false, reason: "seeded", bucket };
      }
      if (bucket === lastPinchBucket) {
        return { pulsed: false, reason: "same-bucket", bucket };
      }
      lastPinchBucket = bucket;
      if (now - lastPulseAt < cooldownMs) {
        return { pulsed: false, reason: "cooldown", bucket };
      }
      lastPulseAt = now;
      const ok = vibrate(ZOOM_HAPTIC_TICK_MS);
      return { pulsed: Boolean(ok), duration: ZOOM_HAPTIC_TICK_MS, bucket };
    },
    onWheelDelta(deltaY, { now = performance.now(), stepDelta = ZOOM_WHEEL_STEP_DELTA } = {}) {
      if (!Number.isFinite(deltaY) || deltaY === 0 || stepDelta <= 0) {
        return { pulsed: false, reason: "invalid-delta" };
      }
      activeUntil = Math.max(activeUntil, now + activeWindowMs);
      wheelAccum += Math.abs(deltaY);
      if (wheelAccum < stepDelta) {
        return { pulsed: false, reason: "accumulating" };
      }
      wheelAccum %= stepDelta;
      if (now - lastPulseAt < cooldownMs) {
        return { pulsed: false, reason: "cooldown" };
      }
      lastPulseAt = now;
      const ok = vibrate(ZOOM_HAPTIC_TICK_MS);
      return { pulsed: Boolean(ok), duration: ZOOM_HAPTIC_TICK_MS };
    },
    onAltitudeChange(
      altitude,
      {
        now = performance.now(),
        minAltitude = GLOBE_MIN_ALTITUDE,
        maxAltitude = GLOBE_MAX_ALTITUDE,
      } = {}
    ) {
      const detent = computeZoomDetentIndex(altitude, { minAltitude, maxAltitude, detents });
      if (detent === null) return { pulsed: false, detent: null };

      if (now > activeUntil) {
        lastDetent = detent;
        lastBoundary = null;
        return { pulsed: false, detent, reason: "inactive" };
      }

      if (lastDetent === null) {
        lastDetent = detent;
        return { pulsed: false, detent, reason: "seeded" };
      }

      const atMin = altitude <= minAltitude + BOUNDARY_EPS;
      const atMax = altitude >= maxAltitude - BOUNDARY_EPS;
      const boundary = atMin ? "min" : atMax ? "max" : null;

      const isNewBoundary = Boolean(boundary && boundary !== lastBoundary);
      if (isNewBoundary) {
        lastBoundary = boundary;
        lastDetent = detent;
      }
      if (isNewBoundary && now - lastPulseAt < cooldownMs) {
        return { pulsed: false, detent, boundary, reason: "cooldown" };
      }
      if (isNewBoundary) {
        lastPulseAt = now;
        const ok = vibrate(ZOOM_HAPTIC_BOUNDARY_MS);
        return { pulsed: Boolean(ok), detent, boundary, duration: ZOOM_HAPTIC_BOUNDARY_MS };
      }

      if (!boundary) {
        lastBoundary = null;
      }

      if (detent === lastDetent) {
        return { pulsed: false, detent, reason: "same-detent" };
      }

      lastDetent = detent;
      if (now - lastPulseAt < cooldownMs) {
        return { pulsed: false, detent, reason: "cooldown" };
      }

      lastPulseAt = now;
      const ok = vibrate(ZOOM_HAPTIC_TICK_MS);
      return { pulsed: Boolean(ok), detent, duration: ZOOM_HAPTIC_TICK_MS };
    },
  };
}
