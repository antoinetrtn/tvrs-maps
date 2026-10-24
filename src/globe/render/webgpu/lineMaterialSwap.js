/**
 * three-globe draws stroked paths (rivers) with Line2 + LineMaterial, a GLSL
 * ShaderMaterial that WebGPURenderer cannot compile. Under WebGPU we swap
 * each LineMaterial for an equivalent Line2NodeMaterial (same colour, width,
 * dashes, opacity). three-globe keeps writing its usual properties on the
 * swapped material on later updates.
 *
 * It also draws polygon boundary strokes with LineSegments + LineBasicMaterial.
 * Under WebGPU we swap LineBasicMaterial to LineBasicNodeMaterial and attach
 * a Bayer 4x4 stippled outputNode so country borders have the same tactile
 * pixel-dithered aesthetic as the land caps.
 */
import * as THREE from "three";
import {
  dot,
  float,
  floor,
  Fn,
  fract,
  mix,
  output,
  positionWorld,
  screenCoordinate,
  sin,
  step,
  vec2,
  vec3,
} from "three/tsl";
import { Line2NodeMaterial, LineBasicNodeMaterial } from "three/webgpu";

import { polygonGlitchUniforms } from "../polygonGlitchShader";
import { bayer4x4, displayOutput, litDisplayColor, mirrorUniform } from "./tslCommon";

export function toLine2NodeMaterial(lineMaterial) {
  const material = new Line2NodeMaterial({
    color: lineMaterial.color.getHex(),
    linewidth: lineMaterial.linewidth,
    vertexColors: lineMaterial.vertexColors,
    dashed: lineMaterial.dashed,
    transparent: lineMaterial.transparent,
    opacity: lineMaterial.opacity,
    worldUnits: lineMaterial.worldUnits,
  });
  material.dashScale = lineMaterial.dashScale;
  material.dashSize = lineMaterial.dashSize;
  material.gapSize = lineMaterial.gapSize;
  material.dashOffset = lineMaterial.dashOffset;
  if (lineMaterial.transparent) material.blending = THREE.NormalBlending;
  // three-globe toggles `defines.USE_DASH` and sets `resolution` (raycast).
  material.defines = {};
  material.resolution = lineMaterial.resolution;
  return material;
}

let borderNode = null;
/** WebGPU outputNode for dithered/stippled country border LineSegments */
export function countryBorderOutputNode() {
  if (!borderNode) {
    borderNode = Fn(() => {
      const uPixelScale = mirrorUniform(polygonGlitchUniforms.uPixelScale);
      const px = floor(screenCoordinate.xy.mul(uPixelScale.mul(0.5)));
      const pxFine = floor(screenCoordinate.xy.mul(uPixelScale));
      const bayer = bayer4x4(px);
      const bayerFine = bayer4x4(pxFine);

      const worldCell = floor(positionWorld.mul(2.6));
      const cellHash = fract(
        sin(dot(worldCell.xy.add(worldCell.z), vec2(12.9898, 78.233))).mul(43758.5453)
      );

      const stippleMask = step(0.28, mix(bayer, cellHash, 0.35));
      const brightStep = mix(float(0.65), float(1.45), step(0.48, bayerFine));
      const lit = litDisplayColor();
      const rgb = lit.mul(brightStep).add(vec3(step(0.78, bayer).mul(0.12)));
      const alpha = output.a.mul(mix(float(0.18), float(1.0), stippleMask));
      return displayOutput(rgb, alpha);
    })();
  }
  return borderNode;
}

export function toDitheredLineBasicNodeMaterial(basicMaterial) {
  const material = new LineBasicNodeMaterial({
    color: basicMaterial.color ? basicMaterial.color.getHex() : 0xffffff,
    transparent: true,
    opacity: basicMaterial.opacity ?? 1.0,
    linewidth: basicMaterial.linewidth ?? 1,
    depthWrite: basicMaterial.depthWrite ?? false,
  });
  material.userData.hasBorderDither = true;
  material.outputNode = countryBorderOutputNode();
  return material;
}

/** Swap every LineMaterial and polygon stroke LineBasicMaterial in `scene`; returns how many were swapped. */
export function swapLineMaterialsForWebGPU(scene) {
  let swapped = 0;
  scene.traverse((obj) => {
    const mat = obj.material;
    if (mat?.isLineMaterial) {
      obj.material = toLine2NodeMaterial(mat);
      mat.dispose();
      swapped += 1;
    } else if (
      (obj.type === "LineSegments" || obj.isLineSegments) &&
      mat?.isLineBasicMaterial &&
      !mat.isNodeMaterial &&
      (obj.parent?.__globeObjType === "polygon" || mat.userData?.hasBorderDither)
    ) {
      obj.material = toDitheredLineBasicNodeMaterial(mat);
      mat.dispose();
      swapped += 1;
    }
  });
  return swapped;
}
