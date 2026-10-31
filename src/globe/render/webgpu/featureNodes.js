// TSL twin of featureModeShaderChunks.js (FEATURE_SURFACE_CHUNK): Rivers & Mountains mode.
import { float, floor, mix, sin, step, texture, vec3 } from "three/tsl";

import { getFeatureMaskTexture } from "../featureMask";
import {
  SELECT_EDGE_RGB_VALUE,
  SELECT_HALO_ALPHA_VALUE,
  SELECT_PULSE_S_VALUE,
  SELECT_PULSE_STEPS_VALUE,
} from "../selectionStyle";

/** Land darker, rivers/relief readable, found tint, selected outline + pulsing halo. */
export function applyFeatureMode(p) {
  const { baseLit, valleyGap, ridgeSpur, ridgeCrest, cityHash, riverShimmer, riverBank } = p;
  const { riverCore, cartUv, uTimeNode, uFeatureNode, uReducedMotionNode, terrainLit } = p;
  const featBaseLit = baseLit.mul(0.6).mul(float(1.0).sub(valleyGap.mul(0.2)));
  const featSpurTone = vec3(0.62, 0.5, 0.35);
  const featCrestTone = vec3(0.88, 0.76, 0.56);
  const featReliefLit = mix(
    mix(featBaseLit, featSpurTone, ridgeSpur.mul(cityHash.mul(0.15).add(0.75))),
    featCrestTone,
    ridgeCrest.mul(0.92)
  );

  const featRiverColor = mix(vec3(0.24, 0.58, 0.84), vec3(0.4, 0.78, 0.96), riverShimmer);
  const featRiverLit = mix(
    featReliefLit.mul(float(1.0).sub(riverBank.mul(0.15))),
    featRiverColor,
    riverCore.mul(0.92)
  );

  const activeTerrainLit = mix(terrainLit, featRiverLit, uFeatureNode);

  const featSample = texture(getFeatureMaskTexture(), cartUv).r.mul(uFeatureNode);
  const isFeatCore = step(0.9, featSample);
  const isFeatHalo = step(0.2, featSample).mul(float(1.0).sub(isFeatCore));
  const isFeatFound = step(0.1, featSample).mul(float(1.0).sub(step(0.2, featSample)));

  const featPulseWave = sin(uTimeNode.mul(6.2831853 / SELECT_PULSE_S_VALUE))
    .mul(0.5)
    .add(0.5);
  const featPulse = mix(
    floor(featPulseWave.mul(SELECT_PULSE_STEPS_VALUE).add(0.5)).div(SELECT_PULSE_STEPS_VALUE),
    float(0.6),
    uReducedMotionNode
  );
  const featHaloAmt = isFeatHalo
    .mul(featSample)
    .mul(SELECT_HALO_ALPHA_VALUE)
    .mul(featPulse.mul(0.65).add(0.35));

  const foundReliefCrest = vec3(0.92, 0.78, 0.48);
  const foundReliefSpur = vec3(0.68, 0.5, 0.24);
  const foundRiverColor = mix(vec3(0.22, 0.68, 0.92), vec3(0.45, 0.88, 1.0), riverShimmer);
  const selectEdgeRgb = vec3(...SELECT_EDGE_RGB_VALUE);

  let litTerrain = activeTerrainLit;
  litTerrain = mix(litTerrain, foundReliefSpur, ridgeSpur.mul(isFeatFound));
  litTerrain = mix(litTerrain, foundReliefCrest, ridgeCrest.mul(isFeatFound));
  litTerrain = mix(litTerrain, foundRiverColor, riverCore.mul(isFeatFound));
  litTerrain = mix(litTerrain, selectEdgeRgb, featHaloAmt);
  litTerrain = mix(litTerrain, selectEdgeRgb, isFeatCore);

  return litTerrain;
}
