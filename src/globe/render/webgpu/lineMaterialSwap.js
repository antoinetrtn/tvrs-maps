/**
 * three-globe draws stroked paths (rivers) with Line2 + LineMaterial, a GLSL
 * ShaderMaterial that WebGPURenderer cannot compile. Under WebGPU we swap
 * each LineMaterial for an equivalent Line2NodeMaterial (same colour, width,
 * dashes, opacity). three-globe keeps writing its usual properties on the
 * swapped material on later updates.
 */
import * as THREE from "three";
import { Line2NodeMaterial } from "three/webgpu";

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

/** Swap every LineMaterial in `scene`; returns how many were swapped. */
export function swapLineMaterialsForWebGPU(scene) {
  let swapped = 0;
  scene.traverse((obj) => {
    const mat = obj.material;
    if (!mat?.isLineMaterial) return;
    obj.material = toLine2NodeMaterial(mat);
    mat.dispose();
    swapped += 1;
  });
  return swapped;
}
