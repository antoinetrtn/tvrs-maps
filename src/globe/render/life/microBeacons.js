import * as THREE from "three";

// Found: 5×5 golden lantern. Unfound: small 3×3 neutral cross, so a dark game
// start does not read as "already lit". Grey levels, tinted per instance; true
// square pixels (screen px per texel is an integer).
const SPRITE_FOUND = ["..o..", ".oxo.", "oxXxo", ".oxo.", "..o.."];
const SPRITE_UNFOUND = [".o.", "oXo", ".o."];
const LEVEL = { o: 110, x: 200, X: 255 };
const PX_PER_TEXEL = 2; // found 10×10 px, unfound 6×6 px, constant at every zoom
const CLUSTER_PX = 14; // beacons closer than this on screen merge into one
const ALTITUDE = 0.008;
const UNFOUND = [0.55, 0.62, 0.72]; // cool neutral grey-blue (blackout family)
const FOUND = [1.0, 0.84, 0.47]; // golden, lit
const PULSE_HZ = 0.2; // slow, barely-there breathing
const POP_S = 0.6; // discovery pop: 6 → 12 → 10 px, gain 1.4 → 1.0

/** Discovery pop at age `a` seconds: { scale, gain } (1,1 once settled). */
export function beaconPop(a) {
  if (!Number.isFinite(a) || a < 0 || a >= POP_S) return { scale: 1, gain: 1 };
  const k = a / POP_S;
  // Integer texel steps keep pixels square: 12 px for the first half, then 10.
  return { scale: k < 0.5 ? 1.2 : 1, gain: 1.4 - 0.4 * k };
}

function buildSpriteTexture(SPRITE) {
  const N = SPRITE.length;
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
  const pulse = 0.22 + 0.1 * (0.5 + 0.5 * Math.sin(2 * Math.PI * PULSE_HZ * t + phase));
  const k = litFraction;
  const gain = pulse * (1 - k) + 1.0 * k;
  return UNFOUND.map((c, i) => (c * (1 - k) + FOUND[i] * k) * gain);
}

function projectBeaconsToScreen({ count, unit, radius, camPos, camera, w, h, p, world, screen }) {
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
}

function aggregateClusterStats(count, leader, found, litSum, members) {
  litSum.fill(0);
  members.fill(0);
  for (let i = 0; i < count; i++) {
    if (leader[i] < 0) {
      continue;
    }
    litSum[leader[i]] += found[i];
    members[leader[i]] += 1;
  }
}

function updateBeaconInstances({
  count,
  leader,
  mesh,
  dim,
  zero,
  litSum,
  members,
  reducedMotion,
  now,
  foundAt,
  p,
  world,
  camPos,
  fov,
  h,
  m,
  right,
  up,
  look,
  s,
  t,
  phases,
  color,
}) {
  for (let i = 0; i < count; i++) {
    if (leader[i] !== i) {
      mesh.setMatrixAt(i, zero);
      dim.setMatrixAt(i, zero);
      continue;
    }
    const lit = litSum[i] / members[i];
    const target = lit > 0 ? mesh : dim;
    const inactive = lit > 0 ? dim : mesh;
    inactive.setMatrixAt(i, zero);
    const pop = beaconPop(reducedMotion ? -1 : now - foundAt[i]);
    p.fromArray(world, i * 3);
    const worldPerPx = (2 * p.distanceTo(camPos) * Math.tan(fov / 2)) / h;
    const size = target.userData.texels * PX_PER_TEXEL * pop.scale * worldPerPx;
    m.makeBasis(right, up, look);
    m.scale(s.set(size, size, 1));
    m.setPosition(p);
    target.setMatrixAt(i, m);
    const [r, g, b] = beaconColor(lit, t, phases[i]);
    target.setColorAt(i, color.setRGB(r * pop.gain, g * pop.gain, b * pop.gain));
  }
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

  const foundAt = new Float64Array(count).fill(-1);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const color = new THREE.Color();
  const makeLayer = (sprite, name) => {
    const map = buildSpriteTexture(sprite);
    const material = new THREE.MeshBasicMaterial({
      map,
      alphaTest: 0.5,
      toneMapped: false,
      depthWrite: true,
    });
    const im = new THREE.InstancedMesh(geometry, material, count);
    im.name = name;
    im.frustumCulled = false;
    im.renderOrder = 2;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) im.setColorAt(i, color.setRGB(0, 0, 0));
    im.userData.texels = sprite.length;
    return im;
  };
  // Two instanced draws (one per sprite); both plain MeshBasicMaterial, so the
  // look is identical in WebGL and WebGPU. Group = scene node, mesh = updater.
  const mesh = makeLayer(SPRITE_FOUND, "tvrs-micro-beacons");
  const dim = makeLayer(SPRITE_UNFOUND, "tvrs-micro-beacons-unfound");
  const group = new THREE.Group();
  group.name = "tvrs-micro-beacons-layer";
  group.add(dim, mesh);

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
    const now = performance.now() / 1000;
    const t = reducedMotion ? 0 : now;
    camera.matrixWorld.extractBasis(right, up, look);
    camPos.setFromMatrixPosition(camera.matrixWorld);
    const w = renderer.domElement?.clientWidth || 800;
    const h = renderer.domElement?.clientHeight || 800;
    const fov = ((camera.fov || 50) * Math.PI) / 180;

    projectBeaconsToScreen({ count, unit, radius, camPos, camera, w, h, p, world, screen });
    const leader = clusterScreenPoints(screen);
    aggregateClusterStats(count, leader, found, litSum, members);
    updateBeaconInstances({
      count,
      leader,
      mesh,
      dim,
      zero,
      litSum,
      members,
      reducedMotion,
      now,
      foundAt,
      p,
      world,
      camPos,
      fov,
      h,
      m,
      right,
      up,
      look,
      s,
      t,
      phases,
      color,
    });

    for (const im of [mesh, dim]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  };

  let initialised = false;
  const setFound = (foundList) => {
    const set = new Set(foundList);
    const now = performance.now() / 1000;
    list.forEach((a, i) => {
      const f = set.has(a) ? 1 : 0;
      // Pop only on a live discovery, not when a saved game restores its finds.
      if (f && !found[i] && initialised) foundAt[i] = now;
      found[i] = f;
    });
    initialised = true;
  };

  let disposed = false;
  const scene = globe.scene();
  const renderer = globe.renderer?.();
  const camera = globe.camera?.();
  const attach = () => {
    if (!disposed) scene.add(group);
  };
  if (renderer?.compileAsync && camera) {
    renderer.compileAsync(group, camera, scene).then(attach, attach).catch(attach);
  } else {
    attach();
  }
  return {
    // Scene node (visibility toggles both sprites).
    mesh: group,
    setFound,
    dispose() {
      disposed = true;
      group.removeFromParent();
      geometry.dispose();
      for (const im of [mesh, dim]) {
        im.material.map?.dispose();
        im.material.dispose();
        im.dispose?.();
      }
    },
  };
}
