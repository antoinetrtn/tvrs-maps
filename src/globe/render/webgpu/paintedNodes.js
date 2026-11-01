/**
 * TSL twin of PAINTED_GLSL_BODY (paintedTerrain.js): same lazy texture, same weights.
 */
import { clamp, dot, float, mix, step, texture, uniform, vec3 } from "three/tsl";

import { onPaintedTerrainReady, PAINTED_RECT, paintedTerrainUniforms } from "../paintedTerrain";
import { mirrorUniform } from "./tslCommon";

let paintedTexNode = null;
let paintedReadyNode = null;
let paintedRectNode = null;

function nodes() {
  if (!paintedTexNode) {
    paintedTexNode = texture(paintedTerrainUniforms.uPaintedMap.value);
    onPaintedTerrainReady((tex) => {
      paintedTexNode.value = tex;
    });
    paintedReadyNode = mirrorUniform(paintedTerrainUniforms.uPaintedReady);
    paintedRectNode = uniform(PAINTED_RECT);
  }
  return { tex: paintedTexNode, ready: paintedReadyNode, rect: paintedRectNode };
}

export function applyPaintedTerrain(landSurface, p) {
  const { cartUv, ndv, ghostMask, isUnfoundDarkCap, isAwakenedCap, uRegionalNode } = p;
  const n = nodes();
  const uv = cartUv.sub(n.rect.xy).div(n.rect.zw);
  const inside = step(0.0, uv.x).mul(step(uv.x, 1.0)).mul(step(0.0, uv.y)).mul(step(uv.y, 1.0));
  const sample = n.tex.sample(clamp(uv, 0.0, 1.0));
  const amt = n.ready.mul(uRegionalNode).mul(ghostMask).mul(inside).mul(sample.a);
  const night = sample.rgb.mul(float(1.0).sub(ndv).mul(0.16).add(0.78)).mul(vec3(0.94, 0.98, 1.06));
  const luma = dot(sample.rgb, vec3(0.299, 0.587, 0.114));
  const unfound = mix(landSurface, night, amt.mul(isUnfoundDarkCap).mul(0.94));
  return unfound.mul(mix(float(1.0), luma.mul(1.2).add(0.7), amt.mul(isAwakenedCap).mul(0.6)));
}
