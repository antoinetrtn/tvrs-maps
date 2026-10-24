/**
 * TSL (node) equivalents of the globe's GLSL ShaderMaterials, used only with
 * the experimental WebGPU renderer (globeRendererFlag.js): WebGPURenderer
 * rejects GLSL ShaderMaterial and ignores onBeforeCompile.
 */
import * as THREE from "three";
import {
  clamp,
  dot,
  floor,
  max,
  mix,
  normalLocal,
  positionView,
  pow,
  smoothstep,
  sRGBTransferEOTF,
  transformNormalToView,
  uniform,
  vec2,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

import { bayer4x4 } from "./webgpu/tslCommon";

/**
 * Port of FRESNEL_VERTEX/FRAGMENT_SHADER (globeShaders.js). Exposes the same
 * `uniforms.{glowColor,coef,power}.value` handles as the ShaderMaterial so the
 * lighting hook and the animation loop drive both identically.
 */
export function createFresnelGlowNodeMaterial({ color = 0x64b5f6, coef = 1, power = 1.2 } = {}) {
  const glowColor = uniform(new THREE.Color(color));
  const uCoef = uniform(coef);
  const uPower = uniform(power);
  // View-space normal like GLSL `normalMatrix * normal` (modelNormalMatrix is
  // the world-space one; it skewed the rim and over-brightened the halo).
  const normal = transformNormalToView(normalLocal).normalize();
  const x = clamp(dot(normal, positionView.normalize()), 0, 1);
  const rawIntensity = pow(smoothstep(0, 0.62, x), max(1.8, uPower.mul(2))).mul(uCoef);
  const rimCell = floor(normal.xy.mul(0.5).add(0.5).mul(vec2(240.0, 240.0)));
  const bayer = bayer4x4(rimCell);
  const dithered = floor(rawIntensity.mul(5.0).add(bayer)).div(5.0);
  const intensity = mix(rawIntensity, dithered, 0.82);

  const material = new MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.NormalBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  // The GLSL writes glowColor raw (no colorspace include) — i.e. as a display
  // value. Decode it so the WebGPU sRGB output encode lands on the same pixel.
  material.colorNode = sRGBTransferEOTF(glowColor);
  material.opacityNode = intensity;
  material.uniforms = { glowColor, coef: uCoef, power: uPower };
  return material;
}
