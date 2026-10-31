/**
 * TSL twin of the GLSL biome block in COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY
 * (globeShaders.js): same NearestFilter texture, same weights, line by line.
 */
import { dot, float, max, mix, texture, vec3 } from "three/tsl";

import { getBiomeTexture } from "../biomeTexture";

export function applyBiomePalette(p) {
  const {
    landSurface,
    cartUv,
    ndv,
    ghostMask,
    isSoloFound,
    isConquestOwned = float(0.0),
    lit,
    maxC,
    isUnfoundDarkCap,
    uShowcaseNode,
    uRegionalNode,
  } = p;
  const biomeSample = texture(getBiomeTexture(), cartUv);
  const biomeTone = biomeSample.rgb;
  const biomeLand = biomeTone.mul(float(1.0).sub(ndv).mul(0.18).add(0.88));
  const biomeAllowed = biomeSample.a.mul(ghostMask);
  const biomeReveal = max(
    max(isSoloFound, isConquestOwned),
    uShowcaseNode.mul(isUnfoundDarkCap)
  ).mul(biomeAllowed);
  const biomeHint = float(1.0)
    .sub(uShowcaseNode)
    .mul(isUnfoundDarkCap)
    .mul(biomeAllowed)
    .mul(float(1.0).sub(uRegionalNode));
  const hinted = mix(landSurface, biomeTone.mul(0.3), biomeHint.mul(0.34));
  const revealed = mix(hinted, biomeLand, biomeReveal.mul(0.92));
  if (!lit || !maxC) return revealed;
  // Conquête: translucent owner tint over the realistic palette (GLSL ownerTint).
  const ownerHue = lit.div(max(maxC, 0.001));
  const ownerLuma = dot(revealed, vec3(0.299, 0.587, 0.114));
  const ownerTint = ownerHue.mul(ownerLuma.mul(1.1).add(0.3));
  return mix(revealed, ownerTint, isConquestOwned.mul(biomeAllowed).mul(0.5));
}
