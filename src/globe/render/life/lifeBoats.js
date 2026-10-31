import * as THREE from "three";

import { LANDLOCKED, SEA_EDGES, SEA_NODES } from "./seaRoutes";

// Ring buffer of boats (one InstancedMesh, one draw call).
export const MAX_BOATS = 24;
// Beyond this a capital has no usable "port" waypoint.
const MAX_PORT_KM = 1600;
const EARTH_KM = 6371;
// Sprite size in screen pixels per texel: true square pixels.
const PX_PER_TEXEL = 2;
// Sea speed in radians of arc per second (≈ 50 km/s on screen time).
const SPEED = 0.008;
// Radius offset above the globe (radius 100) so boats sit over the ocean.
const ALTITUDE = 0.006;

// 12×6 side-view boat: dark warm hull, amber cabin and mast lamps, faint wake.
const SPRITE = [
  ".....m......",
  "....hah.....",
  ".hhaaaaahhh.",
  "hhhhhhhhhhhh",
  ".hhhhhhhhhh.",
  "w.w......w.w",
];
const SPRITE_W = SPRITE[0].length;
const SPRITE_H = SPRITE.length;
const PALETTE = {
  h: [110, 90, 64, 255],
  a: [255, 184, 77, 255],
  m: [255, 210, 122, 255],
  w: [61, 85, 102, 255],
};

function buildSpriteTexture() {
  const data = new Uint8Array(SPRITE_W * SPRITE_H * 4);
  SPRITE.forEach((row, y) => {
    // DataTexture rows start at the bottom.
    const ty = SPRITE_H - 1 - y;
    [...row].forEach((ch, x) => {
      const c = PALETTE[ch];
      if (c) data.set(c, (ty * SPRITE_W + x) * 4);
    });
  });
  const tex = new THREE.DataTexture(data, SPRITE_W, SPRITE_H, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const toUnit = (lat, lng) => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
};
const arc = (a, b) => Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

/** Sea graph in unit-sphere coords + Dijkstra. Pure: testable without WebGL. */
export function buildSeaGraph() {
  const index = new Map(SEA_NODES.map(([id], i) => [id, i]));
  const pos = SEA_NODES.map(([, lat, lng]) => toUnit(lat, lng));
  const adj = SEA_NODES.map(() => []);
  SEA_EDGES.split(/\s+/)
    .filter(Boolean)
    .forEach((edge) => {
      const [a, b] = edge.split("-").map((id) => index.get(id));
      if (a == null || b == null) throw new Error(`sea edge: ${edge}`);
      const w = arc(pos[a], pos[b]);
      adj[a].push([b, w]);
      adj[b].push([a, w]);
    });

  const portCache = new Map();
  const portOf = (lat, lng) => {
    const key = `${lat},${lng}`;
    if (portCache.has(key)) return portCache.get(key);
    const p = toUnit(lat, lng);
    let best = -1;
    let bestD = Infinity;
    pos.forEach((q, i) => {
      const d = arc(p, q);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const port = bestD * EARTH_KM <= MAX_PORT_KM ? best : -1;
    portCache.set(key, port);
    return port;
  };

  const path = (from, to) => {
    const dist = new Float64Array(pos.length).fill(Infinity);
    const prev = new Int32Array(pos.length).fill(-1);
    const done = new Uint8Array(pos.length);
    dist[from] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < pos.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity) return null;
      if (u === to) break;
      done[u] = 1;
      adj[u].forEach(([v, w]) => {
        if (dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          prev[v] = u;
        }
      });
    }
    const out = [];
    for (let v = to; v >= 0; v = prev[v]) out.unshift(v);
    return out;
  };

  return { pos, portOf, path, nodeCount: pos.length };
}

/**
 * Routes for the found countries, in discovery order: each newly found coastal
 * country sends one boat to the nearest already-found coastal country with a
 * different port. Only found countries are linked (no hint about the others).
 */
export function planBoatRoutes(graph, foundList, dataMap) {
  const ports = [];
  const routes = [];
  foundList.forEach((admin) => {
    const c = dataMap[admin];
    if (!c || c.lat == null || LANDLOCKED.has(c.iso2)) return;
    const port = graph.portOf(c.lat, c.lng);
    if (port < 0) return;
    let target = -1;
    let targetD = Infinity;
    ports.forEach((p) => {
      if (p === port) return;
      const d = arc(graph.pos[port], graph.pos[p]);
      if (d < targetD) {
        targetD = d;
        target = p;
      }
    });
    if (!ports.includes(port)) ports.push(port);
    if (target < 0) return;
    const nodes = graph.path(port, target);
    if (nodes && nodes.length > 1) routes.push(nodes);
  });
  return routes.slice(-MAX_BOATS);
}

/**
 * One InstancedMesh of camera-facing pixel-art boats. Positions are updated in
 * onBeforeRender from preallocated buffers (no per-frame allocation) and the
 * sprite is sized in screen pixels, so texels stay square at every zoom.
 * MeshBasicMaterial + alphaTest renders identically under WebGL and WebGPU.
 */
export function createBoatLayer(globe) {
  const graph = buildSeaGraph();
  const radius = (globe.getGlobeRadius?.() || 100) * (1 + ALTITUDE);
  const map = buildSpriteTexture();
  const material = new THREE.MeshBasicMaterial({
    map,
    alphaTest: 0.5,
    transparent: false,
    toneMapped: false,
    depthWrite: true,
  });
  // Anchor at the bottom edge so the waterline sits on the route point.
  const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_BOATS);
  mesh.name = "tvrs-life-boats";
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 2;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Per boat: up to MAX_LEGS+1 points (unit vectors) and cumulative arc length.
  const MAX_PTS = 32;
  const pts = new Float32Array(MAX_BOATS * MAX_PTS * 3);
  const cum = new Float32Array(MAX_BOATS * MAX_PTS);
  const npts = new Int32Array(MAX_BOATS);
  const phase = new Float32Array(MAX_BOATS);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Scratch objects (reused every frame).
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const look = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const toScreenDir = new THREE.Vector3();

  const pointAt = (b, s, out) => {
    const base = b * MAX_PTS;
    const n = npts[b];
    let i = 1;
    while (i < n - 1 && cum[base + i] < s) i++;
    const s0 = cum[base + i - 1];
    const s1 = cum[base + i];
    const t = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    const a = (base + i - 1) * 3;
    const c = (base + i) * 3;
    // nlerp along the leg: close enough to slerp for these short arcs.
    out.set(
      pts[a] + (pts[c] - pts[a]) * t,
      pts[a + 1] + (pts[c + 1] - pts[a + 1]) * t,
      pts[a + 2] + (pts[c + 2] - pts[a + 2]) * t
    );
    return out.normalize();
  };

  mesh.onBeforeRender = (renderer, _scene, camera) => {
    if (mesh.count === 0 || !camera.isPerspectiveCamera) return;
    const now = reducedMotion ? 0 : performance.now() / 1000;
    camera.matrixWorld.extractBasis(right, up, look);
    camPos.setFromMatrixPosition(camera.matrixWorld);
    const h = renderer.domElement?.clientHeight || 800;
    const fov = ((camera.fov || 50) * Math.PI) / 180;
    for (let b = 0; b < mesh.count; b++) {
      const len = cum[b * MAX_PTS + npts[b] - 1];
      // Ping-pong along the route.
      let s = (now * SPEED + phase[b]) % (2 * len);
      const back = s > len;
      if (back) s = 2 * len - s;
      pointAt(b, s, p);
      pointAt(b, Math.min(len, s + 0.002), q);
      if (s + 0.002 > len) q.sub(p).negate().add(p);
      toScreenDir.copy(q).sub(p);
      // Bow faces the travel direction on screen (flip the sprite horizontally).
      const goingRight = toScreenDir.dot(right) >= 0 !== back;
      p.multiplyScalar(radius);
      const worldPerPx = (2 * p.distanceTo(camPos) * Math.tan(fov / 2)) / h;
      const sx = SPRITE_W * PX_PER_TEXEL * worldPerPx * (goingRight ? -1 : 1);
      const sy = SPRITE_H * PX_PER_TEXEL * worldPerPx;
      // Tiny radial lift above the ocean surface to avoid z-fighting.
      p.multiplyScalar(1.002);
      m.makeBasis(right, up, look);
      m.scale(q.set(sx, sy, 1));
      m.setPosition(p);
      mesh.setMatrixAt(b, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  let lastKey = "";
  const setFound = (foundList, dataMap) => {
    const key = foundList.join("|");
    if (key === lastKey) return;
    lastKey = key;
    const routes = planBoatRoutes(graph, foundList, dataMap);
    routes.forEach((nodes, b) => {
      const n = Math.min(nodes.length, MAX_PTS);
      const base = b * MAX_PTS;
      let total = 0;
      for (let i = 0; i < n; i++) {
        const v = graph.pos[nodes[i]];
        pts.set(v, (base + i) * 3);
        if (i > 0) total += arc(graph.pos[nodes[i - 1]], v);
        cum[base + i] = total;
      }
      npts[b] = n;
      // Spread boats along their lanes, deterministic per route.
      phase[b] = (((nodes[0] * 7919 + nodes[n - 1] * 104729) % 1000) / 1000) * 2 * total;
    });
    mesh.count = routes.length;
  };

  // Compile the boat program off the critical path before the layer shows up,
  // so the first fleet does not cause a shader-compile hitch on a find.
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
