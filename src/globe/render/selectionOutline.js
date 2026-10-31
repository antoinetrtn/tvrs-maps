/**
 * Pixel-art outline of the selected country, drawn ON its surface (no extrusion).
 * The country is rasterised once per selection on a lat/lng grid aligned on global
 * multiples of the cell size (square pixels, like the city-light texture): inside
 * cells touching the outside form the thin bright border (255); the next HALO_RINGS
 * rings in carry a fading soft halo (HALO_VALUES), pulsed by the shader. Read by the GLSL glitch shader and its TSL twin through the same
 * texture + `uSelOutlineBox` (lng0°, lat0°, cell°, size).
 */
import * as THREE from "three";

// One byte per cell; large enough that a country with far-flung parts (France with
// Guyane/Réunion, USA with Alaska/Hawaii) keeps a fine grid over its whole extent.
const N = 1024;
const CELLS = [
  0.0025, 0.005, 0.0075, 0.01, 0.015, 0.02, 0.025, 0.035, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3,
  0.4, 0.5, 0.75, 1, 1.5, 2, 3, 4,
];
// Longest side of the MAIN landmass, in cells (only bites on very large countries):
// finer grid = thinner one-pixel border, never coarser than needed for Russia/Canada.
// Sized on the largest polygon, not the whole bbox, so overseas parts never coarsen it.
const MAX_CELLS = 400;
export const OUTLINE_TEX_SIZE = N;
export const EDGE_VALUE = 255;
export const HALO_VALUES = [170, 115, 60];
const data = new Uint8Array(N * N);
let tex = null;
let current = null;

export const selectionOutlineBox = { value: new THREE.Vector4(0, 0, 1, 1) };

export function getSelectionOutlineTexture() {
  if (!tex) {
    tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
  }
  return tex;
}

const polysOf = ({ type, coordinates } = {}) =>
  type === "Polygon" ? [coordinates] : type === "MultiPolygon" ? coordinates : [];

const extentOf = (ring) => {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [x, y] of ring) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
};

/** Grid cell (degrees) for a geometry: driven by its main landmass, capped by the texture. */
function pickOutlineCell(mainExtent, fullExtent) {
  return (
    CELLS.find((c) => mainExtent / c <= MAX_CELLS && fullExtent / c <= N - 8) ||
    CELLS[CELLS.length - 1]
  );
}

/** Rasterises `geometry` (GeoJSON, [lng, lat]) into the outline texture. Pure data, testable. */
export function rasterizeOutline(geometry, out = data) {
  const polys = polysOf(geometry || {}).filter((p) => p?.[0]?.length);
  out.fill(0);
  if (!polys.length) return null;
  // Main landmass = outer ring with the largest bbox; unwrap longitudes around it so
  // antimeridian countries (Russia, Fiji) stay contiguous.
  const main = polys
    .map((p) => extentOf(p[0]))
    .reduce((best, e) => (e.w * e.h > best.w * best.h ? e : best));
  const ref = (main.x0 + main.x1) / 2;
  const refLat = (main.y0 + main.y1) / 2;
  const cosLat = Math.max(0.15, Math.cos((refLat * Math.PI) / 180));
  const wrap = (lng) => lng + Math.round((ref - lng) / 360) * 360;
  const pts = polys.flat().map((r) => r.map(([lng, lat]) => [wrap(lng), lat]));
  const { x0, x1, y0, y1 } = extentOf(pts.flat());
  const mainPhysical = Math.max(main.w * cosLat, main.h);
  const fullPhysical = Math.max((x1 - x0) * cosLat, y1 - y0);
  const cellY = pickOutlineCell(mainPhysical, fullPhysical);
  const cellX = cellY / cosLat;
  const ox = Math.floor(x0 / cellX) - 2,
    oy = Math.floor(y0 / cellY) - 2;
  const w = Math.min(N, Math.ceil(x1 / cellX) - ox + 3),
    h = Math.min(N, Math.ceil(y1 / cellY) - oy + 3);
  const inside = new Uint8Array(N * N);
  for (let j = 0; j < h; j++) {
    const lat = (oy + j + 0.5) * cellY;
    const xs = [];
    for (const r of pts)
      for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
        const [ax, ay] = r[i],
          [bx, by] = r[k];
        if (ay > lat !== by > lat) xs.push(ax + ((lat - ay) / (by - ay)) * (bx - ax));
      }
    xs.sort((a, b) => a - b);
    for (let p = 0; p + 1 < xs.length; p += 2)
      for (
        let i = Math.max(0, Math.ceil(xs[p] / cellX - ox - 0.5));
        i < w && (ox + i + 0.5) * cellX < xs[p + 1];
        i++
      )
        inside[j * N + i] = 1;
  }
  // Islets/microstates thinner than a cell: light the cell under their centre, so
  // Monaco or an atoll still shows one amber pixel instead of nothing.
  for (const r of pts) {
    const e = extentOf(r);
    const i = Math.floor((e.x0 + e.x1) / 2 / cellX) - ox,
      j = Math.floor((e.y0 + e.y1) / 2 / cellY) - oy;
    if (e.w < cellX * 2 && e.h < cellY * 2 && i >= 0 && j >= 0 && i < w && j < h)
      inside[j * N + i] = 1;
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? 0 : inside[j * N + i]);
  const nb = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  // Ring distance from the border, walked inwards (0 = border cell).
  const dist = new Uint8Array(N * N).fill(255);
  let front = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (at(i, j) && nb.some(([a, b]) => !at(i + a, j + b))) {
        dist[j * N + i] = 0;
        front.push([i, j]);
      }
  for (let d = 1; d <= HALO_VALUES.length; d++) {
    const next = [];
    for (const [i, j] of front)
      for (const [a, b] of nb) {
        const x = i + a,
          y = j + b;
        if (at(x, y) && dist[y * N + x] === 255) {
          dist[y * N + x] = d;
          next.push([x, y]);
        }
      }
    front = next;
  }
  for (let k = 0; k < N * N; k++)
    out[k] =
      dist[k] === 0 ? EDGE_VALUE : dist[k] <= HALO_VALUES.length ? HALO_VALUES[dist[k] - 1] : 0;
  return { ox: ox * cellX, oy: oy * cellY, cellX, cellY, cell: cellY };
}

/** Called when a country gets the selection shader; rebuilds only when it changes. */
export function setSelectionOutline(admin, geometry) {
  if (!admin || admin === current) return;
  current = admin;
  const box = rasterizeOutline(geometry);
  selectionOutlineBox.value.set(box?.ox ?? 0, box?.oy ?? 0, box?.cellX ?? 1, box?.cellY ?? 1);
  getSelectionOutlineTexture().needsUpdate = true;
}
