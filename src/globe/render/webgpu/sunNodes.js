/**
 * Shared TSL sun/terminator helpers (camera-relative oblique headlight).
 * Parity with GLSL sunNdotL / dayAmt / sunLightMod in globeShaders.js + ocean.
 */
import { clamp, dot, float, mix, normalize, smoothstep } from "three/tsl";

import { polygonGlitchUniforms } from "../polygonGlitchShader";
import { mirrorUniform } from "./tslCommon";

let sunDirNode = null;
let oceanSunDirNode = null;

export function getSunDirNode() {
  return (sunDirNode ||= mirrorUniform(polygonGlitchUniforms.uSunDir));
}

export function getOceanSunDirNode() {
  return (oceanSunDirNode ||= mirrorUniform(polygonGlitchUniforms.uSunDir));
}

/** Land terminator: dayAmt 0..1 and light multiplier for baseLit / sides. */
export function landSunMods(sphereNormal, uSunDirNode = getSunDirNode()) {
  const sunNdotL = clamp(dot(sphereNormal, normalize(uSunDirNode)), -1.0, 1.0);
  const dayAmt = smoothstep(float(-0.08), float(0.18), sunNdotL);
  const sunLightMod = mix(float(0.82), float(1.12), dayAmt);
  return { dayAmt, sunLightMod };
}

/** Ocean terminator multiplier applied to base sea luminance. */
export function oceanSunMultiplier(sphereDir, uSunDirNode = getOceanSunDirNode()) {
  const sunNdotL = clamp(dot(sphereDir, normalize(uSunDirNode)), -1.0, 1.0);
  const dayAmt = smoothstep(float(-0.08), float(0.18), sunNdotL);
  return mix(float(0.82), float(1.14), dayAmt);
}
