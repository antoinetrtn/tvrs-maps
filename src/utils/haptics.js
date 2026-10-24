import { GLOBE_MAX_ALTITUDE, GLOBE_MIN_ALTITUDE } from "../globe/render/globeAltitude";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export const ZOOM_HAPTIC_DETENTS = 64;
// Sub-resonance micro-impulse calibration for Android LRA/ERM motors:
// Driving the actuator for 4ms (< 1 half-cycle at ~170Hz resonance) imparts a crisp,
// feather-light mechanical detent ("watch crown" feel) instead of a full-scale buzz,
// and lets Blink VibrationController finish timer_do_vibrate_ in 4ms so closely-spaced
// detents (26ms cooldown, 6px pinch step, 64 log detents) never self-cancel.
const ZOOM_HAPTIC_COOLDOWN_MS = 26;
export const ZOOM_HAPTIC_TICK_MS = 1;
export const ZOOM_HAPTIC_BOUNDARY_MS = 3;
const ZOOM_HAPTIC_ACTIVE_WINDOW_MS = 280;
const ZOOM_PINCH_STEP_PX = 6;
const ZOOM_WHEEL_STEP_DELTA = 16;
const MIN_NATIVE_VIBRATE_INTERVAL_MS = 22;

const BOUNDARY_EPS = 0.004;

let sharedAudioCtx = null;
let iosHapticLabel = null;
let lastNativeVibrateAt = -Infinity;

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
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    sharedAudioCtx ||= new AudioCtx();
    if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume().catch(() => {});
  } catch {}
}

function ensureRunningAudioCtx() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  sharedAudioCtx ||= new AudioCtx();
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx.state === "running" ? sharedAudioCtx : null;
}

function playTactileAudioTick(isBoundary = false) {
  try {
    const ctx = ensureRunningAudioCtx();
    if (!ctx) return false;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(isBoundary ? 140 : 115, now);
    osc.frequency.exponentialRampToValueAtTime(isBoundary ? 52 : 42, now + 0.0022);
    gain.gain.setValueAtTime(isBoundary ? 0.006 : 0.003, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.0024);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.0026);
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
 * Taptic Engine fallback (iPhone Safari), or WebAudio tactile micro-click fallback.
 */
function tryNativeVibrate(nav, durationMs) {
  if (!nav || typeof nav.vibrate !== "function") return triggerIosSwitchHaptic();
  if (
    typeof nav.userActivation === "object" &&
    nav.userActivation &&
    !nav.userActivation.hasBeenActive
  ) {
    return false;
  }
  const isGlobalNavigator = typeof navigator !== "undefined" && nav === navigator;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (isGlobalNavigator && now - lastNativeVibrateAt < MIN_NATIVE_VIBRATE_INTERVAL_MS) {
    return true;
  }
  try {
    const ok = Boolean(nav.vibrate(durationMs));
    if (ok && isGlobalNavigator) {
      lastNativeVibrateAt = now;
    }
    return ok;
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
  // Always run the ultra-short 8ms low-frequency tactile audio tick alongside native vibrate:
  // on Android devices where OS Touch feedback / Ringer / Battery Saver silences the physical
  // vibrator despite navigator.vibrate() returning true, the tactile click still gives feedback.
  const audioClicked = playTactileAudioTick(durationMs >= ZOOM_HAPTIC_BOUNDARY_MS);
  return Boolean(vibrated || audioClicked);
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
        isZoomGesture = false,
        minAltitude = GLOBE_MIN_ALTITUDE,
        maxAltitude = GLOBE_MAX_ALTITUDE,
      } = {}
    ) {
      if (isZoomGesture) {
        activeUntil = Math.max(activeUntil, now + activeWindowMs);
      }
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

      const safeMin = Math.max(0.01, minAltitude);
      const safeMax = Math.max(safeMin + 0.01, maxAltitude);
      const atMin = altitude <= safeMin + BOUNDARY_EPS;
      const atMax = altitude >= safeMax - BOUNDARY_EPS;
      const boundary = atMin ? "min" : atMax ? "max" : null;

      const isNewBoundary = Boolean(boundary && boundary !== lastBoundary);
      if (isNewBoundary) {
        lastBoundary = boundary;
        lastDetent = detent;
      }
      if (isNewBoundary && now - lastPulseAt < cooldownMs * 0.75) {
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
