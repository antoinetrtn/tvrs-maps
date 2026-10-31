// TSL helpers for the progressive discovery reveal (parity with globeShaders.js grain body).
import { clamp, float, max, mix, step, texture, vec3 } from "three/tsl";

import { getCapitalLightsTexture } from "../capitalLightsTexture";
import { DISCOVERY } from "../discoveryTimeline";
import { SELECT_CITY_ALPHA_VALUE, SELECT_CITY_AMBER_RGB } from "../globeShaders";

// Found land (solo tone or Conquête player colour) follows the discovery reveal mask.
export function revealLand(
  paletteLand,
  landMask,
  isAwakenedCap,
  { parallelLine, crossTick, rimSheen, limbFactor }
) {
  const landSurface = mix(
    vec3(...DISCOVERY.DARK_LAND_RGB),
    paletteLand,
    mix(float(1.0), landMask, isAwakenedCap)
  );
  const engrave = landSurface
    .mul(parallelLine.mul(0.04).add(crossTick.mul(0.09)))
    .add(vec3(rimSheen));
  return { landSurface, baseLit: landSurface.mul(limbFactor).add(engrave) };
}

// Discovery amber accents: dim lanterns ahead of the ignition front, halo ring on the
// cap and amber outline/halo on the side walls (GLSL parity).
export function applyDiscoveryAmber({
  capRgb,
  landSurface,
  ign,
  isAwakenedCap,
  uRegionalNode,
  cartUv,
  isSideWall,
}) {
  // Ahead of the front the found country's city pixels keep their dim selection glow
  // (GLSL parity), so the ignition only brightens them.
  const preLit = isAwakenedCap
    .mul(float(1.0).sub(ign.igniteMask))
    .mul(float(1.0).sub(uRegionalNode))
    .mul(step(0.25, texture(getCapitalLightsTexture(), cartUv).r));
  const lanternCap = mix(
    capRgb,
    vec3(...SELECT_CITY_AMBER_RGB),
    preLit.mul(SELECT_CITY_ALPHA_VALUE)
  );
  const litCap = mix(
    lanternCap,
    vec3(...SELECT_CITY_AMBER_RGB),
    ign.haloBand.mul(isAwakenedCap).mul(DISCOVERY.HALO_ALPHA)
  );
  const sideRgb = mix(
    landSurface.mul(0.58),
    vec3(...SELECT_CITY_AMBER_RGB),
    max(ign.haloAmt, ign.outlineAmt).mul(isAwakenedCap)
  );
  return mix(litCap, sideRgb, isSideWall);
}

// Found cap power for a reveal mask (cities: ignite mask, relief/rivers: land mask).
export function wakePower(mask, { isAwakenedCap, showcaseNow, isUnfoundDarkCap, ghostMask }) {
  return clamp(max(isAwakenedCap.mul(mask), showcaseNow.mul(isUnfoundDarkCap)), 0.0, 1.0).mul(
    ghostMask
  );
}
