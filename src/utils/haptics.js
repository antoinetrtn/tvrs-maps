import { GLOBE_MAX_ALTITUDE, GLOBE_MIN_ALTITUDE } from "../globe/render/globeAltitude";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export const ZOOM_HAPTIC_DETENTS = 64;
// Sub-resonance micro-impulse calibration for Android LRA/ERM motors:
// Driving the actuator for 4ms (< 1 half-cycle at ~170Hz resonance) imparts a crisp,
// feather-light mechanical detent ("watch crown" feel) instead of a full-scale buzz,
// and lets Blink VibrationController finish timer_do_vibrate_ in 4ms so closely-spaced
// detents (26ms cooldown, 6px pinch step, 64 log detents) never self-cancel.
export const ZOOM_HAPTIC_TICK_MS = 1;
const ZOOM_HAPTIC_BOUNDARY_MS = 3;
// Zoom limit "end stop": 28ms buzz, short gap, 14ms echo (~double knock).
export const ZOOM_LIMIT_HAPTIC_PATTERN = [28, 40, 14];
const ZOOM_HAPTIC_ACTIVE_WINDOW_MS = 280;
const MIN_NATIVE_VIBRATE_INTERVAL_MS = 22;

const BOUNDARY_EPS = 0.004;

let sharedAudioCtx = null;
let iosHapticLabel = null;
let lastNativeVibrateAt = -Infinity;
let lastSelectionAt = -Infinity;

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

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
function tryNativeVibrate(nav, durationMs, { force = false } = {}) {
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
  if (!force && isGlobalNavigator && now - lastNativeVibrateAt < MIN_NATIVE_VIBRATE_INTERVAL_MS) {
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
  nav = typeof navigator !== "undefined" ? navigator : null,
  { force = false } = {}
) {
  if (prefersReducedMotion()) return false;
  const vibrated = tryNativeVibrate(nav, durationMs, { force });
  // Always run the ultra-short 8ms low-frequency tactile audio tick alongside native vibrate:
  // on Android devices where OS Touch feedback / Ringer / Battery Saver silences the physical
  // vibrator despite navigator.vibrate() returning true, the tactile click still gives feedback.
  const audioClicked = playTactileAudioTick(durationMs >= ZOOM_HAPTIC_BOUNDARY_MS);
  return Boolean(vibrated || audioClicked);
}

/**
 * Stateful tracker for globe zoom haptics.
 *
 * Zooming itself (pinch, wheel, double-tap-drag) is silent: no detent ticks.
 * A single firm pulse fires when the zoom ARRIVES at the min or max altitude
 * limit. It fires once per arrival and re-arms only after the altitude leaves
 * the limit, so repeated wheel/pinch against the stop never spams.
 */
export function createZoomHapticTracker({
  activeWindowMs = ZOOM_HAPTIC_ACTIVE_WINDOW_MS,
  vibrate = triggerZoomLimitHaptic,
} = {}) {
  let lastBoundary = null;
  let activeUntil = -Infinity;

  const mark = (now) => {
    activeUntil = Math.max(activeUntil, now + activeWindowMs);
  };

  return {
    markZoomGesture(now = nowMs()) {
      mark(now);
    },
    clearZoomGesture() {
      // Keep lastBoundary: lifting fingers at the stop must not re-arm it.
      activeUntil = -Infinity;
    },
    onPinchDistance(distancePx, { now = nowMs() } = {}) {
      if (!Number.isFinite(distancePx) || distancePx <= 0) {
        return { pulsed: false, reason: "invalid-distance" };
      }
      mark(now);
      return { pulsed: false, reason: "silent-zoom" };
    },
    onWheelDelta(deltaY, { now = nowMs() } = {}) {
      if (!Number.isFinite(deltaY) || deltaY === 0) {
        return { pulsed: false, reason: "invalid-delta" };
      }
      mark(now);
      return { pulsed: false, reason: "silent-zoom" };
    },
    onAltitudeChange(
      altitude,
      {
        now = nowMs(),
        isZoomGesture = false,
        minAltitude = GLOBE_MIN_ALTITUDE,
        maxAltitude = GLOBE_MAX_ALTITUDE,
      } = {}
    ) {
      if (!Number.isFinite(altitude)) return { pulsed: false, boundary: null };
      if (isZoomGesture) mark(now);
      const safeMin = Math.max(0.01, minAltitude);
      const safeMax = Math.max(safeMin + 0.01, maxAltitude);
      const boundary =
        altitude <= safeMin + BOUNDARY_EPS
          ? "min"
          : altitude >= safeMax - BOUNDARY_EPS
            ? "max"
            : null;

      if (!boundary) {
        lastBoundary = null; // left the limit: re-arm
        return { pulsed: false, boundary: null, reason: "silent-zoom" };
      }
      if (boundary === lastBoundary) {
        return { pulsed: false, boundary, reason: "already-at-limit" };
      }
      lastBoundary = boundary;
      if (now > activeUntil) {
        // Programmatic camera moves (tweens) reach limits silently.
        return { pulsed: false, boundary, reason: "inactive" };
      }
      const ok = vibrate();
      return { pulsed: Boolean(ok), boundary, pattern: ZOOM_LIMIT_HAPTIC_PATTERN };
    },
  };
}

/**
 * Firm "end stop" pulse when the zoom hits its min/max limit: clearly stronger
 * than the 1-10ms ticks used elsewhere. Bypasses the native throttle.
 */
export function triggerZoomLimitHaptic(nav = typeof navigator !== "undefined" ? navigator : null) {
  if (prefersReducedMotion()) return false;
  const vibrated = tryNativeVibrate(nav, ZOOM_LIMIT_HAPTIC_PATTERN, { force: true });
  const audioClicked = playTactileAudioTick(true);
  return Boolean(vibrated || audioClicked);
}

// Selection tick when the homepage deck lands on another mode card (swipe, keys, dots).
export const SELECTION_HAPTIC_TICK_MS = 10;
export const SELECTION_HAPTIC_COOLDOWN_MS = 90;

/**
 * Light 10ms tick, throttled only against previous card changes (fast swipes).
 * It must NOT be swallowed by the 1ms button tick that precedes it when the
 * change comes from a deck arrow: that tick is imperceptible on most Android
 * motors, so the 10ms selection tick overrides it (vibrate() replaces the
 * running pattern).
 */
export function triggerSelectionHaptic(
  nav = typeof navigator !== "undefined" ? navigator : null,
  now = nowMs()
) {
  if (now - lastSelectionAt < SELECTION_HAPTIC_COOLDOWN_MS) return false;
  const ok = triggerSubtleHapticTick(SELECTION_HAPTIC_TICK_MS, nav, { force: true });
  if (ok) lastSelectionAt = now;
  return ok;
}

export function resetHapticsThrottleForTests() {
  lastSelectionAt = -Infinity;
  lastNativeVibrateAt = -Infinity;
}
