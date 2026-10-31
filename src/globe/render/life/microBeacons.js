import * as THREE from "three";

// 5×5 pixel lantern (grey levels, tinted per instance): true square pixels.
const SPRITE = ["..o..", ".oxo.", "oxXxo", ".oxo.", "..o.."];
const LEVEL = { o: 110, x: 200, X: 255 };
const N = SPRITE.length;
const PX_PER_TEXEL = 2; // 10×10 screen px, constant at every zoom
const CLUSTER_PX = 14; // beacons closer than this on screen merge into one
const ALTITUDE = 0.008;
const UNFOUND = [1.0, 0.62, 0.22]; // amber (city-light lanterns)
const FOUND = [1.0, 0.84, 0.47]; // golden, lit
const PULSE_HZ = 0.35; // slow

function buildSpriteTexture() {
  const data = new Uint8Array(N * N * 4);
  SPRITE.forEach((row, y) => {
    const ty = N - 1 - y;
    [...row].forEach((ch, x) => {
      const v = LEVEL[ch];
      if (v) data.set([v, v, v, 255], (ty * N + x) * 4);
    });
  });
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const toUnit = (lat, lng) => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
};

/**
 * Greedy screen-space clustering. `pts` = [{x,y,found}] (null = hidden).
 * Returns per-input cluster leader index (leader → itself). Pure: testable.
 */
export function clusterScreenPoints(pts, radiusPx = CLUSTER_PX) {
  const leader = new Int32Array(pts.length).fill(-1);
  const leaders = [];
  pts.forEach((p, i) => {
    if (!p) return;
    const hit = leaders.find((j) => Math.hypot(pts[j].x - p.x, pts[j].y - p.y) < radiusPx);
    if (hit === undefined) {
      leaders.push(i);
      leader[i] = i;
    } else leader[i] = hit;
  });
  return leader;
}

/** Beacon colour (linear RGB) for a lit fraction (0 = all unfound) at time t. */
export function beaconColor(litFraction, t, phase = 0) {
  const pulse = 0.32 + 0.18 * (0.5 + 0.5 * Math.sin(2 * Math.PI * PULSE_HZ * t + phase));
  const k = litFraction;
  const gain = pulse * (1 - k) + 1.0 * k;
  return UNFOUND.map((c, i) => (c * (1 - k) + FOUND[i] * k) * gain);
}

/**
 * One InstancedMesh of camera-facing pixel beacons (one draw call), sized in
 * screen px. MeshBasicMaterial + instanceColor: identical in WebGL and WebGPU
 * (no custom GLSL/TSL to keep in parity). Pulse is a CPU colour update (~60 inst).
 */
export function createMicroBeaconLayer(globe, admins, dataMap) {
  const list = [...admins].filter((a) => dataMap[a]?.lat != null);
  const count = list.length;
  const unit = list.map((a) => toUnit(dataMap[a].lat, dataMap[a].lng));
  const phases = list.map((_, i) => (i * 2.399) % (2 * Math.PI));
  const found = new Uint8Array(count);
  const radius = (globe.getGlobeRadius?.() || 100) * (1 + ALTITUDE);

  const map = buildSpriteTexture();
  const material = new THREE.MeshBasicMaterial({
    map,
    alphaTest: 0.5,
    toneMapped: false,
    depthWrite: true,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = "tvrs-micro-beacons";
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) mesh.setColorAt(i, color.setRGB(0, 0, 0));

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const p = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const look = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const screen = new Array(count);
  const world = new Float32Array(count * 3);
  const litSum = new Float32Array(count);
  const members = new Float32Array(count);

  mesh.onBeforeRender = (renderer, _scene, camera) => {
    if (!camera.isPerspectiveCamera) return;
    const t = reducedMotion ? 0 : performance.now() / 1000;
    camera.matrixWorld.extractBasis(right, up, look);
    camPos.setFromMatrixPosition(camera.matrixWorld);
    const w = renderer.domElement?.clientWidth || 800;
    const h = renderer.domElement?.clientHeight || 800;
    const fov = ((camera.fov || 50) * Math.PI) / 180;
    for (let i = 0; i < count; i++) {
      p.fromArray(unit[i]).multiplyScalar(radius);
      world[i * 3] = p.x;
      world[i * 3 + 1] = p.y;
      world[i * 3 + 2] = p.z;
      // Back side of the globe: skip (depth would hide it anyway, but it must
      // not join a front-side cluster).
      if (p.dot(camPos) <= radius * radius) {
        screen[i] = null;
        continue;
      }
      p.project(camera);
      screen[i] = { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
    }
    const leader = clusterScreenPoints(screen);
    litSum.fill(0);
    members.fill(0);
    for (let i = 0; i < count; i++) {
      if (leader[i] < 0) continue;
      litSum[leader[i]] += found[i];
      members[leader[i]] += 1;
    }
    for (let i = 0; i < count; i++) {
      if (leader[i] !== i) {
        mesh.setMatrixAt(i, zero);
        continue;
      }
      p.fromArray(world, i * 3);
      const worldPerPx = (2 * p.distanceTo(camPos) * Math.tan(fov / 2)) / h;
      const size = N * PX_PER_TEXEL * worldPerPx;
      m.makeBasis(right, up, look);
      m.scale(s.set(size, size, 1));
      m.setPosition(p);
      mesh.setMatrixAt(i, m);
      const [r, g, b] = beaconColor(litSum[i] / members[i], t, phases[i]);
      mesh.setColorAt(i, color.setRGB(r, g, b));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  const setFound = (foundList) => {
    const set = new Set(foundList);
    list.forEach((a, i) => (found[i] = set.has(a) ? 1 : 0));
  };

  let disposed = false;
  const scene = globe.scene();
  const renderer = globe.renderer?.();
  const camera = globe.camera?.();
  const attach = () => {
    if (!disposed) scene.add(mesh);
  };
  if (renderer?.compileAsync && camera) {
    renderer.compileAsync(mesh, camera, scene).then(attach, attach).catch(attach);
  } else {
    attach();
  }
  return {
    mesh,
    setFound,
    dispose() {
      disposed = true;
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      map.dispose();
      mesh.dispose?.();
    },
  };
}
