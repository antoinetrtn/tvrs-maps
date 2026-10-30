/**
 * TSL twin of the GLSL "total blackout" block (globeShaders.js): unfound land turns
 * into a power-less grey derived from the base terrain colour (no hard-coded terrain
 * colours, so any biome palette stays readable under the blackout).
 */
import { float, mix, vec3 } from "three/tsl";

export function buildBlackoutLand({
  lit,
  surfaceLuma,
  uShowcaseNode,
  isUnfoundDarkCap,
  uRegionalNode,
  uGhost,
}) {
  const unlit = float(1.0).sub(uShowcaseNode).mul(isUnfoundDarkCap);
  const blackoutAmt = unlit.mul(float(1.0).sub(uRegionalNode));
  const dimTarget = mix(float(0.36), float(0.74), uRegionalNode);
  const blackoutDim = mix(mix(float(1.0), dimTarget, unlit), float(0.42), uGhost);
  const blackoutGrey = vec3(surfaceLuma).mul(vec3(0.97, 0.99, 1.03));
  const unfoundLand = mix(lit, blackoutGrey, blackoutAmt.mul(0.88)).mul(blackoutDim);
  return { blackoutAmt, blackoutDim, unfoundLand };
}

/** River tone/strength under blackout: neutral grey thread instead of blue. */
export function blackoutRiverTone(blackoutAmt) {
  const amt = blackoutAmt || float(0.0);
  return {
    tone: mix(vec3(0.08, 0.14, 0.19), vec3(0.1, 0.105, 0.11), amt),
    strength: mix(float(0.58), float(0.34), amt),
  };
}
