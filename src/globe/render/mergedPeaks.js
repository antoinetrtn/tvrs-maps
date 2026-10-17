import * as THREE from "three";

/**
 * Merges many cone "peaks" into ONE BufferGeometry (one draw call per
 * mountain range instead of one per peak: ~2000 meshes on the globe in the
 * Mountains & Rivers mode before, ~50 now).
 *
 * The peak shape is identical to the former per-peak ConeGeometry
 * (radius, height, 8×4 segments + the same sin/cos ripple); it is built
 * straight into the merged buffers from ONE shared unit cone, so no per-peak
 * geometry is allocated (that allocation was the long task at card change).
 */

let templateCone = null;
const getTemplate = () => {
  if (!templateCone) templateCone = new THREE.ConeGeometry(1, 1, 8, 4);
  return templateCone;
};

/**
 * @param {{radius:number,height:number,x:number,y:number,z:number,rotY:number}[]} peaks
 * @returns {THREE.BufferGeometry}
 */
export function buildMergedPeaksGeometry(peaks) {
  const tpl = getTemplate();
  const tPos = tpl.attributes.position.array;
  const tNor = tpl.attributes.normal.array;
  const tIdx = tpl.index.array;
  const vCount = tpl.attributes.position.count;
  const total = vCount * peaks.length;

  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const IndexArray = total > 65535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(tIdx.length * peaks.length);

  for (let p = 0; p < peaks.length; p++) {
    const { radius, height, x: px, y: py, z: pz, rotY } = peaks[p];
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const vBase = p * vCount;
    const halfBottom = -0.5; // template cone: y ∈ [-0.5, 0.5]

    for (let i = 0; i < vCount; i++) {
      const ux = tPos[i * 3];
      const uy = tPos[i * 3 + 1];
      const uz = tPos[i * 3 + 2];
      let ax = ux * radius;
      const ay = uy * height;
      let az = uz * radius;
      if (uy > halfBottom) {
        const noise = Math.sin(Math.atan2(az, ax) * 4) * 0.03 + Math.cos(ay * 18) * 0.015;
        ax += ax * noise;
        az += az * noise;
      }
      const o = (vBase + i) * 3;
      positions[o] = ax * c + az * s + px;
      positions[o + 1] = ay + py;
      positions[o + 2] = -ax * s + az * c + pz;

      // Inverse-transpose of diag(radius, height, radius) on the unit normal.
      let nx = tNor[i * 3] / radius;
      let ny = tNor[i * 3 + 1] / height;
      let nz = tNor[i * 3 + 2] / radius;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      normals[o] = nx * c + nz * s;
      normals[o + 1] = ny;
      normals[o + 2] = -nx * s + nz * c;
    }

    const iBase = p * tIdx.length;
    for (let i = 0; i < tIdx.length; i++) indices[iBase + i] = tIdx[i] + vBase;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  geometry.userData.mergedPeaks = true;
  return geometry;
}
