/**
 * Link between an opponent's floating cursor and the country they selected:
 * a dotted arc that rises from the country's anchor point to the cursor pin,
 * ending on a small square marker on the land. Unlit, flat, ink-coloured so
 * it reads over any tint; works the same under WebGL and WebGPU.
 */
import * as THREE from "three";

import { CONQUEST_CURSOR_STYLE } from "../../config/designSystem";

const DASHES = 28;
const ARCH = 0.1; // arc height as a fraction of its length
const MARKER_PX = 4;

export function createCursorLink({ color }) {
  const group = new THREE.Group();
  group.name = "conquest-cursor-link";
  group.visible = false;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DASHES * 6), 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(CONQUEST_CURSOR_STYLE.sightline),
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const line = new THREE.LineSegments(geo, lineMat);
  line.frustumCulled = false;
  line.renderOrder = 8;

  const markerGeo = new THREE.PlaneGeometry(MARKER_PX, MARKER_PX);
  const markerMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.renderOrder = 9;
  group.add(line, marker);

  const point = (a, b, ang, s0, t, rA, rB, bump, out, o) => {
    const ka = Math.sin((1 - t) * ang) / s0;
    const kb = Math.sin(t * ang) / s0;
    const x = ka * a[0] + kb * b[0];
    const y = ka * a[1] + kb * b[1];
    const z = ka * a[2] + kb * b[2];
    const n = Math.hypot(x, y, z) || 1;
    const r = rA + (rB - rA) * t + Math.sin(Math.PI * t) * bump;
    out[o] = (x / n) * r;
    out[o + 1] = (y / n) * r;
    out[o + 2] = (z / n) * r;
  };

  return {
    group,
    hide() {
      group.visible = false;
    },
    /**
     * `a` / `b`: unit vectors of the country anchor and of the cursor,
     * `rA` / `rB`: radii of both ends, `unit`: world units per px.
     * Returns false (and hides) when the two ends are too close to need a link.
     */
    update({ a, b, rA, rB, unit, camera, opacity, minAngle }) {
      const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      const ang = Math.acos(dot);
      if (ang < minAngle || ang > Math.PI - 1e-3) {
        group.visible = false;
        return false;
      }
      group.visible = true;
      lineMat.opacity = opacity;
      markerMat.opacity = opacity;
      const s0 = Math.sin(ang);
      const bump = ang * rA * ARCH;
      const pos = geo.attributes.position.array;
      for (let i = 0; i < DASHES; i++) {
        // Dashes: every other sub-segment of the sampled arc.
        point(a, b, ang, s0, (i * 2) / (DASHES * 2), rA, rB, bump, pos, i * 6);
        point(a, b, ang, s0, (i * 2 + 1) / (DASHES * 2), rA, rB, bump, pos, i * 6 + 3);
      }
      geo.attributes.position.needsUpdate = true;
      marker.position.set(a[0] * rA, a[1] * rA, a[2] * rA);
      marker.quaternion.copy(camera.quaternion);
      marker.scale.setScalar(unit);
      return true;
    },
    dispose() {
      group.removeFromParent();
      geo.dispose();
      lineMat.dispose();
      markerGeo.dispose();
      markerMat.dispose();
    },
  };
}
