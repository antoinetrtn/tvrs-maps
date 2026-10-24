/**
 * three-globe draws stroked paths (rivers) with Line2 + LineMaterial, a GLSL
 * ShaderMaterial that WebGPURenderer cannot compile. Under WebGPU we swap
 * each LineMaterial for an equivalent Line2NodeMaterial (same colour, width,
 * dashes, opacity). three-globe keeps writing its usual properties on the
 * swapped material on later updates.
 *
 * It also draws polygon boundary strokes with LineSegments + LineBasicMaterial.
 * Under WebGPU we swap LineBasicMaterial to LineBasicNodeMaterial and attach
 * a continuous Bayer 4x4 pixel-sheen outputNode so country borders stay
 * razor-sharp and unbroken on mobile and desktop.
 */
import * as THREE from "three";
import {
  asin,
  atan,
  clamp,
  dot,
  float,
  floor,
  Fn,
  fract,
  mix,
  normalize,
  output,
  positionWorld,
  step,
  vec2,
  vec3,
} from "three/tsl";
import { Line2NodeMaterial, LineBasicNodeMaterial } from "three/webgpu";

import { bayer4x4, displayOutput, litDisplayColor } from "./tslCommon";

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
/** WebGPU outputNode for continuous Bayer-modulated country border LineSegments */
export function countryBorderOutputNode() {
  if (!borderNode) {
    borderNode = Fn(() => {
      const borderDir = normalize(positionWorld);
      const borderLat = asin(clamp(borderDir.y, -1.0, 1.0));
      const borderLng = atan(borderDir.z, borderDir.x);
      const bayer = bayer4x4(floor(vec2(borderLng.mul(180.0), borderLat.mul(180.0))));
      const arcPhase = dot(positionWorld, vec3(0.24, 0.36, 0.48));
      const borderStep = step(float(0.35), fract(arcPhase.add(bayer.mul(0.35))));
      const brightStep = mix(float(0.92), float(1.12), borderStep);
      const lit = litDisplayColor();
      const isFoundBorder = step(float(0.55), lit.y)
        .mul(float(1.0).sub(step(float(0.35), lit.x)))
        .mul(step(lit.z, float(0.65)));
      const borderColor = mix(lit, vec3(0.88, 0.62, 0.22), isFoundBorder);
      const rgb = borderColor.mul(brightStep);
      return displayOutput(rgb, output.a);
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
