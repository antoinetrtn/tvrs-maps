/**
 * Pixel-art outline of the selected country, drawn ON its surface (no extrusion).
 * The country is rasterised once per selection on a lat/lng grid aligned on global
 * multiples of the cell size (square pixels, like the city-light texture): inside
 * cells touching the outside form the bright ring (255), the next ring in is dim
 * (128). Read by the GLSL glitch shader and its TSL twin through the same
 * texture + `uSelOutlineBox` (lng0°, lat0°, cell°, size).
 */
import * as THREE from "three";

const N = 128;
const CELLS = [0.1, 0.2, 0.25, 0.4, 0.5, 1, 2, 4];
const data = new Uint8Array(N * N * 4);
let tex = null;
let current = null;

export const selectionOutlineBox = { value: new THREE.Vector4(0, 0, 1, 0) };

export function getSelectionOutlineTexture() {
  if (!tex) {
    tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
  }
  return tex;
}

const ringsOf = ({ type, coordinates } = {}) =>
  type === "Polygon" ? coordinates : type === "MultiPolygon" ? coordinates.flat() : [];

/** Rasterises `geometry` (GeoJSON, [lng, lat]) into the outline texture. Pure data, testable. */
export function rasterizeOutline(geometry, out = data) {
  const rings = ringsOf(geometry || {});
  out.fill(0);
  if (!rings.length) return null;
  // Unwrap longitudes around the first vertex so antimeridian countries stay contiguous.
  const ref = rings[0][0][0];
  const wrap = (lng) => lng + Math.round((ref - lng) / 360) * 360;
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  const pts = rings.map((r) =>
    r.map(([lng, lat]) => {
      const x = wrap(lng);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, lat);
      y1 = Math.max(y1, lat);
      return [x, lat];
    })
  );
  const cell = CELLS.find((c) => Math.max(x1 - x0, y1 - y0) / c <= 60) || CELLS[CELLS.length - 1];
  const ox = Math.floor(x0 / cell) - 2,
    oy = Math.floor(y0 / cell) - 2;
  const w = Math.min(N, Math.ceil(x1 / cell) - ox + 3),
    h = Math.min(N, Math.ceil(y1 / cell) - oy + 3);
  const inside = new Uint8Array(N * N);
  for (let j = 0; j < h; j++) {
    const lat = (oy + j + 0.5) * cell;
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
        let i = Math.max(0, Math.ceil(xs[p] / cell - ox - 0.5));
        i < w && (ox + i + 0.5) * cell < xs[p + 1];
        i++
      )
        inside[j * N + i] = 1;
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? 0 : inside[j * N + i]);
  const ring = (i, j, v) =>
    !at(i - 1, j) === v || !at(i + 1, j) === v || !at(i, j - 1) === v || !at(i, j + 1) === v;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (!at(i, j)) continue;
      const outer = ring(i, j, true);
      const inner =
        !outer &&
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ].some(([a, b]) => at(i + a, j + b) && ring(i + a, j + b, true));
      out[(j * N + i) * 4] = outer ? 255 : inner ? 128 : 0;
    }
  return { ox: ox * cell, oy: oy * cell, cell };
}

/** Called when a country gets the selection shader; rebuilds only when it changes. */
export function setSelectionOutline(admin, geometry) {
  if (!admin || admin === current) return;
  current = admin;
  const box = rasterizeOutline(geometry);
  selectionOutlineBox.value.set(box?.ox ?? 0, box?.oy ?? 0, box?.cell ?? 1, box ? N : 0);
  getSelectionOutlineTexture().needsUpdate = true;
}
