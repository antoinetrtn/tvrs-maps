/**
 * three-globe draws polygon boundary strokes with LineSegments + LineBasicMaterial.
 * Under WebGPU we swap LineBasicMaterial to LineBasicNodeMaterial and attach
 * a continuous Bayer 4x4 pixel-sheen outputNode so country borders stay
 * razor-sharp and unbroken on mobile and desktop.
 */
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
import { LineBasicNodeMaterial } from "three/webgpu";

import { bayer4x4, displayOutput, litDisplayColor } from "./tslCommon";

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
      const isFoundBorder = step(float(0.28), lit.y)
        .mul(step(lit.z.mul(1.3), lit.y))
        .mul(step(lit.x.mul(2.2), lit.z));
      const borderColor = mix(lit, vec3(0.98, 0.76, 0.28), isFoundBorder);
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

/** Swap every polygon stroke LineBasicMaterial in `scene`; returns how many were swapped. */
export function swapLineMaterialsForWebGPU(scene) {
  let swapped = 0;
  scene.traverse((obj) => {
    const mat = obj.material;
    if (
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
