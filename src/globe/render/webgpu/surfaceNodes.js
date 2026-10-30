// TSL ports of the onBeforeCompile effects (WebGPU only): country relief, blackout ocean
// currents, satellite grid, mountain glitch — each mirrors its GLSL twin (tslCommon.js).
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
  If,
  length,
  log2,
  max,
  min,
  mix,
  normalize,
  normalWorld,
  output,
  positionLocal,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  step,
  texture,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshPhongNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";

import { getCapitalLightsTexture } from "../capitalLightsTexture";
import { isGlobeWebGPU } from "../globeRendererFlag";
import { polygonGlitchUniforms } from "../polygonGlitchShader";
import { blackoutRiverTone, buildBlackoutLand } from "./blackoutNodes.js";
import {
  bayer4x4,
  displayOutput,
  hash,
  hashGrain,
  litDisplayColor,
  mirrorUniform,
} from "./tslCommon";

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
  const reliefLit = mix(darkReliefLit, awakeReliefLit, cityPower);

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
  const conquestRiverColor = mix(vec3(0.1, 0.2, 0.32), vec3(0.76, 0.94, 1.0), riverShimmer);
  const awakeRiverTone = mix(soloRiverColor, conquestRiverColor, isConquestOwned);
  const awakeRiverLit = mix(
    reliefLit.mul(float(1.0).sub(riverBank.mul(0.22))),
    awakeRiverTone,
    riverCore.mul(0.88)
  );
  return {
    terrainLit: mix(darkRiverLit, awakeRiverLit, cityPower),
    riverCore,
    ridgeCrest,
    ridgeSpur,
  };
}

function buildCityLightsLayer(p) {
  const { cartUv, cityPower, isConquestOwned, uTimeNode, uRegionalNode } = p;
  const cityCellId = floor(cartUv.mul(vec2(3600.0, 1800.0)));
  const capitalSample = texture(getCapitalLightsTexture(), cartUv);
  const cityDensity = capitalSample.r;
  const cityAura = capitalSample.g;
  const cityHash = hash(cityCellId);
  const cityHash2 = hash(cityCellId.add(vec2(37.2, 91.7)));
  const { terrainLit, riverCore, ridgeCrest, ridgeSpur } = buildTerrainReliefAndRivers({
    ...p,
    capitalSample,
    cityHash,
  });
  const isRegionalPin = step(0.975, cityAura);
  const worldAura = cityAura.mul(float(1.0).sub(isRegionalPin.mul(step(cityDensity, 0.25))));
  const effectiveAura = mix(worldAura, isRegionalPin.mul(0.42), uRegionalNode);
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
  const sparkColor = mix(worldSparkColor, colorMetroHeart, uRegionalNode);
  const worldSparkAlpha = tierPinpoint
    .mul(0.98)
    .add(tierArterial.mul(cityHash2.mul(0.16).add(0.78)).mul(trafficWave))
    .add(tierTentacle.mul(cityHash2.mul(0.24).add(0.5)).mul(satTwinkle));
  const regionalSparkAlpha = isRegionalPin.mul(satTwinkle.mul(0.12).add(0.88));
  const sparkAlpha = mix(worldSparkAlpha, regionalSparkAlpha, uRegionalNode).mul(cityPower);
  const satTopo = max(riverCore.mul(0.92), ridgeCrest.mul(0.76).add(ridgeSpur.mul(0.42)));
  const satFeat = clamp(
    max(sparkAlpha.mul(1.15).add(effectiveAura.mul(0.38).mul(cityPower)), satTopo),
    0.0,
    1.0
  );
  return { capRgb: mix(withAura, sparkColor, clamp(sparkAlpha, 0.0, 1.0)), satFeat };
}

let grainNode = null;
let ghostGrainNode = null;
let showcaseLightsNode = null;
let regionalModeNode = null;
let satelliteThemeNode = null;
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
    const uSatThemeNode = (satelliteThemeNode ||= mirrorUniform(
      polygonGlitchUniforms.uIsSatelliteTheme
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
    const cityPower = clamp(max(isAwakenedCap, uShowcaseNode.mul(isUnfoundDarkCap)), 0.0, 1.0).mul(
      ghostMask
    );

    const { blackoutAmt, unfoundLand } = buildBlackoutLand({
      lit,
      surfaceLuma,
      uShowcaseNode,
      isUnfoundDarkCap,
      uRegionalNode,
      uGhost,
    });
    const soloAwakenedLand = vec3(0.48, 0.34, 0.15).add(
      vec3(0.15, 0.1, 0.04).mul(float(1.0).sub(ndv))
    );
    const conquestAwakenedLand = lit.mul(0.84).add(lit.mul(0.22).mul(float(1.0).sub(ndv)));
    const landSurface = mix(
      mix(unfoundLand, conquestAwakenedLand, isConquestOwned),
      soloAwakenedLand,
      isSoloFound
    );
    const engrave = landSurface
      .mul(parallelLine.mul(0.04).add(crossTick.mul(0.09)))
      .add(vec3(rimSheen));
    const baseLit = landSurface.mul(limbFactor).add(engrave);

    const { capRgb, satFeat } = buildCityLightsLayer({
      cartUv,
      baseLit,
      cityPower,
      isSoloFound,
      isConquestOwned,
      uTimeNode,
      uRegionalNode,
      ghostMask,
      blackoutAmt,
    });
    const sideRgb = landSurface.mul(0.58);
    const rgb = mix(capRgb, sideRgb, isSideWall);
    const satTargetAlpha = mix(
      mix(float(0.24), float(0.48), isConquestOwned),
      float(0.96),
      satFeat
    );
    const outAlpha = mix(
      output.a,
      satTargetAlpha,
      uSatThemeNode.mul(isAwakenedCap).mul(float(1.0).sub(isSideWall))
    );
    return displayOutput(rgb, outAlpha);
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

/** applySatelliteSensorShader: screen-space anti-aliased sensor grid on the map. */
export function satelliteSensorColorNode(map, gridSourceUv = null) {
  return Fn(() => {
    const mapUv = uv();
    const sampled = texture(map, mapUv);
    const gridUv = (gridSourceUv || mapUv).mul(vec2(16384.0, 8192.0));
    const cellPx = max(fwidth(gridUv), vec2(1e-4));
    const gridVis = float(1).sub(smoothstep(0.18, 0.4, max(cellPx.x, cellPx.y)));
    const gridFract = abs(fract(gridUv.sub(0.5)).sub(0.5)).div(cellPx);
    const gridLine = clamp(min(gridFract.x, gridFract.y), 0, 1);
    const gridMix = float(1).sub(gridLine).mul(0.1).mul(gridVis);
    const rgb = mix(sampled.rgb, vec3(0.0, 0.5, 0.95), gridMix).toVar();
    const noise = hashGrain(floor(gridUv));
    const isLand = step(0.18, length(sampled.rg.sub(sampled.b)));
    rgb.addAssign(noise.sub(0.5).mul(0.03).mul(isLand).mul(gridVis));
    return vec4(rgb, sampled.a);
  })();
}

let mountainShared = null;
/** Node twin of LowPolyBiomes' mountain glitch material. */
export function createMountainGlitchNodeMaterial(mountainGlitchUniforms, isLight) {
  const mat = new MeshPhongNodeMaterial({ flatShading: true, shininess: 0, specular: 0x000000 });
  mat.outputNode = mountainGlitchOutputNode(mountainGlitchUniforms, isLight);
  mat.customProgramCacheKey = () => `mountain-glitch-gpu-${isLight ? "light" : "dark"}`;
  return mat;
}

/** Mountain glitch (LowPolyBiomes glitchMat onBeforeCompile). */
function mountainGlitchOutputNode(mountainGlitchUniforms, isLight) {
  if (!mountainShared) {
    mountainShared = {
      uTime: mirrorUniform(mountainGlitchUniforms.uTime),
      uIsError: mirrorUniform(mountainGlitchUniforms.uIsError),
      uIsSuccess: mirrorUniform(mountainGlitchUniforms.uIsSuccess),
      uFoundGreen: mirrorUniform(mountainGlitchUniforms.uFoundGreen),
    };
  }
  const u = mountainShared;
  // A constant, not a uniform: light/dark materials get distinct pipelines
  // through customProgramCacheKey (see LowPolyBiomes).
  const uIsLight = float(isLight ? 1 : 0);
  return Fn(() => {
    const p = positionLocal;
    const light = uIsLight.greaterThan(0.5);
    const noiseUv = p.xy.mul(8.0).add(vec2(p.z.mul(4.0)));
    const noise = hash(noiseUv.add(sin(u.uTime.mul(28.0))));
    const baseMin = select(light, float(0.65), float(0.12));
    const baseMax = select(light, float(0.98), float(0.68));
    const scanline = sin(p.y.mul(15.0).add(u.uTime.mul(5.0))).mul(
      select(light, float(0.03), float(0.07))
    );
    const finalColor = vec3(mix(baseMin, baseMax, noise).add(scanline)).toVar();
    const pulse = sin(u.uTime.mul(18.0)).mul(0.35).add(0.65);
    const sweep = step(fract(p.y.mul(1.5).sub(u.uTime.mul(4.0))), 0.35).mul(0.4);
    const fxNoise = hash(noiseUv.add(sin(u.uTime.mul(45.0))));
    const intensity = pulse.add(sweep).mul(mix(0.7, 1.3, fxNoise));
    If(u.uIsError.greaterThan(0.5), () => {
      finalColor.assign(vec3(1.0, 0.27, 0.0).mul(intensity.add(0.4)));
    });
    If(u.uIsSuccess.greaterThan(0.5), () => {
      finalColor.assign(u.uFoundGreen.mul(intensity));
    });
    return displayOutput(clamp(finalColor, 0, 1));
  })();
}
