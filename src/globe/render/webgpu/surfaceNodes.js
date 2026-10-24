/**
 * TSL ports of the remaining onBeforeCompile effects (WebGPU renderer only):
 * country surface grain, blackout ocean, satellite sensor grid, mountain
 * glitch. Each mirrors its GLSL source line by line (see the GLSL next to the
 * call sites) and runs in display space like the original (tslCommon.js).
 */
import * as THREE from "three";
import {
  abs,
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
/** countryGrainOutputNode: 3D sphere-anchored smooth country shading + micro-grain (no screen-space squares) */
export function countryGrainOutputNode() {
  if (!grainNode) {
    grainNode = Fn(() => {
      const sphereNormal = normalize(positionWorld);
      const geomNormal = normalize(normalWorld);
      const isSideWall = step(abs(dot(geomNormal, sphereNormal)), 0.55);

      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const ndv = clamp(dot(sphereNormal, viewDir), 0.0, 1.0);
      const keyLightDir = normalize(vec3(-0.45, 0.55, 0.7));
      const keyLight = clamp(dot(sphereNormal, keyLightDir), 0.0, 1.0);
      const litLevel = clamp(ndv.mul(0.68).add(keyLight.mul(0.32)), 0.0, 1.0);
      const shadeFactor = mix(float(0.76), float(1.08), smoothstep(0.05, 0.95, litLevel));

      const sphereCoord = sphereNormal.xz
        .mul(420.0)
        .add(vec2(sphereNormal.y.mul(310.0), sphereNormal.x.mul(190.0)));
      const sphereCell = floor(sphereCoord);
      const sphereFrac = smoothstep(0.0, 1.0, fract(sphereCoord));
      const g00 = hashGrain(sphereCell);
      const g10 = hashGrain(sphereCell.add(vec2(1.0, 0.0)));
      const g01 = hashGrain(sphereCell.add(vec2(0.0, 1.0)));
      const g11 = hashGrain(sphereCell.add(vec2(1.0, 1.0)));
      const microGrain = mix(mix(g00, g10, sphereFrac.x), mix(g01, g11, sphereFrac.x), sphereFrac.y)
        .sub(0.5)
        .mul(0.018);

      const lit = litDisplayColor();
      const capRgb = lit.mul(shadeFactor).add(vec3(microGrain));
      const sideRgb = lit.mul(0.84);

      const rgb = mix(capRgb, sideRgb, isSideWall);
      return displayOutput(rgb);
    })();
  }
  return grainNode;
}

let oceanTimeNode = null;
/** blackoutOceanOutputNode: 3D sphere-anchored animated Bayer 4x4 ordered-dither ocean + cartographic graticule */
export function blackoutOceanOutputNode(
  rimColor = new THREE.Color(0.85, 0.88, 0.92),
  rimStrength = 0.07,
  _uPixelScale = polygonGlitchUniforms.uPixelScale
) {
  const uTime = (oceanTimeNode ||= mirrorUniform(polygonGlitchUniforms.uTime));
  return Fn(() => {
    const uvCoords = uv();
    const oceanLat = uvCoords.y.sub(0.5).mul(3.14159265);
    const oceanLng = uvCoords.x.sub(0.5).mul(6.2831853);
    const waveDrift = vec2(uTime.mul(0.85), sin(oceanLng.mul(4.0).add(uTime.mul(0.7))).mul(0.65));
    const px = floor(uvCoords.mul(vec2(480.0, 240.0)).add(waveDrift));
    const bayer = bayer4x4(px);
    const camDist = length(cameraPosition);
    const subGridVis = float(1.0).sub(smoothstep(180.0, 260.0, camDist));

    const wave1 = sin(oceanLng.mul(12.0).add(oceanLat.mul(8.0)).sub(uTime.mul(1.65)));
    const wave2 = cos(oceanLng.mul(18.0).sub(oceanLat.mul(14.0)).add(uTime.mul(1.25)));
    const waveField = wave1.mul(0.6).add(wave2.mul(0.4)).mul(0.5).add(0.5);
    const waveDither = step(bayer, waveField.mul(0.46)).mul(
      float(rimStrength).mul(0.35).add(0.042)
    );

    // 1. Curvature & spherical lighting
    const n = normalize(normalWorld);
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const viewIncidence = clamp(dot(n, viewDir), 0.0, 1.0);
    const lightFacing = clamp(dot(n, normalize(vec3(-0.55, 0.45, 0.7))), 0.0, 1.0);
    const limb = pow(float(1.0).sub(viewIncidence), 1.85);

    const oceanShade = limb.mul(lightFacing.mul(0.35).add(0.65)).add(waveField.mul(0.12));
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
