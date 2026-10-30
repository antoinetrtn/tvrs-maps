/**
 * TSL twin of the GLSL biome block in COUNTRY_SURFACE_GRAIN_FRAGMENT_BODY
 * (globeShaders.js): same NearestFilter texture, same weights, line by line.
 */
import { float, max, mix, texture } from "three/tsl";

import { getBiomeTexture } from "../biomeTexture";

export function applyBiomePalette(p) {
  const {
    landSurface,
    cartUv,
    ndv,
    ghostMask,
    isSoloFound,
    isUnfoundDarkCap,
    uShowcaseNode,
    uRegionalNode,
    uSatThemeNode,
  } = p;
  const biomeSample = texture(getBiomeTexture(), cartUv);
  const biomeTone = biomeSample.rgb;
  const biomeLand = biomeTone.mul(float(1.0).sub(ndv).mul(0.18).add(0.88));
  const biomeAllowed = biomeSample.a.mul(ghostMask).mul(float(1.0).sub(uSatThemeNode));
  const biomeReveal = max(isSoloFound, uShowcaseNode.mul(isUnfoundDarkCap)).mul(biomeAllowed);
  const biomeHint = float(1.0)
    .sub(uShowcaseNode)
    .mul(isUnfoundDarkCap)
    .mul(biomeAllowed)
    .mul(float(1.0).sub(uRegionalNode));
  const hinted = mix(landSurface, biomeTone.mul(0.3), biomeHint.mul(0.34));
  return mix(hinted, biomeLand, biomeReveal.mul(0.92));
}
