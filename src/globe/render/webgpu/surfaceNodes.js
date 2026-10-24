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
  float,
  floor,
  Fn,
  fract,
  fwidth,
  If,
  length,
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
let oceanMotionNode = null;
let oceanVelocityNode = null;

/** blackoutOceanOutputNode: fine-scale magnetic-field ocean currents + cartographic graticule */
export function blackoutOceanOutputNode(
  rimColor = new THREE.Color(0.85, 0.88, 0.92),
  rimStrength = 0.07,
  _uPixelScale = polygonGlitchUniforms.uPixelScale
) {
  const uTime = (oceanTimeNode ||= mirrorUniform(polygonGlitchUniforms.uTime));
  const uGlobeMotion = (oceanMotionNode ||= mirrorUniform(polygonGlitchUniforms.uGlobeMotion));
  const uGlobeVelocity = (oceanVelocityNode ||= mirrorUniform(
    polygonGlitchUniforms.uGlobeVelocity
  ));
  return Fn(() => {
    const uvCoords = uv();
    const camDist = length(cameraPosition);
    const subGridVis = float(1.0).sub(smoothstep(180.0, 260.0, camDist));

    const oceanLat = uvCoords.y.sub(0.5).mul(3.14159265);
    const oceanLng = uvCoords.x.sub(0.5).mul(6.2831853);
    const gridDensity = mix(
      float(5200.0),
      float(2200.0),
      clamp(camDist.sub(108.0).div(170.0), 0.0, 1.0)
    );
    const px = floor(uvCoords.mul(vec2(gridDensity, gridDensity.mul(0.5))));
    const bayer = bayer4x4(px);

    const velShift = uGlobeVelocity.mul(float(1.6).add(uGlobeMotion.mul(2.4)));
    const fLat = oceanLat.add(velShift.y.mul(0.35));
    const fLng = oceanLng.add(velShift.x.mul(0.35));

    const gyre1 = sin(fLng.mul(3.0).add(sin(fLat.mul(4.0)).mul(0.65))).mul(cos(fLat.mul(2.5)));
    const gyre2 = cos(
      fLng
        .mul(5.0)
        .sub(fLat.mul(3.0))
        .add(sin(fLng.mul(2.0)).mul(0.5))
    ).mul(0.55);
    const streamPsi = fLat.mul(3.8).add(gyre1.mul(0.95)).add(gyre2.mul(0.65));

    const fluxWave = cos(streamPsi.mul(18.0)).mul(0.5).add(0.5);
    const fluxLine = pow(fluxWave, 3.2);
    const dashPhase = fLng
      .mul(36.0)
      .sub(gyre1.mul(14.0))
      .sub(uTime.mul(float(2.2).add(uGlobeMotion.mul(6.5))));
    const fluxDash = smoothstep(-0.15, 0.72, sin(dashPhase));
    const motionRipple = uGlobeMotion.mul(
      sin(streamPsi.mul(26.0).sub(uTime.mul(8.0)))
        .mul(0.6)
        .add(0.4)
    );

    const magneticCurrent = fluxLine.mul(fluxDash.mul(0.62).add(0.38)).add(motionRipple.mul(0.28));
    const waveDither = step(bayer, magneticCurrent.mul(0.72)).mul(
      float(rimStrength).mul(0.42).add(0.048).add(uGlobeMotion.mul(0.045))
    );

    // 1. Curvature & spherical lighting
    const n = normalize(normalWorld);
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const viewIncidence = clamp(dot(n, viewDir), 0.0, 1.0);
    const lightFacing = clamp(dot(n, normalize(vec3(-0.55, 0.45, 0.7))), 0.0, 1.0);
    const limb = pow(float(1.0).sub(viewIncidence), 1.85);

    const oceanShade = limb.mul(lightFacing.mul(0.35).add(0.65)).add(magneticCurrent.mul(0.14));
    const quantizedLimb = floor(oceanShade.mul(5.0).add(bayer)).div(5.0);
    const limbStipple = step(bayer, oceanShade.mul(1.35)).mul(0.45);

    const rimColorVec = vec3(rimColor.r, rimColor.g, rimColor.b);
    const rimRgb = rimColorVec.mul(
      quantizedLimb.mul(0.75).add(limbStipple).mul(float(rimStrength).mul(3.2)).add(waveDither)
    );
    const midLimbRing = rimColorVec.mul(
      step(bayer, smoothstep(0.18, 0.78, limb).mul(0.65)).mul(0.035)
    );

    // 2. Graticule
    const gridUv15 = uvCoords.mul(vec2(24.0, 12.0));
    const gridPx15 = max(fwidth(gridUv15), vec2(0.0008));
    const lineDist15 = abs(fract(gridUv15.add(0.5)).sub(0.5)).div(gridPx15);
    const line15 = clamp(float(1.0).sub(min(lineDist15.x, lineDist15.y)), 0.0, 1.0);
    const gridDither = step(bayer.mul(0.75).add(0.1), line15).toVar();

    const gridUv30 = uvCoords.mul(vec2(12.0, 6.0));
    const gridPx30 = max(fwidth(gridUv30), vec2(0.0008));
    const lineDist30 = abs(fract(gridUv30.add(0.5)).sub(0.5)).div(gridPx30);
    const line30 = clamp(float(1.0).sub(min(lineDist30.x, lineDist30.y)), 0.0, 1.0);
    gridDither.assign(max(gridDither, step(bayer.mul(0.55), line30)));

    const subGridUv = uvCoords.mul(vec2(72.0, 36.0));
    const subDist = abs(fract(subGridUv.add(0.5)).sub(0.5)).div(
      max(fwidth(subGridUv), vec2(0.001))
    );
    const subTick = clamp(float(1.0).sub(max(subDist.x, subDist.y).mul(0.5)), 0.0, 1.0).mul(
      step(min(subDist.x, subDist.y), 0.8)
    );
    const tickDither = step(bayer, subTick.mul(0.45)).mul(0.035).mul(subGridVis);

    const latWidth = max(fwidth(uvCoords.y), 0.0004);
    const eqDist = abs(uvCoords.y.sub(0.5)).div(latWidth);
    const eqLine = clamp(float(1.0).sub(eqDist), 0.0, 1.0);
    const tropicDist = abs(abs(uvCoords.y.sub(0.5)).sub(23.44 / 180.0)).div(latWidth);
    const tropicLine = clamp(float(1.0).sub(tropicDist), 0.0, 1.0);
    const specialLines = max(eqLine, tropicLine);
    const specialDither = step(bayer, specialLines.mul(1.1)).mul(0.08);

    const graticuleColor = mix(vec3(0.55, 0.65, 0.75), rimColorVec, 0.45);
    const graticuleRgb = graticuleColor.mul(
      gridDither
        .mul(0.075)
        .add(tickDither.mul(1.4))
        .add(specialDither.mul(float(rimStrength).mul(0.6).add(0.09)))
    );

    return displayOutput(litDisplayColor().add(rimRgb).add(midLimbRing).add(graticuleRgb));
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
