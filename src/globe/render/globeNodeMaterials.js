/**
 * TSL (node) equivalents of the globe's GLSL ShaderMaterials, used only with
 * the experimental WebGPU renderer (globeRendererFlag.js): WebGPURenderer
 * rejects GLSL ShaderMaterial and ignores onBeforeCompile.
 */
import * as THREE from "three";
import {
  clamp,
  dot,
  max,
  modelNormalMatrix,
  normalLocal,
  positionView,
  pow,
  smoothstep,
  uniform,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

/**
 * Port of FRESNEL_VERTEX/FRAGMENT_SHADER (globeShaders.js). Exposes the same
 * `uniforms.{glowColor,coef,power}.value` handles as the ShaderMaterial so the
 * lighting hook and the animation loop drive both identically.
 */
export function createFresnelGlowNodeMaterial({ color = 0x64b5f6, coef = 1, power = 1.2 } = {}) {
  const glowColor = uniform(new THREE.Color(color));
  const uCoef = uniform(coef);
  const uPower = uniform(power);
  const normal = modelNormalMatrix.mul(normalLocal).normalize();
  const x = clamp(dot(normal, positionView.normalize()), 0, 1);
  const intensity = pow(smoothstep(0, 0.62, x), max(1.8, uPower.mul(2))).mul(uCoef);

  const material = new MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.NormalBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  material.colorNode = glowColor;
  material.opacityNode = intensity;
  material.uniforms = { glowColor, coef: uCoef, power: uPower };
  return material;
}
