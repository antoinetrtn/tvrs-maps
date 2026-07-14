import * as THREE from "three";
import { GLITCH_EFFECT_SETTINGS } from "../config/designSystem";

export const FOUND_SURFACE_GREEN = GLITCH_EFFECT_SETTINGS.foundGreenSurface;

const foundGreen = new THREE.Color(FOUND_SURFACE_GREEN);

/** Matches shader vec3(0.176, 1.0, 0.659) at noisyIntensity = 1. */
const FOUND_CAP_EMISSIVE_INTENSITY = 1.0;

/** Single DS token — cap fill, shader flash, and post-anim material. */
export function getFoundGreenThreeColor() {
  const [r, g, b] = GLITCH_EFFECT_SETTINGS.colorSuccess;
  foundGreen.setRGB(r, g, b);
  return foundGreen;
}

export function getFoundCapEmissiveIntensity() {
  return FOUND_CAP_EMISSIVE_INTENSITY;
}