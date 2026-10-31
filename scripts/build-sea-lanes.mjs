#!/usr/bin/env node
// Bakes the boats' sea lanes against the land mask (the drawn country polygons) so
// land: each authored waypoint (src/globe/render/life/seaRoutes.js) is snapped
// onto open sea, each authored edge is routed on the 0.25° sea grid (A*, coast
// penalty) and simplified to the fewest great-circle legs that stay at sea.
// Output: src/globe/render/life/seaLanes.generated.js. Usage: node scripts/build-sea-lanes.mjs
import fs from "node:fs";

import { SEA_EDGES, SEA_NODES } from "../src/globe/render/life/seaRoutes.js";
import { loadLandMask, sampleLeg, texelOf } from "./lib/landMask.mjs";

const mask = loadLandMask();
const { w, h, land } = mask;
const DEG = 360 / w;
const sea = (i) => land[i] === 0;
// Open sea: the texel and its 8 neighbours are sea (keeps a coast margin).
const open = new Uint8Array(w * h);
for (let y = 1; y < h - 1; y++)
  for (let x = 0; x < w; x++) {
    let ok = 1;
    for (let dy = -1; dy <= 1 && ok; dy++)
      for (let dx = -1; dx <= 1; dx++) if (land[(y + dy) * w + ((x + dx + w) % w)]) ok = 0;
    open[y * w + x] = ok;
  }
const centre = (i) => [
  +((Math.floor(i / w) + 0.5) * DEG - 90).toFixed(3),
  +(((i % w) + 0.5) * DEG - 180).toFixed(3),
];

function snap(lat, lng) {
  const start = texelOf(mask, lat, lng);
  if (open[start]) return start;
  const seen = new Set([start]);
  let frontier = [start];
  let fallback = -1;
  for (let r = 0; r < 40 && frontier.length; r++) {
    const next = [];
    for (const i of frontier) {
      if (open[i]) return i;
      if (fallback < 0 && sea(i)) fallback = i;
      const x = i % w;
      const y = Math.floor(i / w);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          const j = yy * w + ((x + dx + w) % w);
          if (!seen.has(j)) {
            seen.add(j);
            next.push(j);
          }
        }
    }
    if (fallback >= 0 && r > 2) return fallback;
    frontier = next;
  }
  return fallback;
}

// Binary-heap A* on the sea grid (8-connected, wraps in longitude).
function route(s, t) {
  const g = new Float32Array(w * h).fill(Infinity);
  const prev = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);
  const heap = [];
  const hx = (i) => {
    const dx = Math.abs((i % w) - (t % w));
    const ddx = Math.min(dx, w - dx);
    const ddy = Math.abs(Math.floor(i / w) - Math.floor(t / w));
    return Math.max(ddx, ddy) + 0.414 * Math.min(ddx, ddy);
  };
  const push = (f, i) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  g[s] = 0;
  push(hx(s), s);
  while (heap.length) {
    const [, u] = pop();
    if (closed[u]) continue;
    closed[u] = 1;
    if (u === t) break;
    const x = u % w;
    const y = Math.floor(u / w);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const yy = y + dy;
        if (yy < 1 || yy >= h - 1) continue;
        const v = yy * w + ((x + dx + w) % w);
        if (!sea(v)) continue;
        // Diagonal moves need one sea side texel (inserted below, so every
        // step of the path shares an edge and its leg stays in sea texels).
        if (dx && dy && !sea(y * w + ((x + dx + w) % w)) && !sea(yy * w + x)) continue;
        const c = (dx && dy ? 1.414 : 1) * (open[v] ? 1 : 6);
        if (g[u] + c < g[v]) {
          g[v] = g[u] + c;
          prev[v] = u;
          push(g[v] + hx(v), v);
        }
      }
  }
  if (g[t] === Infinity) return null;
  const raw = [];
  for (let v = t; v >= 0; v = prev[v]) raw.unshift(v);
  const out = [raw[0]];
  for (let k = 1; k < raw.length; k++) {
    const a = raw[k - 1];
    const b = raw[k];
    const ax = a % w;
    const bx = b % w;
    const ay = Math.floor(a / w);
    const by = Math.floor(b / w);
    if (ax !== bx && ay !== by) {
      const side = ay * w + bx;
      out.push(sea(side) ? side : by * w + ax);
    }
    out.push(b);
  }
  return out;
}

// A leg is valid if every dense sample is open sea or a texel of the grid path.
function legOk(a, b, allowed) {
  return sampleLeg(a, b).every(([la, lo]) => {
    const i = texelOf(mask, la, lo);
    return sea(i) && (open[i] || allowed.has(i));
  });
}
function simplify(path) {
  const allowed = new Set(path);
  const pts = path.map(centre);
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !legOk(pts[i], pts[j], allowed)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

const nodes = {};
const texel = {};
for (const [id, lat, lng] of SEA_NODES) {
  const i = snap(lat, lng);
  if (i < 0) throw new Error(`no sea near ${id}`);
  texel[id] = i;
  nodes[id] = centre(i);
}
const lanes = {};
const dropped = [];
for (const edge of SEA_EDGES.split(/\s+/).filter(Boolean)) {
  const [a, b] = edge.split("-");
  const path = route(texel[a], texel[b]);
  if (!path) {
    dropped.push(edge);
    continue;
  }
  const poly = simplify(path);
  poly[0] = nodes[a];
  poly[poly.length - 1] = nodes[b];
  lanes[edge] = poly.slice(1, -1);
}

const body = `// GENERATED by scripts/build-sea-lanes.mjs from seaRoutes.js + the land mask. Do not edit.
// Waypoints snapped to open sea, and the via points of each sea lane (all legs stay at sea).
export const SEA_NODE_POS = ${JSON.stringify(nodes)};
export const SEA_LANES = ${JSON.stringify(lanes)};
`;
fs.writeFileSync(new URL("../src/globe/render/life/seaLanes.generated.js", import.meta.url), body);
const vias = Object.values(lanes).reduce((s, v) => s + v.length, 0);
console.log(
  `${Object.keys(lanes).length} lanes, ${vias} via points, dropped (no sea path): ${dropped.join(" ") || "none"}`
);
