import { GLOBE_MAX_ALTITUDE, GLOBE_MIN_ALTITUDE } from "../globe/render/globeAltitude";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export const ZOOM_HAPTIC_DETENTS = 28;
// In Chromium Blink (vibration_controller.cc), calling Vibrate() while is_running_ is true
// sends a Mojo Cancel() IPC to Android VibratorManagerService before scheduling the next
// pulse after a main-thread timer. A 28ms pulse + 135ms cooldown guarantees is_running_
// returns to false well before the next tick during 3D globe rendering.
const ZOOM_HAPTIC_COOLDOWN_MS = 135;
export const ZOOM_HAPTIC_TICK_MS = 28;
export const ZOOM_HAPTIC_BOUNDARY_MS = 55;
const ZOOM_HAPTIC_ACTIVE_WINDOW_MS = 280;
const ZOOM_PINCH_STEP_PX = 18;
const ZOOM_WHEEL_STEP_DELTA = 36;
const MIN_NATIVE_VIBRATE_INTERVAL_MS = 130;

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
  // On Android Chrome (where navigator.vibrate is supported), avoid opening an active
  // WebAudio AAudio output stream on every touchstart, which can suppress or mask
  // hardware vibrator pulses on Android OEM audio HALs.
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    return;
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
    osc.frequency.setValueAtTime(isBoundary ? 135 : 108, now);
    osc.frequency.exponentialRampToValueAtTime(isBoundary ? 48 : 38, now + 0.008);
    gain.gain.setValueAtTime(isBoundary ? 0.036 : 0.024, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.0085);
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.009);
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
  if (vibrated) return true;
  return playTactileAudioTick(durationMs >= ZOOM_HAPTIC_BOUNDARY_MS);
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
