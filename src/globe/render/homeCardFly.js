import { prefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { polygonGlitchUniforms } from "./polygonGlitchShader";

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Default blend matches CAMERA_MS.home so the look eases with the fly. */
export const REGIONAL_MODE_BLEND_MS = 550;

let flyUntil = 0;

export function beginHomeCardFly(durationMs = 0) {
  flyUntil = durationMs > 0 ? nowMs() + durationMs : 0;
}

export function isHomeCardFlyActive() {
  return flyUntil > nowMs();
}

let blendFrom = 0;
let blendTo = 0;
let blendStart = 0;
let blendDur = 0;

export function setRegionalModeTarget(
  on,
  { instant = false, durationMs = REGIONAL_MODE_BLEND_MS } = {}
) {
  const target = on ? 1 : 0;
  const snap = instant || durationMs <= 0 || prefersReducedMotion();
  if (snap) {
    blendFrom = target;
    blendTo = target;
    blendDur = 0;
    polygonGlitchUniforms.uIsRegionalMode.value = target;
    return;
  }
  const current = Number(polygonGlitchUniforms.uIsRegionalMode.value) || 0;
  if (Math.abs(current - target) < 0.001) {
    blendTo = target;
    blendDur = 0;
    return;
  }
  // Already easing toward this target — don't restart the clock on every material request.
  if (target === blendTo && blendDur > 0) return;
  blendFrom = current;
  blendTo = target;
  blendStart = nowMs();
  blendDur = durationMs;
}

export function stepRegionalModeUniform() {
  if (blendDur <= 0) return polygonGlitchUniforms.uIsRegionalMode.value;
  const t = Math.min(1, (nowMs() - blendStart) / blendDur);
  const eased = t < 0.5 ? 2 * t * t : 1 - ((2 - 2 * t) * (2 - 2 * t)) / 2;
  const value = blendFrom + (blendTo - blendFrom) * eased;
  polygonGlitchUniforms.uIsRegionalMode.value = value;
  if (t >= 1) blendDur = 0;
  return value;
}

export function getRegionalModeUniform() {
  return Number(polygonGlitchUniforms.uIsRegionalMode.value) || 0;
}
