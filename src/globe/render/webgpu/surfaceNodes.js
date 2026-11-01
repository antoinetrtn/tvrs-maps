// TSL ports of the onBeforeCompile effects (WebGPU only): country relief, blackout ocean
// currents, mountain glitch — each mirrors its GLSL twin (tslCommon.js).
import * as THREE from "three";
import {
  abs,
  asin,
  atan,
  cameraPosition,
  clamp,
  cos,
  dot,
  exp2,
  float,
  floor,
  Fn,
  fract,
  fwidth,
  length,
  log2,
  materialReference,
  max,
  min,
  mix,
  normalize,
  normalWorld,
  output,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
} from "three/tsl";
import { MeshPhongNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";

import { getCapitalLightsTexture } from "../capitalLightsTexture";
import { isGlobeWebGPU } from "../globeRendererFlag";
import { polygonGlitchUniforms } from "../polygonGlitchShader";
import { applyBiomePalette } from "./biomeNodes";
import { blackoutRiverTone, buildBlackoutLand } from "./blackoutNodes.js";
import { applyDiscoveryAmber, revealLand, wakePower } from "./discoveryNodes";
import { applyFeatureMode } from "./featureNodes";
import { buildIgnition, homeShowcase, igniteSpark } from "./igniteNodes";
import { bayer4x4, displayOutput, hash, litDisplayColor, mirrorUniform } from "./tslCommon";

/** MeshPhongMaterial, or its node twin when the globe renders with WebGPU. */
export function createPhongMaterial(params) {
  return isGlobeWebGPU() ? new MeshPhongNodeMaterial(params) : new THREE.MeshPhongMaterial(params);
}

/** MeshStandardMaterial, or its node twin when the globe renders with WebGPU. */
export function createStandardMaterial(params) {
  return isGlobeWebGPU()
    ? new MeshStandardNodeMaterial(params)
    : new THREE.MeshStandardMaterial(params);
}

// Saturated blue rivers stay legible over both player tints (GLSL twin in globeShaders.js).
const CONQUEST_RIVER_DEEP = vec3(0.05, 0.12, 0.34);
const CONQUEST_RIVER_SHINE = vec3(0.36, 0.66, 0.98);

function buildTerrainReliefAndRivers(p) {
  const {
    cartUv,
    baseLit,
    capitalSample,
    cityHash,
    cityPower,
    isSoloFound,
    isConquestOwned,
    uTimeNode,
    uRegionalNode,
    uFeatureNode,
    uReducedMotionNode,
    ghostMask,
  } = p;
  const reliefMask = ghostMask.mul(mix(float(1.0), cityPower.mul(0.36), uRegionalNode));
  const spurMask = reliefMask.mul(float(1.0).sub(uRegionalNode));
  const rawCrest = step(0.76, capitalSample.b);
  const rawSpur = float(1.0).sub(rawCrest).mul(step(0.38, capitalSample.b));
  const rawValley = float(1.0).sub(max(rawCrest, rawSpur)).mul(step(0.12, capitalSample.b));
  const ridgeCrest = rawCrest.mul(reliefMask);
  const ridgeSpur = rawSpur.mul(spurMask);
  const valleyGap = rawValley.mul(spurMask);
  const darkReliefLit = baseLit
    .mul(float(1.0).sub(valleyGap.mul(0.16)))
    .add(vec3(0.058).mul(ridgeCrest))
    .add(vec3(0.03).mul(ridgeSpur));
  const soloCrestTone = mix(vec3(0.62, 0.48, 0.28), vec3(0.92, 0.78, 0.48), isSoloFound);
  const soloSpurTone = mix(vec3(0.36, 0.29, 0.19), vec3(0.68, 0.5, 0.24), isSoloFound);
  const awakenedCrestTone = mix(
    soloCrestTone,
    min(vec3(1.0), baseLit.mul(1.65).add(vec3(0.22))),
    isConquestOwned
  );
  const awakenedSpurTone = mix(
    soloSpurTone,
    min(vec3(1.0), baseLit.mul(1.28).add(vec3(0.09))),
    isConquestOwned
  );
  const awakeSlope = mix(
    baseLit.mul(float(1.0).sub(valleyGap.mul(0.28))),
    awakenedSpurTone,
    ridgeSpur.mul(cityHash.mul(0.18).add(0.68))
  );
  const awakeReliefLit = mix(awakeSlope, awakenedCrestTone, ridgeCrest.mul(0.86));
  const terrainPower = p.terrainPower || cityPower;
  const reliefLit = mix(darkReliefLit, awakeReliefLit, terrainPower);

  const riverMask = ghostMask.mul(mix(float(1.0), cityPower.mul(0.52), uRegionalNode));
  const riverCore = step(0.65, capitalSample.a).mul(riverMask);
  const riverBank = float(1.0)
    .sub(step(0.65, capitalSample.a))
    .mul(step(0.25, capitalSample.a))
    .mul(riverMask)
    .mul(float(1.0).sub(uRegionalNode));
  const riverShimmer = sin(uTimeNode.mul(2.2).add(cartUv.x.mul(140.0)).add(cartUv.y.mul(90.0)))
    .mul(0.22)
    .add(0.78);
  const darkRiver = blackoutRiverTone(p.blackoutAmt);
  const darkRiverLit = mix(
    reliefLit.mul(float(1.0).sub(riverBank.mul(0.1))),
    darkRiver.tone,
    riverCore.mul(darkRiver.strength)
  );
  const soloRiverColor = mix(vec3(0.14, 0.46, 0.58), vec3(0.38, 0.8, 0.88), riverShimmer);
  const conquestRiverColor = mix(CONQUEST_RIVER_DEEP, CONQUEST_RIVER_SHINE, riverShimmer.mul(0.6));
  const awakeRiverTone = mix(soloRiverColor, conquestRiverColor, isConquestOwned);
  const awakeRiverLit = mix(
    reliefLit.mul(float(1.0).sub(riverBank.mul(0.22))),
    awakeRiverTone,
    riverCore.mul(0.88)
  );

  return {
    terrainLit: applyFeatureMode({
      ...{ baseLit, valleyGap, ridgeSpur, ridgeCrest, cityHash, riverShimmer, riverBank },
      ...{ riverCore, cartUv, uTimeNode, uFeatureNode, uReducedMotionNode },
      terrainLit: mix(darkRiverLit, awakeRiverLit, terrainPower),
    }),
  };
}

function buildCityLightsLayer(p) {
  const { cartUv, cityPower, isConquestOwned, uTimeNode, uRegionalNode, uFeatureNode } = p;
  const cityCellId = floor(cartUv.mul(vec2(3600.0, 1800.0)));
  const capitalSample = texture(getCapitalLightsTexture(), cartUv);
  const cityDensity = capitalSample.r;
  const cityAura = capitalSample.g;
  const cityHash = hash(cityCellId);
  const cityHash2 = hash(cityCellId.add(vec2(37.2, 91.7)));
  const { terrainLit } = buildTerrainReliefAndRivers({
    ...p,
    capitalSample,
    cityHash,
  });
  const isRegionalPin = step(0.975, cityAura);
  const worldAura = cityAura.mul(float(1.0).sub(isRegionalPin.mul(step(cityDensity, 0.25))));
  const effectiveAura = mix(worldAura, isRegionalPin.mul(0.42), uRegionalNode).mul(
    float(1.0).sub(uFeatureNode)
  );
  const trafficWave = sin(uTimeNode.mul(2.8).sub(worldAura.mul(8.5)).add(cityHash.mul(6.2831853)))
    .mul(0.2)
    .add(0.8);
  const satTwinkle = sin(uTimeNode.mul(4.2).add(cityHash2.mul(6.2831853)))
    .mul(0.22)
    .add(0.78);
  const tierPinpoint = step(0.82, cityDensity);
  const tierArterial = float(1.0).sub(tierPinpoint).mul(step(0.55, cityDensity));
  const tierTentacle = float(1.0).sub(max(tierPinpoint, tierArterial)).mul(step(0.25, cityDensity));

  const auraColor = mix(
    vec3(0.68, 0.4, 0.12),
    max(terrainLit.mul(1.35), vec3(0.75, 0.55, 0.22)),
    isConquestOwned.mul(0.5)
  );
  const withAura = mix(
    terrainLit,
    max(terrainLit, auraColor),
    effectiveAura.mul(0.32).mul(cityPower)
  );
  const colorOuterTentacle = mix(
    vec3(0.94, 0.54, 0.16),
    vec3(1.0, 0.84, 0.48),
    isConquestOwned.mul(0.45)
  );
  const colorMainArterial = mix(
    mix(vec3(0.98, 0.72, 0.18), vec3(1.0, 0.84, 0.34), cityHash2),
    vec3(1.0, 0.94, 0.72),
    isConquestOwned.mul(0.55)
  );
  const colorMetroHeart = mix(
    vec3(1.0, 0.94, 0.7),
    vec3(1.0, 0.99, 0.92),
    smoothstep(0.82, 1.0, max(cityDensity, isRegionalPin))
  );
  const worldSparkColor = tierPinpoint
    .mul(colorMetroHeart)
    .add(tierArterial.mul(colorMainArterial))
    .add(tierTentacle.mul(colorOuterTentacle));
  const sparkColor = igniteSpark(
    mix(worldSparkColor, colorMetroHeart, uRegionalNode),
    p.igniteFlash
  );
  const worldSparkAlpha = tierPinpoint
    .mul(0.98)
    .add(tierArterial.mul(cityHash2.mul(0.16).add(0.78)).mul(trafficWave))
    .add(tierTentacle.mul(cityHash2.mul(0.24).add(0.5)).mul(satTwinkle));
  const regionalSparkAlpha = isRegionalPin.mul(satTwinkle.mul(0.12).add(0.88));
  const sparkAlpha = mix(worldSparkAlpha, regionalSparkAlpha, uRegionalNode)
    .mul(cityPower)
    .mul(float(1.0).sub(uFeatureNode));
  return { capRgb: mix(withAura, sparkColor, clamp(sparkAlpha, 0.0, 1.0)) };
}

let grainNode = null;
let ghostGrainNode = null;
let showcaseLightsNode = null;
let regionalModeNode = null;
let featureModeNode = null;
let reducedMotionNode = null;
let igniteSelfNode = null;
let igniteRefs = null;
/** Per-material ignition holder values (globePolygonMaterial defineIgniteReferences). */
function getIgniteRefs() {
  return (igniteRefs ||= {
    origin: materialReference("userData.igniteOrigin", "vec3"),
    start: materialReference("userData.igniteStart", "float"),
    radius: materialReference("userData.igniteRadius", "float"),
    duration: materialReference("userData.igniteDuration", "float"),
    revealStart: materialReference("userData.revealStart", "float"),
    landRadius: materialReference("userData.landRadius", "float"),
  });
}
/** countryGrainOutputNode: uniform cartographic country relief + architectural side-walls */
export function countryGrainOutputNode(isGhostCountry = false) {
  if (isGhostCountry && ghostGrainNode) return ghostGrainNode;
  if (!isGhostCountry && grainNode) return grainNode;
  const node = Fn(() => {
    const uGhost = float(isGhostCountry ? 1.0 : 0.0);
    const ghostMask = float(1.0).sub(uGhost);
    const sphereNormal = normalize(positionWorld);
    const geomNormal = normalize(normalWorld);
    const isSideWall = step(abs(dot(geomNormal, sphereNormal)), 0.55);

    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const ndv = clamp(dot(sphereNormal, viewDir), 0.0, 1.0);
    const limbFactor = mix(float(0.95), float(1.02), smoothstep(0.0, 0.65, ndv));
    const rimSheen = pow(float(1.0).sub(ndv), 3.2).mul(0.045);

    const cLat = asin(clamp(sphereNormal.y, -1.0, 1.0));
    const cLng = atan(sphereNormal.x, sphereNormal.z);
    const cartUv = vec2(cLng.div(6.2831853).add(0.5), cLat.div(3.14159265).add(0.5));
    const topoGrid = cartUv.mul(vec2(72.0, 36.0));
    const topoDist = abs(fract(topoGrid.add(0.5)).sub(0.5)).div(max(fwidth(topoGrid), vec2(0.001)));
    const parallelLine = clamp(float(1.0).sub(topoDist.y), 0.0, 1.0);
    const crossTick = clamp(float(1.0).sub(max(topoDist.x, topoDist.y).mul(0.6)), 0.0, 1.0);

    const uTimeNode = (oceanTimeNode ||= mirrorUniform(polygonGlitchUniforms.uTime));
    const uShowcaseNode = (showcaseLightsNode ||= mirrorUniform(
      polygonGlitchUniforms.uShowcaseLights
    ));
    const uRegionalNode = (regionalModeNode ||= mirrorUniform(
      polygonGlitchUniforms.uIsRegionalMode
    ));
    const uFeatureNode = (featureModeNode ||= mirrorUniform(polygonGlitchUniforms.uFeatureMode));
    const uReducedMotionNode = (reducedMotionNode ||= mirrorUniform(
      polygonGlitchUniforms.uReducedMotion
    ));
    const lit = litDisplayColor();
    const surfaceLuma = dot(lit, vec3(0.299, 0.587, 0.114));
    const maxC = max(lit.x, max(lit.y, lit.z));
    const minC = min(lit.x, min(lit.y, lit.z));
    const chroma = maxC.sub(minC);
    const isSoloFound = step(0.45, lit.y)
      .mul(step(lit.z.mul(1.32), lit.y))
      .mul(step(lit.x.mul(2.2), lit.z));
    const isConquestOwned = float(1.0)
      .sub(isSoloFound)
      .mul(step(0.15, chroma))
      .mul(step(0.36, maxC));
    const isAwakenedCap = max(isSoloFound, isConquestOwned).mul(ghostMask);
    const lumaThresh = mix(float(0.44), float(0.64), uRegionalNode);
    const isUnfoundDarkCap = float(1.0)
      .sub(isAwakenedCap)
      .mul(ghostMask)
      .mul(float(1.0).sub(smoothstep(lumaThresh, lumaThresh.add(0.14), surfaceLuma)));
    const uSelfNode = (igniteSelfNode ||= materialReference("userData.igniteSelf", "float"));
    const ign = buildIgnition({
      cartUv,
      sphereNormal,
      uTimeNode,
      uRegionalNode,
      uSelfNode,
      refs: getIgniteRefs(),
    });
    const { showcaseNow, showcaseLand, homeFlash } = homeShowcase({
      cartUv,
      sphereNormal,
      uShowcaseNode,
      uRegionalNode,
    });
    const wake = { isAwakenedCap, showcaseNow, isUnfoundDarkCap, ghostMask };
    const cityPower = wakePower(ign.igniteMask, wake);
    const terrainPower = wakePower(ign.landMask, wake);

    const { blackoutAmt, unfoundLand } = buildBlackoutLand({
      lit,
      surfaceLuma,
      uShowcaseNode: showcaseLand,
      isUnfoundDarkCap,
      uRegionalNode,
      uGhost,
      uHomeNode: uShowcaseNode,
    });
    const soloAwakenedLand = vec3(0.48, 0.34, 0.15).add(
      vec3(0.15, 0.1, 0.04).mul(float(1.0).sub(ndv))
    );
    const conquestAwakenedLand = lit.mul(0.84).add(lit.mul(0.22).mul(float(1.0).sub(ndv)));
    const baseLand = mix(unfoundLand, conquestAwakenedLand, isConquestOwned);
    const paletteLand = applyBiomePalette({
      landSurface: mix(baseLand, soloAwakenedLand, isSoloFound),
      cartUv,
      ndv,
      ghostMask,
      isSoloFound,
      isConquestOwned,
      lit,
      maxC,
      isUnfoundDarkCap,
      isAwakenedCap,
      uShowcaseNode: showcaseLand,
      uRegionalNode,
    });
    const { landSurface, baseLit } = revealLand(paletteLand, ign.landMask, isAwakenedCap, {
      parallelLine,
      crossTick,
      rimSheen,
      limbFactor,
    });
    const { capRgb } = buildCityLightsLayer({
      cartUv,
      baseLit,
      cityPower,
      terrainPower,
      isSoloFound,
      isConquestOwned,
      uTimeNode,
      uRegionalNode,
      uFeatureNode,
      uReducedMotionNode,
      ghostMask,
      blackoutAmt,
      igniteFlash: max(ign.igniteFlash, homeFlash),
    });
    const rgb = applyDiscoveryAmber({
      capRgb,
      landSurface,
      ign,
      isAwakenedCap,
      uRegionalNode,
      cartUv,
      isSideWall,
    });
    return displayOutput(rgb, output.a);
  })();
  if (isGhostCountry) ghostGrainNode = node;
  else grainNode = node;
  return node;
}

let oceanTimeNode = null;

/** blackoutOceanOutputNode: minimalist monochrome 5x5 pixel-art wavelet / ASCII ocean */
export function blackoutOceanOutputNode(
  rimColor = new THREE.Color(0.85, 0.88, 0.92),
  rimStrength = 0.07
) {
  const uTimeNode = (oceanTimeNode ||= mirrorUniform(polygonGlitchUniforms.uTime));
  return Fn(() => {
    const sphereDir = normalize(normalWorld);
    const rawLat = asin(clamp(sphereDir.y, -1.0, 1.0));
    const rawLng = atan(sphereDir.z, sphereDir.x);
    const latNorm = rawLat.div(3.14159265).add(0.5);
    const camAlt = max(length(cameraPosition).sub(100.0), 15.0);
    const zoomOctave = exp2(floor(log2(clamp(float(230.0).div(camAlt), 1.0, 8.0)).add(0.5)));
    const resLat = float(48.0).mul(zoomOctave);

    const cellRow = floor(rawLat.mul(resLat));
    const rowLat = cellRow.add(0.5).div(resLat);
    const colsPerRad = max(floor(resLat.mul(cos(rowLat)).mul(1.15).add(0.5)), 8.0);
    const cellCol = floor(rawLng.mul(colsPerRad));

    const cellUv = vec2(fract(rawLng.mul(colsPerRad)), fract(rawLat.mul(resLat)));
    const subPx = floor(cellUv.mul(5.0));
    const sx = subPx.x;
    const sy = subPx.y;

    const cellId = vec2(cellCol, cellRow);
    const cellHash = hash(cellId);

    const qSphere = vec2(cellCol.add(0.5).div(colsPerRad), rowLat);
    const swellA = sin(
      qSphere.x
        .mul(11.0)
        .add(uTimeNode.mul(0.65))
        .add(sin(qSphere.y.mul(6.0)).mul(1.4))
    ).mul(cos(qSphere.y.mul(9.0).sub(uTimeNode.mul(0.32))));
    const swellB = cos(qSphere.x.mul(17.0).sub(uTimeNode.mul(0.48)).add(qSphere.y.mul(5.0)));
    const swell = swellA.mul(0.65).add(swellB.mul(0.35));

    const waveActive = step(float(-0.08), swell).mul(step(float(0.62), cellHash));
    const bob = step(
      float(0.0),
      sin(uTimeNode.mul(1.9).add(cellHash.mul(6.2831853)).add(qSphere.x.mul(12.0)))
    );

    const tildeY = select(
      sx.lessThan(0.5),
      float(2.0),
      select(
        sx.lessThan(1.5),
        float(2.0).add(bob),
        select(sx.lessThan(2.5), float(2.0), float(2.0).sub(float(1.0).sub(bob)))
      )
    );
    const isTilde = step(sx, 3.5).mul(float(1.0).sub(step(0.5, abs(sy.sub(tildeY)))));
    const isDash = step(0.5, sx)
      .mul(step(sx, 3.5))
      .mul(float(1.0).sub(step(0.5, abs(sy.sub(2.0)))));
    const isDot = float(1.0)
      .sub(step(0.5, abs(sx.sub(2.0))))
      .mul(float(1.0).sub(step(0.5, abs(sy.sub(2.0)))));

    const glyphType = fract(cellHash.mul(19.7));
    const glyph = select(
      glyphType.lessThan(0.5),
      isTilde,
      select(glyphType.lessThan(0.8), isDash, isDot)
    );

    const breath = sin(uTimeNode.mul(1.4).add(cellHash.mul(6.2831853)))
      .mul(0.32)
      .add(0.68);
    const wavePixel = waveActive.mul(glyph).mul(breath);

    const n = normalize(normalWorld);
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const viewIncidence = clamp(dot(n, viewDir), 0.0, 1.0);
    const globalSubPx = cellId.mul(5.0).add(subPx);
    const bayer = bayer4x4(globalSubPx);
    const limb = pow(clamp(float(1.0).sub(viewIncidence), 0.0, 1.0), 2.2);
    const limbBit = step(bayer.add(0.12), limb.mul(0.52)).mul(0.09);

    const rimColorVec = vec3(rimColor.r, rimColor.g, rimColor.b);
    const pixelAlpha = wavePixel.mul(float(rimStrength).mul(0.34).add(0.145)).add(limbBit);
    const waveRgb = mix(vec3(0.78, 0.82, 0.86), rimColorVec, 0.45).mul(pixelAlpha);

    const latWidth = max(fwidth(latNorm), 0.00045);
    const eqLine = clamp(float(1.0).sub(abs(latNorm.sub(0.5)).div(latWidth)), 0.0, 1.0);
    const tropicLine = clamp(
      float(1.0).sub(abs(abs(latNorm.sub(0.5)).sub(23.44 / 180.0)).div(latWidth)),
      0.0,
      1.0
    );
    const specialLines = max(eqLine, tropicLine);
    const specialDither = step(bayer.add(0.05), specialLines.mul(0.55)).mul(0.06);

    const graticuleColor = mix(vec3(0.55, 0.65, 0.75), rimColorVec, 0.45);
    const graticuleRgb = graticuleColor.mul(
      specialDither.mul(float(rimStrength).mul(0.28).add(0.07))
    );

    return displayOutput(litDisplayColor().add(waveRgb).add(graticuleRgb));
  })();
}
