import { GLITCH_EFFECT_SETTINGS } from "../../config/designSystem";

export const FOUND_SURFACE_GREEN = GLITCH_EFFECT_SETTINGS.foundGreenSurface;

/** Matches shader vec3(0.176, 1.0, 0.659) at noisyIntensity = 1. */
const FOUND_CAP_EMISSIVE_INTENSITY = 1.0;

export function getFoundCapEmissiveIntensity() {
  return FOUND_CAP_EMISSIVE_INTENSITY;
}
