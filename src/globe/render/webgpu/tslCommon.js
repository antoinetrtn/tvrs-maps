/**
 * Shared TSL helpers for the WebGPU renderer path (see globeRendererFlag.js).
 *
 * The GLSL effects patch `gl_FragColor` at `#include <dithering_fragment>`,
 * i.e. after the sRGB output encode: their constants are sRGB *display*
 * values. Node materials work in linear space and get encoded afterwards, so
 * every port reads the lit colour back into display space (`toDisplay`),
 * applies the same maths, and returns to linear (`fromDisplay`). That keeps
 * the WebGPU colours on par with WebGL.
 */
import * as THREE from "three";
import {
  dot,
  float,
  floor,
  fract,
  mod,
  output,
  sin,
  sRGBTransferEOTF,
  sRGBTransferOETF,
  uniform,
  vec2,
  vec4,
} from "three/tsl";

/** GLSL `fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123)`. */
export const hash = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453123));

/** GLSL `fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453)`. */
export const hashGrain = (p) => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));

/**
 * 4x4 Bayer ordered-dither threshold in [0.0, 0.9375] (exact [0..15]/16 values).
 * Uses pure float/mod/floor math (no integer bitops) for universal WebGPU TSL compilation.
 */
const b2 = (v) => v.x.mul(2.0).add(v.y.mul(float(3.0).sub(v.x.mul(4.0))));
export const bayer4x4 = (px) => {
  const p0 = floor(mod(px, 2.0));
  const p1 = floor(mod(floor(px.mul(0.5)), 2.0));
  return b2(p0).mul(4.0).add(b2(p1)).div(16.0);
};

const toDisplay = (rgb) => sRGBTransferOETF(rgb);
export const fromDisplay = (rgb) => sRGBTransferEOTF(rgb);

/** Lit material colour (display space). */
export const litDisplayColor = () => toDisplay(output.rgb);

/** vec4 in display space → linear vec4 for the material output. */
export const displayOutput = (rgb, alpha = output.a) => vec4(fromDisplay(rgb), alpha);

/**
 * A TSL uniform that mirrors a plain `{ value }` holder each frame, so the
 * existing JS (shader clock, feedback, transitions) keeps driving both paths.
 */
export function mirrorUniform(holder) {
  const initial = holder.value?.isColor ? new THREE.Color().copy(holder.value) : holder.value;
  const node = uniform(initial);
  node.onRenderUpdate(() => {
    if (holder.value?.isColor) {
      node.value.copy(holder.value);
      return node.value;
    }
    return holder.value;
  });
  return node;
}
