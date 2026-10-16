/**
 * Country highlight of an opponent's selection (Conquête spatial cursors):
 * a translucent surface in the player's colour + a flat outline ribbon, both
 * drawn as plain unlit meshes just above the globe polygons (works the same
 * under WebGL and WebGPU). Several players on one country are told apart by
 * inset outlines (double liseré) and complementary dither phases.
 */
import * as THREE from "three";
import ConicPolygonGeometry from "three-conic-polygon-geometry";

const GLOBE_RADIUS = 100;
const DEG = Math.PI / 180;
/** Longest ribbon segment (rad): long borders are subdivided to hug the sphere. */
const MAX_SEGMENT_RAD = 2.5 * DEG;
/** Outline: half width / slot spacing in screen px (the ribbon is rebuilt per zoom bucket). */
const RIBBON_HALF_PX = 0.9;
const SLOT_INSET_PX = 5;
const ZOOM_BUCKET = 1.35;
/** Dither cell (degrees of the country's bounding box). */
const DITHER_CELL_DEG = 0.9;
const FILL_OPACITY = 0.34;
const FILL_CURVATURE = 4;

export const surfaceRadius = (alt) => GLOBE_RADIUS * (1 + alt);

/** lat/lng (deg) → xyz at `radius` (same convention as three-globe). */
export function llToXyz(lat, lng, radius, out = [0, 0, 0]) {
  const phi = (90 - lat) * DEG;
  const theta = (90 - lng) * DEG;
  out[0] = radius * Math.sin(phi) * Math.cos(theta);
  out[1] = radius * Math.cos(phi);
  out[2] = radius * Math.sin(phi) * Math.sin(theta);
  return out;
}

/** Polygons of a GeoJSON feature as [[ring, hole…], …] (what the globe renders). */
export function featurePolygons(feature) {
  const g = feature?.renderGeometry || feature?.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

/** Signed area (deg², lng unwrapped): > 0 counter-clockwise on a normal map. */
export function ringSignedArea(ring) {
  let area = 0;
  let prevLng = ring[0][0];
  let offset = 0;
  const first = ring[0];
  let x0 = first[0];
  let y0 = first[1];
  for (let i = 1; i <= ring.length; i++) {
    const [lng, lat] = ring[i % ring.length];
    if (i < ring.length) {
      if (lng - prevLng > 180) offset -= 360;
      else if (lng - prevLng < -180) offset += 360;
      prevLng = lng;
    }
    const x1 = i === ring.length ? first[0] : lng + offset;
    const y1 = lat;
    area += x0 * y1 - x1 * y0;
    x0 = x1;
    y0 = y1;
  }
  return area / 2;
}

/** Ring → unit vectors, dropping the closing duplicate, subdividing long edges. */
export function ringToDirections(ring) {
  const pts = ring.map(([lng, lat]) => llToXyz(lat, lng, 1));
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9) pts.pop();
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const ang = Math.acos(dot);
    if (ang < 1e-7) continue; // duplicate vertex
    out.push(a);
    const n = Math.ceil(ang / MAX_SEGMENT_RAD);
    if (n > 1 && ang < Math.PI - 1e-3) {
      const s = Math.sin(ang);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const ka = Math.sin((1 - t) * ang) / s;
        const kb = Math.sin(t * ang) / s;
        out.push([ka * a[0] + kb * b[0], ka * a[1] + kb * b[1], ka * a[2] + kb * b[2]]);
      }
    }
  }
  return out;
}

/**
 * Triangle strip along one closed ring: `half` = half width, `inset` shifts
 * the whole ribbon toward the inside of the country (double liseré slots).
 */
function appendRingRibbon(ring, { isHole, alt, half, inset }, positions, indices) {
  const dirs = ringToDirections(ring);
  const n = dirs.length;
  if (n < 3) return;
  const ccw = ringSignedArea(ring) > 0;
  // Country interior is on the left of travel for an outer CCW ring / a CW hole.
  const interiorLeft = isHole ? !ccw : ccw;
  const r = surfaceRadius(alt);
  const base = positions.length / 3;
  const t = [0, 0, 0];
  const side = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const p = dirs[i];
    const a = dirs[(i + n - 1) % n];
    const b = dirs[(i + 1) % n];
    t[0] = b[0] - a[0];
    t[1] = b[1] - a[1];
    t[2] = b[2] - a[2];
    // left = normal × tangent (seen from outside)
    side[0] = p[1] * t[2] - p[2] * t[1];
    side[1] = p[2] * t[0] - p[0] * t[2];
    side[2] = p[0] * t[1] - p[1] * t[0];
    const len = Math.hypot(side[0], side[1], side[2]) || 1;
    const sgn = interiorLeft ? 1 : -1;
    const k = sgn / len;
    const cx = p[0] * r + side[0] * k * inset;
    const cy = p[1] * r + side[1] * k * inset;
    const cz = p[2] * r + side[2] * k * inset;
    positions.push(
      cx + side[0] * (half / len),
      cy + side[1] * (half / len),
      cz + side[2] * (half / len),
      cx - side[0] * (half / len),
      cy - side[1] * (half / len),
      cz - side[2] * (half / len)
    );
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = base + i * 2;
    const b = base + j * 2;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
}

export function buildRibbonGeometry(polygons, { alt, half, inset = 0 }) {
  const positions = [];
  const indices = [];
  for (const poly of polygons) {
    poly.forEach((ring, i) => {
      if (ring?.length > 2)
        appendRingRibbon(ring, { isHole: i > 0, alt, half, inset }, positions, indices);
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

/** A point of the country to anchor the link on (inside the largest polygon). */
export function polygonsAnchor(polygons) {
  let best = null;
  let bestArea = -1;
  for (const poly of polygons) {
    const a = Math.abs(ringSignedArea(poly[0]));
    if (a > bestArea) {
      bestArea = a;
      best = poly;
    }
  }
  if (!best) return null;
  const ring = best[0];
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const cLng = (minLng + maxLng) / 2;
  const cLat = (minLat + maxLat) / 2;
  const inside = (lng, lat) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  let pick = null;
  let pickD = Infinity;
  const N = 8;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const lng = minLng + ((maxLng - minLng) * i) / N;
      const lat = minLat + ((maxLat - minLat) * j) / N;
      if (!inside(lng, lat)) continue;
      const d = Math.hypot(lng - cLng, lat - cLat);
      if (d < pickD) {
        pickD = d;
        pick = { lat, lng };
      }
    }
  }
  const out = pick || { lat: cLat, lng: cLng };
  return { lat: out.lat, lng: ((((out.lng + 180) % 360) + 360) % 360) - 180 };
}

function polygonsBounds(polygons) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const poly of polygons)
    for (const [lng, lat] of poly[0]) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  return { minLng, maxLng, minLat, maxLat };
}

/** 2×2 checker, `phase` picks which diagonal is opaque (alphaMap reads green). */
const ditherCache = new Map();
function ditherTexture(phase) {
  let tex = ditherCache.get(phase);
  if (tex) return tex;
  const on = [255, 255, 255, 255];
  const off = [0, 0, 0, 255];
  const px = phase === 0 ? [on, off, off, on] : [off, on, on, off];
  tex = new THREE.DataTexture(new Uint8Array(px.flat()), 2, 2, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  ditherCache.set(phase, tex);
  return tex;
}

/**
 * Highlight set for one (country, player): surface meshes + outline mesh.
 * `slot`/`count` come from assignHighlightSlots: alone on the country the
 * surface is a flat tint, shared it becomes a dither whose phase depends on
 * the slot (two players interleave exactly, never hide each other).
 */
export function createCountryHighlight(polygons, { color, alt, slot = 0, count = 1 }) {
  const group = new THREE.Group();
  group.name = "conquest-country-highlight";
  const owned = [];
  const materials = [];
  const dithered = count > 1;
  const radius = surfaceRadius(alt);

  for (const poly of polygons) {
    const geo = new ConicPolygonGeometry(poly, radius, radius, false, true, false, FILL_CURVATURE);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: dithered ? 0.5 : FILL_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    if (dithered) {
      // uv spans the polygon's own bbox: one texture period = 2 cells.
      const b = polygonsBounds([poly]);
      const tex = ditherTexture(slot % 2).clone();
      tex.repeat.set(
        Math.max(1, (b.maxLng - b.minLng) / (DITHER_CELL_DEG * 2)),
        Math.max(1, (b.maxLat - b.minLat) / (DITHER_CELL_DEG * 2))
      );
      tex.needsUpdate = true;
      mat.alphaMap = tex;
      owned.push(tex);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 4;
    group.add(mesh);
    owned.push(geo, mat);
    materials.push(mat);
  }

  const ribbonMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    side: THREE.DoubleSide,
    depthWrite: false,
    transparent: true,
  });
  const ribbon = new THREE.Mesh(new THREE.BufferGeometry(), ribbonMat);
  ribbon.renderOrder = 5;
  ribbon.frustumCulled = false;
  group.add(ribbon);
  owned.push(ribbonMat);
  materials.push(ribbonMat);
  let bucket = null;
  // Constant on-screen outline: rebuilt only when the zoom crosses a bucket.
  const setPixelUnit = (unit) => {
    const b = Math.round(Math.log(Math.max(unit, 1e-4)) / Math.log(ZOOM_BUCKET));
    if (b === bucket) return;
    bucket = b;
    const u = Math.pow(ZOOM_BUCKET, b);
    ribbon.geometry.dispose();
    ribbon.geometry = buildRibbonGeometry(polygons, {
      alt: alt + 0.0006,
      half: RIBBON_HALF_PX * u,
      inset: slot * SLOT_INSET_PX * u,
    });
  };
  setPixelUnit(0.35);

  const baseOpacity = materials.map((m) => m.opacity);
  return {
    group,
    setPixelUnit,
    setOpacity(o) {
      materials.forEach((m, i) => (m.opacity = baseOpacity[i] * o));
    },
    dispose() {
      group.removeFromParent();
      ribbon.geometry.dispose();
      for (const d of owned) d.dispose?.();
    },
  };
}
