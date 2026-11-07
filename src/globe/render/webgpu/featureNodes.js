// TSL twin of featureModeShaderChunks.js (FEATURE_SURFACE_CHUNK): Rivers & Mountains mode.
import { clamp, float, floor, mix, sin, step, texture, vec3 } from "three/tsl";

import { featureFoundPulseStart, getFeatureMaskTexture } from "../featureMask";
import {
  FEATURE_FOUND_PULSE_ALPHA,
  FEATURE_FOUND_PULSE_RGB,
  FEATURE_FOUND_PULSE_S_VALUE,
  FEATURE_NEW_FOUND_THRESHOLD,
  SELECT_EDGE_RGB_VALUE,
  SELECT_HALO_ALPHA_VALUE,
  SELECT_PULSE_S_VALUE,
  SELECT_PULSE_STEPS_VALUE,
} from "../selectionStyle";
import { mirrorUniform } from "./tslCommon";

let foundPulseStartNode = null;
/** Shared uniform node mirroring featureFoundPulseStart (uFeatureFoundStart in GLSL). */
export const getFeatureFoundStartNode = () =>
  (foundPulseStartNode ||= mirrorUniform(featureFoundPulseStart));

/** TSL twin of featureFoundPulseGlsl: one-off stepped fade on the newly found feature only. */
export function featureFoundPulseNode(featSample, uTime, uStart, uReduced) {
  const t = uTime.sub(uStart);
  const isNew = step(FEATURE_NEW_FOUND_THRESHOLD, featSample).mul(
    float(1.0).sub(step(0.2, featSample))
  );
  const live = step(0.0, t).mul(float(1.0).sub(step(FEATURE_FOUND_PULSE_S_VALUE, t)));
  const k = float(1.0).sub(clamp(t.div(FEATURE_FOUND_PULSE_S_VALUE), 0.0, 1.0));
  const stepped = floor(k.mul(SELECT_PULSE_STEPS_VALUE).add(0.5)).div(SELECT_PULSE_STEPS_VALUE);
  return isNew.mul(live).mul(stepped).mul(FEATURE_FOUND_PULSE_ALPHA).mul(float(1.0).sub(uReduced));
}

export const FEATURE_FOUND_PULSE_VEC = () => vec3(...FEATURE_FOUND_PULSE_RGB);

/** Land darker, rivers/relief readable, found tint, selected outline + pulsing halo. */
export function applyFeatureMode(p) {
  const { baseLit, valleyGap, ridgeSpur, ridgeCrest, cityHash, riverShimmer, riverBank } = p;
  const { riverCore, cartUv, uTimeNode, uFeatureNode, uReducedMotionNode, terrainLit } = p;
  const featSample = texture(getFeatureMaskTexture(), cartUv).r.mul(uFeatureNode);
  const featMember = step(0.05, texture(getFeatureMaskTexture(), cartUv).r);
  const featSpur = ridgeSpur.mul(featMember);
  const featCrest = ridgeCrest.mul(featMember);
  const featRiverCore = riverCore.mul(featMember);
  const featBaseLit = baseLit.mul(0.6).mul(float(1.0).sub(valleyGap.mul(0.2)));
  const featSpurTone = vec3(0.62, 0.5, 0.35);
  const featCrestTone = vec3(0.88, 0.76, 0.56);
  const featReliefLit = mix(
    mix(featBaseLit, featSpurTone, featSpur.mul(cityHash.mul(0.15).add(0.75))),
    featCrestTone,
    featCrest.mul(0.92)
  );

  const featRiverColor = mix(vec3(0.24, 0.58, 0.84), vec3(0.4, 0.78, 0.96), riverShimmer);
  const featRiverLit = mix(
    featReliefLit.mul(float(1.0).sub(riverBank.mul(featMember).mul(0.15))),
    featRiverColor,
    featRiverCore.mul(0.92)
  );

  const activeTerrainLit = mix(terrainLit, featRiverLit, uFeatureNode);

  const isFeatCore = step(0.9, featSample);
  const isFeatHover = step(0.84, featSample).mul(float(1.0).sub(isFeatCore));
  const isFeatHalo = step(0.2, featSample).mul(float(1.0).sub(step(0.84, featSample)));
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

  const foundReliefCrest = vec3(0.42, 1.0, 0.74);
  const foundReliefSpur = vec3(0.12, 0.7, 0.46);
  const foundRiverColor = mix(vec3(0.18, 0.9, 0.62), vec3(0.5, 1.0, 0.8), riverShimmer);
  const selectEdgeRgb = vec3(...SELECT_EDGE_RGB_VALUE);

  let litTerrain = activeTerrainLit;
  litTerrain = mix(litTerrain, foundReliefSpur, ridgeSpur.mul(isFeatFound));
  litTerrain = mix(litTerrain, foundReliefCrest, ridgeCrest.mul(isFeatFound));
  litTerrain = mix(litTerrain, foundRiverColor, riverCore.mul(isFeatFound));
  litTerrain = mix(
    litTerrain,
    FEATURE_FOUND_PULSE_VEC(),
    featureFoundPulseNode(
      featSample,
      uTimeNode,
      getFeatureFoundStartNode(),
      uReducedMotionNode
    ).mul(clamp(ridgeSpur.add(ridgeCrest).add(riverCore), 0.0, 1.0))
  );
  litTerrain = mix(litTerrain, selectEdgeRgb, featHaloAmt);
  litTerrain = mix(litTerrain, selectEdgeRgb, isFeatHover.mul(0.6));
  litTerrain = mix(litTerrain, selectEdgeRgb, isFeatCore);

  return litTerrain;
}
