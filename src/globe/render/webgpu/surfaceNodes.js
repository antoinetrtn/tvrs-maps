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

let oceanMotionNode = null;

const oceanValueNoise = Fn(([p]) => {
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
  const n00 = hash(i);
  const n10 = hash(i.add(vec2(1.0, 0.0)));
  const n01 = hash(i.add(vec2(0.0, 1.0)));
  const n11 = hash(i.add(vec2(1.0, 1.0)));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
});

/** blackoutOceanOutputNode: 3D sphere-anchored pixel-art Bayer 4x4 ocean dithering */
export function blackoutOceanOutputNode(
  rimColor = new THREE.Color(0.85, 0.88, 0.92),
  rimStrength = 0.07
) {
  const uGlobeMotion = (oceanMotionNode ||= mirrorUniform(polygonGlitchUniforms.uGlobeMotion));
  return Fn(() => {
    const uvCoords = uv();
    const rawLat = uvCoords.y.sub(0.5).mul(3.14159265);
    const rawLng = uvCoords.x.sub(0.5).mul(6.2831853);
    const camAlt = max(length(cameraPosition).sub(100.0), 15.0);
    const zoomOctave = exp2(floor(log2(clamp(float(220.0).div(camAlt), 1.0, 8.0)).add(0.5)));
    const resLat = float(56.0).mul(zoomOctave);

    const pxRow = floor(rawLat.mul(resLat));
    const rowLat = pxRow.add(0.5).div(resLat);
    const colsPerRad = max(floor(resLat.mul(cos(rowLat)).add(0.5)), 8.0);
    const pxCol = floor(rawLng.mul(colsPerRad));
    const spherePx = vec2(pxCol, pxRow);
    const bayer = bayer4x4(spherePx);

    const qSphere = vec2(pxCol.add(0.5).div(colsPerRad), rowLat);
    const bathyMacro = oceanValueNoise(qSphere.mul(2.4).add(vec2(1.7, 3.1)));
    const bathyMid = oceanValueNoise(qSphere.mul(5.2).add(vec2(8.3, 4.9)));
    const bathymetry = bathyMacro.mul(0.62).add(bathyMid.mul(0.38));

    const n = normalize(normalWorld);
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const viewIncidence = clamp(dot(n, viewDir), 0.0, 1.0);
    const limb = pow(clamp(float(1.0).sub(viewIncidence), 0.0, 1.0), 1.35);

    const rawField = bathymetry.mul(0.78).add(limb.mul(0.45)).add(uGlobeMotion.mul(0.04));
    const bayerSteps = floor(clamp(rawField.mul(12.0).sub(0.8), 2.0, 9.0));
    const ditherTone = bayerSteps.div(16.0);
    const trameBit = step(bayer.add(0.01), ditherTone);

    const rimColorVec = vec3(rimColor.r, rimColor.g, rimColor.b);
    const rimRgb = rimColorVec.mul(trameBit.mul(float(rimStrength).mul(0.68).add(0.16)));

    const latWidth = max(fwidth(uvCoords.y), 0.0005);
    const eqLine = clamp(float(1.0).sub(abs(uvCoords.y.sub(0.5)).div(latWidth)), 0.0, 1.0);
    const tropicLine = clamp(
      float(1.0).sub(abs(abs(uvCoords.y.sub(0.5)).sub(23.44 / 180.0)).div(latWidth)),
      0.0,
      1.0
    );
    const specialLines = max(eqLine, tropicLine);
    const specialDither = step(bayer.add(0.03), specialLines.mul(0.65)).mul(0.08);

    const graticuleColor = mix(vec3(0.55, 0.65, 0.75), rimColorVec, 0.45);
    const graticuleRgb = graticuleColor.mul(
      specialDither.mul(float(rimStrength).mul(0.35).add(0.08))
    );

    return displayOutput(litDisplayColor().add(rimRgb).add(graticuleRgb));
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
