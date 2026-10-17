import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { buildMergedPeaksGeometry } from "../globe/render/mergedPeaks";

describe("buildMergedPeaksGeometry", () => {
  it("creates matching vertex and index count based on template cone", () => {
    const template = new THREE.ConeGeometry(1, 1, 8, 4);
    const tplVertexCount = template.attributes.position.count;
    const tplIndexCount = template.index.count;

    expect(tplVertexCount).toBe(62);
    expect(tplIndexCount).toBe(192);

    const peaks = [
      { radius: 1, height: 2, x: 0, y: 0, z: 0, rotY: 0 },
      { radius: 2, height: 3, x: 1, y: 1, z: 1, rotY: 0.5 },
      { radius: 0.5, height: 1, x: -1, y: 2, z: 3, rotY: 1.2 },
    ];
    const geometry = buildMergedPeaksGeometry(peaks);

    expect(geometry.attributes.position.count).toBe(tplVertexCount * peaks.length);
    expect(geometry.index.count).toBe(tplIndexCount * peaks.length);
  });

  it("contains no NaN values in position or normal buffers", () => {
    const peaks = [
      { radius: 2, height: 5, x: 3, y: -1, z: 4, rotY: 0.8 },
      { radius: 1.5, height: 3, x: -2, y: 0, z: 1, rotY: 2.1 },
    ];
    const geometry = buildMergedPeaksGeometry(peaks);
    const positions = geometry.attributes.position.array;
    const normals = geometry.attributes.normal.array;

    for (let i = 0; i < positions.length; i++) {
      expect(Number.isNaN(positions[i])).toBe(false);
    }
    for (let i = 0; i < normals.length; i++) {
      expect(Number.isNaN(normals[i])).toBe(false);
    }
  });

  it("keeps all vertex y within range and max radial distance <= r * 1.05 for origin peak", () => {
    const r = 3;
    const h = 8;
    const geometry = buildMergedPeaksGeometry([
      { radius: r, height: h, x: 0, y: 0, z: 0, rotY: 0 },
    ]);
    const positions = geometry.attributes.position.array;
    let maxRadial = 0;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      expect(y).toBeGreaterThanOrEqual(-h / 2 - 1e-6);
      expect(y).toBeLessThanOrEqual(h / 2 + 1e-6);

      const radial = Math.hypot(x, z);
      if (radial > maxRadial) maxRadial = radial;
    }

    expect(maxRadial).toBeLessThanOrEqual(r * 1.05);
  });

  it("translates bounding box center to the peak position within 0.1 * r", () => {
    const r = 2;
    const h = 4;
    const geometry = buildMergedPeaksGeometry([
      { radius: r, height: h, x: 3, y: 1, z: -2, rotY: 0 },
    ]);
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);

    expect(Math.abs(center.x - 3)).toBeLessThanOrEqual(0.1 * r);
    expect(Math.abs(center.y - 1)).toBeLessThanOrEqual(0.1 * r);
    expect(Math.abs(center.z - -2)).toBeLessThanOrEqual(0.1 * r);
  });

  it("ensures normal vectors have unit length within ±1e-3", () => {
    const geometry = buildMergedPeaksGeometry([
      { radius: 2.5, height: 6, x: 1, y: 2, z: 3, rotY: 0.4 },
    ]);
    const normals = geometry.attributes.normal.array;

    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
      expect(Math.abs(len - 1)).toBeLessThanOrEqual(1e-3);
    }
  });

  it("sets userData.mergedPeaks to true", () => {
    const geometry = buildMergedPeaksGeometry([
      { radius: 1, height: 1, x: 0, y: 0, z: 0, rotY: 0 },
    ]);
    expect(geometry.userData.mergedPeaks).toBe(true);
  });

  it("uses Uint16Array for 2 peaks and Uint32Array for >1000 peaks", () => {
    const peak = { radius: 1, height: 1, x: 0, y: 0, z: 0, rotY: 0 };
    const geomSmall = buildMergedPeaksGeometry([peak, peak]);
    expect(geomSmall.index.array).toBeInstanceOf(Uint16Array);

    const geomLarge = buildMergedPeaksGeometry(Array.from({ length: 1100 }, () => peak));
    expect(geomLarge.index.array).toBeInstanceOf(Uint32Array);
  });
});
