/**
 * Selection outline brick (one for every country, department and state): a coverage
 * mask of the selected feature on a lat/lng grid (1 = inside), sampled bilinearly by the
 * GLSL glitch shader and its TSL twin. The shader turns the mask's 0.5 contour into a
 * line of constant SCREEN width (fwidth), hard-stepped for a crisp pixel look, so the
 * border is equally thin on Monaco, Russia, a département or Antarctica at any zoom/DPR.
 * Polar rows are padded (no ring at the pole) and 360°-wide features wrap seamlessly
 * (no seam line on the antimeridian). Shader inputs: texture + `uSelOutlineBox`
 * (lng0°, lat0°, cell°, 360/cell or 0 when empty) + `uSelOutlinePx` (line width, device px).
 */
import * as THREE from "three";

// One byte per cell; large enough that a country with far-flung parts (France with
// Guyane/Réunion, USA with Alaska/Hawaii) keeps a fine grid over its whole extent.
const N = 1024;
const CELLS = [
  0.02, 0.035, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 3, 4,
];
// Longest side of the MAIN landmass, in cells (only bites on very large countries):
// finer grid = thinner one-pixel border, never coarser than needed for Russia/Canada.
// Sized on the largest polygon, not the whole bbox, so overseas parts never coarsen it.
const MAX_CELLS = 1000;
export const OUTLINE_TEX_SIZE = N;
export const INSIDE_VALUE = 255;
/** Outline width in CSS px (× renderer pixel ratio → device px, see setSelectionOutlineDpr). */
export const OUTLINE_CSS_PX = 1.5;
const data = new Uint8Array(N * N);
let tex = null;
let current = null;

export const selectionOutlineBox = { value: new THREE.Vector4(0, 0, 1, 0) };
export const selectionOutlinePx = { value: OUTLINE_CSS_PX };

/** Keeps the line at OUTLINE_CSS_PX CSS pixels whatever the renderer pixel ratio. */
export function setSelectionOutlineDpr(pixelRatio = 1) {
  selectionOutlinePx.value = OUTLINE_CSS_PX * Math.max(1, pixelRatio || 1);
}

export function getSelectionOutlineTexture() {
  if (!tex) {
    tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
    // Bilinear: the shader reads the mask's 0.5 contour as a smooth field.
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
  }
  return tex;
}

const polysOf = ({ type, coordinates } = {}) => {
  if (type === "Polygon") return [coordinates];
  if (type === "MultiPolygon") return coordinates;
  return [];
};

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
  return CELLS.find((c) => mainExtent / c <= MAX_CELLS && fullExtent / c <= N - 8) || CELLS.at(-1);
}

function preparePolygonRings(polys) {
  const main = polys
    .map((p) => extentOf(p[0]))
    .reduce((best, e) => (e.w * e.h > best.w * best.h ? e : best));
  const ref = (main.x0 + main.x1) / 2;
  const wraps = main.w >= 359;
  const wrap = wraps ? (lng) => lng : (lng) => lng + Math.round((ref - lng) / 360) * 360;
  const pts = polys.flat().map((r) => r.map(([lng, lat]) => [wrap(lng), lat]));
  const full = extentOf(pts.flat());
  const cell = wraps
    ? CELLS.find((c) => 360 / c <= N - 8)
    : pickOutlineCell(Math.max(main.w, main.h), Math.max(full.w, full.h));
  return { pts, full, cell, wraps };
}

function findIntersectionsAtLat(pts, lat) {
  const xs = [];
  for (const r of pts) {
    for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
      const [ax, ay] = r[i];
      const [bx, by] = r[k];
      if (ay > lat !== by > lat) {
        xs.push(ax + ((lat - ay) / (by - ay)) * (bx - ax));
      }
    }
  }
  xs.sort((p, q) => p - q);
  return xs;
}

function advanceIntersectionIndex(lng, xs, startIndex) {
  let n = startIndex;
  while (n < xs.length && xs[n] < lng) {
    n++;
  }
  return n;
}

function fillRowCells(j, { ox, w, cell, wraps, xs, inside }) {
  const shift = wraps ? (lng) => lng - Math.floor((lng + 180) / 360) * 360 : (lng) => lng;
  let n = 0;
  let prev = -Infinity;
  const rowOffset = j * N;

  for (let i = 0; i < w; i++) {
    const lng = shift((ox + i + 0.5) * cell);
    const startIdx = lng < prev ? 0 : n;
    n = advanceIntersectionIndex(lng, xs, startIdx);
    prev = lng;
    if (n % 2) {
      inside[rowOffset + i] = INSIDE_VALUE;
    }
  }
}

function rasterizeRow(j, { oy, ox, w, cell, wraps, pts, inside }) {
  const lat = Math.max(-90 + cell / 2, Math.min(90 - cell / 2, (oy + j + 0.5) * cell));
  const xs = findIntersectionsAtLat(pts, lat);
  fillRowCells(j, { ox, w, cell, wraps, xs, inside });
}

function rasterizeMicrostates({ pts, ox, oy, w, h, cell, inside }) {
  for (const r of pts) {
    const e = extentOf(r);
    const i = Math.floor((e.x0 + e.x1) / 2 / cell) - ox;
    const j = Math.floor((e.y0 + e.y1) / 2 / cell) - oy;
    if (e.w < cell * 2 && e.h < cell * 2 && i >= 0 && j >= 0 && i < w && j < h) {
      inside[j * N + i] = INSIDE_VALUE;
    }
  }
}

/** Rasterises `geometry` (GeoJSON, [lng, lat]) into the outline texture. Pure data, testable. */
export function rasterizeOutline(geometry, out = data) {
  const polys = polysOf(geometry || {}).filter((p) => p?.[0]?.length);
  out.fill(0);
  if (!polys.length) return null;

  const { pts, full, cell, wraps } = preparePolygonRings(polys);
  const x0 = wraps ? -180 : full.x0;
  const x1 = wraps ? 180 : full.x1;
  const ox = Math.floor(x0 / cell) - 2;
  const oy = Math.floor(full.y0 / cell) - 2;
  const w = Math.min(N, Math.ceil(x1 / cell) - ox + 3);
  const h = Math.min(N, Math.ceil(full.y1 / cell) - oy + 3);

  for (let j = 0; j < h; j++) {
    rasterizeRow(j, { oy, ox, w, cell, wraps, pts, inside: out });
  }

  // Islets/microstates thinner than a cell: light the cell under their centre, so
  // Monaco or an atoll still shows an amber pixel instead of nothing.
  rasterizeMicrostates({ pts, ox, oy, w, h, cell, inside: out });

  return { ox: ox * cell, oy: oy * cell, cell, period: wraps ? Math.round(360 / cell) : 0 };
}

/** Called when a country gets the selection shader; rebuilds only when it changes. */
export function setSelectionOutline(admin, geometry) {
  if (!admin || admin === current) return;
  current = admin;
  const box = rasterizeOutline(geometry);
  // w: wrap period in cells for circumpolar features, else a large value (no wrap); 0 = empty.
  selectionOutlineBox.value.set(
    box?.ox ?? 0,
    box?.oy ?? 0,
    box?.cell ?? 1,
    box ? box.period || 1e6 : 0
  );
  getSelectionOutlineTexture().needsUpdate = true;
}
