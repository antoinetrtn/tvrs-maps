/**
 * TSL ports of the remaining onBeforeCompile effects (WebGPU renderer only):
 * country surface grain, blackout ocean, satellite sensor grid, mountain
 * glitch. Each mirrors its GLSL source line by line (see the GLSL next to the
 * call sites) and runs in display space like the original (tslCommon.js).
 */
import * as THREE from "three";
import {
  abs,
  asin,
  atan,
  cameraPosition,
  clamp,
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
  screenCoordinate,
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
/** countryGrainOutputNode: 3D Spherical Bayer 4x4 Ordered-Dither + Zoom-Aware Cartographic Detail */
export function countryGrainOutputNode() {
  if (!grainNode) {
    grainNode = Fn(() => {
      const ditherCell = floor(screenCoordinate.xy.div(3.0));
      const bayer = bayer4x4(ditherCell);

      const sphereNormal = normalize(positionWorld);
      const geomNormal = normalize(normalWorld);
      const isSideWall = step(abs(dot(geomNormal, sphereNormal)), 0.55);

      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const camDist = length(cameraPosition);
      const zoomDetail = float(1.0).sub(smoothstep(135.0, 220.0, camDist));
      const ndv = clamp(dot(sphereNormal, viewDir), 0.0, 1.0);
      const keyLightDir = normalize(vec3(-0.45, 0.55, 0.7));
      const keyLight = clamp(dot(sphereNormal, keyLightDir), 0.0, 1.0);
      const litLevel = clamp(ndv.mul(0.68).add(keyLight.mul(0.32)), 0.0, 1.0);
      const quantShade = floor(litLevel.mul(3.0).add(bayer)).div(3.0);
      const shadeFactor = mix(float(0.56), float(1.12), quantShade);

      const bayerCentered = bayer.sub(0.46875);
      const lat = asin(clamp(sphereNormal.y, -1.0, 1.0));
      const lng = atan(sphereNormal.z, sphereNormal.x);
      const hatchUv = vec2(lng, lat).mul(20.0);
      const hatchGrid = abs(fract(hatchUv.add(0.5)).sub(0.5));
      const hatchLine = step(0.44, max(hatchGrid.x, hatchGrid.y)).mul(0.028).mul(zoomDetail);
      const surfaceGrain = bayerCentered
        .mul(mix(0.05, 0.11, zoomDetail))
        .add(hatchLine.mul(step(0.5, bayer)));

      const lit = litDisplayColor();
      const capRgb = lit.mul(shadeFactor).add(vec3(surfaceGrain));
      const sideRgb = lit.mul(mix(float(0.72), float(0.94), step(0.5, bayer)));

      const rgb = mix(capRgb, sideRgb, isSideWall);
      return displayOutput(rgb);
    })();
  }
  return grainNode;
}

/** blackoutOceanOutputNode: Bayer 4x4 ordered-dither ocean limb & terminator + cartographic graticule */
export function blackoutOceanOutputNode(
  rimColor = new THREE.Color(0.85, 0.88, 0.92),
  rimStrength = 0.07,
  _uPixelScale = polygonGlitchUniforms.uPixelScale
) {
  return Fn(() => {
    const px = floor(screenCoordinate.xy.div(3.0));
    const bayer = bayer4x4(px);
    const camDist = length(cameraPosition);
    const subGridVis = float(1.0).sub(smoothstep(180.0, 260.0, camDist));

    // 1. Curvature & spherical lighting
    const n = normalize(normalWorld);
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const viewIncidence = clamp(dot(n, viewDir), 0.0, 1.0);
    const lightFacing = clamp(dot(n, normalize(vec3(-0.55, 0.45, 0.7))), 0.0, 1.0);
    const limb = pow(float(1.0).sub(viewIncidence), 1.85);

    const oceanShade = limb.mul(lightFacing.mul(0.35).add(0.65));
    const quantizedLimb = floor(oceanShade.mul(5.0).add(bayer)).div(5.0);
    const limbStipple = step(bayer, oceanShade.mul(1.35)).mul(0.45);

    const rimColorVec = vec3(rimColor.r, rimColor.g, rimColor.b);
    const rimRgb = rimColorVec.mul(
      quantizedLimb.mul(0.75).add(limbStipple).mul(float(rimStrength).mul(3.2))
    );
    const midLimbRing = rimColorVec.mul(
      step(bayer, smoothstep(0.18, 0.78, limb).mul(0.65)).mul(0.035)
    );

    // 2. Graticule
    const uvCoords = uv();
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
