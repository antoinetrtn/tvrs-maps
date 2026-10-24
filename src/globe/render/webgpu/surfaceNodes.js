/**
 * TSL ports of the remaining onBeforeCompile effects (WebGPU renderer only):
 * country surface relief, blackout ocean magnetic currents, satellite sensor grid,
 * mountain glitch. Each mirrors its GLSL source line by line (see the GLSL next to
 * the call sites) and runs in display space like the original (tslCommon.js).
 */
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

import { isGlobeWebGPU } from "../globeRendererFlag";
import { polygonGlitchUniforms } from "../polygonGlitchShader";
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

let grainNode = null;
/** countryGrainOutputNode: uniform cartographic country relief + architectural side-walls */
export function countryGrainOutputNode() {
  if (!grainNode) {
    grainNode = Fn(() => {
      const sphereNormal = normalize(positionWorld);
      const geomNormal = normalize(normalWorld);
      const isSideWall = step(abs(dot(geomNormal, sphereNormal)), 0.55);

      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = clamp(dot(sphereNormal, viewDir), 0.0, 1.0);
      const limbFactor = mix(float(0.95), float(1.02), smoothstep(0.0, 0.65, ndv));
      const rimSheen = pow(float(1.0).sub(ndv), 3.2).mul(0.045);

      const cLat = asin(clamp(sphereNormal.y, -1.0, 1.0));
      const cLng = atan(sphereNormal.z, sphereNormal.x);
      const cartUv = vec2(cLng.div(6.2831853).add(0.5), cLat.div(3.14159265).add(0.5));
      const topoGrid = cartUv.mul(vec2(72.0, 36.0));
      const topoDist = abs(fract(topoGrid.add(0.5)).sub(0.5)).div(
        max(fwidth(topoGrid), vec2(0.001))
      );
      const parallelLine = clamp(float(1.0).sub(topoDist.y), 0.0, 1.0);
      const crossTick = clamp(float(1.0).sub(max(topoDist.x, topoDist.y).mul(0.6)), 0.0, 1.0);

      const lit = litDisplayColor();
      const engrave = lit.mul(parallelLine.mul(0.04).add(crossTick.mul(0.09))).add(vec3(rimSheen));
      const capRgb = lit.mul(limbFactor).add(engrave);
      const sideRgb = lit.mul(0.58);

      const rgb = mix(capRgb, sideRgb, isSideWall);
      return displayOutput(rgb);
    })();
  }
  return grainNode;
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
