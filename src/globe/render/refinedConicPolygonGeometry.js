// Conic polygon geometry whose cap is an exact, hole-free, sag-bounded tessellation.
//
// three-conic-polygon-geometry triangulates a cap with an unconstrained
// Delaunay of "contour + inner grid points", dropping the triangles whose
// centroid falls outside the polygon. That leaves holes along concave borders
// (Oklahoma panhandle, Montana, Maryland…), and where a polygon is thinner than
// the step there are no inner points at all: earcut then yields huge flat
// triangles that dip far under the sea sphere, which punches diamonds and
// slivers of sea through the land ("surfaces qui s'enfoncent").
//
// Here the cap is earcut (exact cover of the polygon, holes respected) and then
// refined conformingly: every interior edge longer than `step` degrees is split
// at its great-circle midpoint, and each triangle is cut according to which of
// its edges were split (shared edges split identically ⇒ no cracks). Every edge
// ends up ≤ step, so a cap never dips below its vertices by more than
// ≈ R·(1 − cos(step/√3)). The torso (side walls) is built like the original.
// Polygons that cross the antimeridian or a pole keep the original geometry
// (earcut works in lng/lat), see isRefinable().
//
// Only the thin, close-up layers (US states, French departments) are opted in
// through registerRefinedPolygons(): earcut slivers need many more triangles than
// the original's near-equilateral Delaunay mesh, which is fine for ~100 small
// polygons but not for the 250-country world and ghost layers.
import earcut, { flatten as earcutFlatten } from "earcut";
import { BufferGeometry, Float32BufferAttribute } from "three";

// Shared through globalThis like the geometry cache: the dev-server dependency
// optimizer can bundle this module twice (app code + the pre-bundled globe library).
const REGISTRY_KEY = "__tvrsRefinedPolygons";
const refinedPolygons = (globalThis[REGISTRY_KEY] ??= new WeakSet());

/**
 * Opts a GeoJSON geometry's polygons (the ring arrays three-globe hands to the
 * geometry constructor) into the refined cap tessellation. Returns the geometry.
 */
export function registerRefinedPolygons(geometry) {
  if (geometry?.type === "Polygon") refinedPolygons.add(geometry.coordinates);
  else if (geometry?.type === "MultiPolygon")
    geometry.coordinates.forEach((polygon) => refinedPolygons.add(polygon));
  return geometry;
}

/** True when the polygon was registered and earcut-in-lng/lat can handle it. */
export function shouldRefine(polygon) {
  return refinedPolygons.has(polygon) && isRefinable(polygon);
}

const DEG = Math.PI / 180;
const MAX_REFINE_PASSES = 12;

const toUnit = (lng, lat) => {
  const cosLat = Math.cos(lat * DEG);
  return [cosLat * Math.cos(lng * DEG), cosLat * Math.sin(lng * DEG), Math.sin(lat * DEG)];
};

/** Same convention as three-conic-polygon-geometry (and three-globe). */
function polar2Cartesian(lat, lng, r = 0) {
  const phi = (90 - lat) * DEG;
  const theta = (90 - lng) * DEG;
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Great-circle interpolation of a ring: segments longer than `step`° are split evenly. */
function interpolateRing(ring, step) {
  const out = [];
  let prev = null;
  ring.forEach((pnt) => {
    if (prev) {
      const a = toUnit(prev[0], prev[1]);
      const b = toUnit(pnt[0], pnt[1]);
      const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      const delta = Math.acos(dot);
      const dist = delta / DEG;
      if (dist > step) {
        const n = Math.ceil(dist / step);
        const sin = Math.sin(delta);
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const wa = Math.sin((1 - t) * delta) / sin;
          const wb = Math.sin(t * delta) / sin;
          const v = [0, 1, 2].map((k) => wa * a[k] + wb * b[k]);
          const lng = Math.atan2(v[1], v[0]) / DEG;
          out.push([
            // keep the segment's own longitude branch (no ±360° jump)
            lng + 360 * Math.round((prev[0] - lng) / 360),
            Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG,
          ]);
        }
      }
    }
    out.push((prev = pnt));
  });
  return out;
}

function extent(values) {
  let min = Infinity;
  let max = -Infinity;
  values.forEach((v) => {
    if (v < min) min = v;
    if (v > max) max = v;
  });
  return [min, max];
}

/** False for polygons earcut-in-lng/lat can't handle: antimeridian or pole crossings. */
/**
 * Splitting a near-zero-area earcut sliver (collinear points) lifts its midpoints
 * onto the sphere and can turn it inside out; back-face culling would then open a
 * hole. Re-wind any triangle that faces the globe centre so every face renders.
 */
function faceOutwards(vertices, indices) {
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const e1 = [
      vertices[b] - vertices[a],
      vertices[b + 1] - vertices[a + 1],
      vertices[b + 2] - vertices[a + 2],
    ];
    const e2 = [
      vertices[c] - vertices[a],
      vertices[c + 1] - vertices[a + 1],
      vertices[c + 2] - vertices[a + 2],
    ];
    const normal = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const facing =
      normal[0] * (vertices[a] + vertices[b] + vertices[c]) +
      normal[1] * (vertices[a + 1] + vertices[b + 1] + vertices[c + 1]) +
      normal[2] * (vertices[a + 2] + vertices[b + 2] + vertices[c + 2]);
    if (facing < 0) {
      const swap = indices[t + 1];
      indices[t + 1] = indices[t + 2];
      indices[t + 2] = swap;
    }
  }
}

export function isRefinable(polygon) {
  if (!Array.isArray(polygon) || !polygon.length) return false;
  return polygon.every((ring) =>
    ring.every((pnt, i) => {
      if (Math.abs(pnt[1]) >= 89) return false;
      return i === 0 || Math.abs(pnt[0] - ring[i - 1][0]) <= 180;
    })
  );
}

/** Splits triangle (a, b, c) given the midpoint vertex of each edge (-1 = unsplit). */
function splitTriangle(a, b, c, mab, mbc, mca, dist, out) {
  const count = (mab >= 0) + (mbc >= 0) + (mca >= 0);
  if (count === 0) {
    out.push(a, b, c);
  } else if (count === 3) {
    out.push(a, mab, mca, mab, b, mbc, mca, mbc, c, mab, mbc, mca);
  } else if (count === 1) {
    // rotate so the split edge is a→b
    if (mbc >= 0) return splitTriangle(b, c, a, mbc, mca, mab, dist, out);
    if (mca >= 0) return splitTriangle(c, a, b, mca, mab, mbc, dist, out);
    out.push(a, mab, c, mab, b, c);
  } else {
    // two splits: rotate so the unsplit edge is c→a (edges a→b and b→c split)
    if (mab < 0) return splitTriangle(b, c, a, mbc, mca, mab, dist, out);
    if (mbc < 0) return splitTriangle(c, a, b, mca, mab, mbc, dist, out);
    out.push(mab, b, mbc);
    // remaining quad a, mab, mbc, c: cut along its shorter diagonal
    if (dist(a, mbc) <= dist(mab, c)) out.push(a, mab, mbc, a, mbc, c);
    else out.push(a, mab, c, mab, mbc, c);
  }
  return undefined;
}

/**
 * Exact cap tessellation of a GeoJSON polygon (outer ring + holes, lng/lat degrees).
 * Returns the contour (interpolated rings), the points (lng/lat arrays) and the
 * triangle indices, wound like three-conic-polygon-geometry's earcut branch.
 */
export function triangulateRefinedCap(polygon, step) {
  const contour = polygon.map((ring) => interpolateRing(ring, step));
  const { vertices, holes } = earcutFlatten(contour);
  const lngs = [];
  const lats = [];
  for (let i = 0; i < vertices.length; i += 2) {
    lngs.push(vertices[i]);
    lats.push(vertices[i + 1]);
  }
  let indices = earcut(vertices, holes, 2);

  const units = lngs.map((lng, i) => toUnit(lng, lats[i]));
  const cosStep = Math.cos(step * DEG);
  const dist = (i, j) => {
    const u = units[i];
    const v = units[j];
    return Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
  };
  const tooLong = (i, j) => {
    const u = units[i];
    const v = units[j];
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2] < cosStep;
  };

  for (let pass = 0; pass < MAX_REFINE_PASSES; pass++) {
    const mids = new Map();
    const midOf = (i, j) => {
      const key = i < j ? i * 4194304 + j : j * 4194304 + i;
      if (mids.has(key)) return mids.get(key);
      const u = units[i];
      const v = units[j];
      const m = [u[0] + v[0], u[1] + v[1], u[2] + v[2]];
      const len = Math.hypot(m[0], m[1], m[2]) || 1;
      const lng = Math.atan2(m[1], m[0]) / DEG;
      const id = lngs.length;
      lngs.push(lng + 360 * Math.round((lngs[i] - lng) / 360));
      lats.push(Math.asin(m[2] / len) / DEG);
      units.push([m[0] / len, m[1] / len, m[2] / len]);
      mids.set(key, id);
      return id;
    };
    const next = [];
    let changed = false;
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t];
      const b = indices[t + 1];
      const c = indices[t + 2];
      const mab = tooLong(a, b) ? midOf(a, b) : -1;
      const mbc = tooLong(b, c) ? midOf(b, c) : -1;
      const mca = tooLong(c, a) ? midOf(c, a) : -1;
      if (mab >= 0 || mbc >= 0 || mca >= 0) changed = true;
      splitTriangle(a, b, c, mab, mbc, mca, dist, next);
    }
    indices = next;
    if (!changed) break;
  }
  return { contour, lngs, lats, indices };
}

export default class RefinedConicPolygonGeometry extends BufferGeometry {
  constructor(
    polygonGeoJson,
    bottomHeight,
    topHeight,
    closedBottom,
    closedTop,
    includeSides,
    curvatureResolution
  ) {
    super();
    this.type = "ConicPolygonGeometry";
    this.parameters = {
      polygonGeoJson,
      bottomHeight,
      topHeight,
      closedBottom,
      closedTop,
      includeSides,
      curvatureResolution,
    };
    const bottom = bottomHeight || 0;
    const top = topHeight || 1;
    const withTop = closedTop !== undefined ? closedTop : true;
    const withSides = includeSides !== undefined ? includeSides : true;
    const step = curvatureResolution || 5;

    const {
      contour,
      lngs,
      lats,
      indices: capIndices,
    } = triangulateRefinedCap(polygonGeoJson, step);
    let vertices = [];
    let uvs = [];
    let indices = [];
    let groupCount = 0;
    const addGroup = (group) => {
      const vertexOffset = vertices.length / 3;
      const indexOffset = indices.length;
      vertices = vertices.concat(group.vertices);
      uvs = uvs.concat(group.uvs);
      indices = indices.concat(
        vertexOffset ? group.indices.map((i) => i + vertexOffset) : group.indices
      );
      this.addGroup(indexOffset, indices.length - indexOffset, groupCount++);
    };

    const ringVertices = (altitude) => {
      const flat = [];
      const ringStarts = [];
      contour.forEach((ring) => {
        ringStarts.push(flat.length / 3);
        ring.forEach(([lng, lat]) => flat.push(...polar2Cartesian(lat, lng, altitude)));
      });
      return { flat, holes: ringStarts.slice(1) };
    };

    if (withSides) {
      const { flat: bottomVerts, holes } = ringVertices(bottom);
      const { flat: topVerts } = ringVertices(top);
      const numPoints = topVerts.length / 3;
      const holeStarts = new Set(holes);
      let lastHoleIdx = 0;
      const sideIndices = [];
      for (let v0 = 0; v0 < numPoints; v0++) {
        let v1 = v0 + 1;
        if (v1 === numPoints) {
          v1 = lastHoleIdx;
        } else if (holeStarts.has(v1)) {
          const holeIdx = v1;
          v1 = lastHoleIdx;
          lastHoleIdx = holeIdx;
        }
        sideIndices.push(v0, v0 + numPoints, v1 + numPoints, v1 + numPoints, v1, v0);
      }
      const sideUvs = [];
      for (let v = 1; v >= 0; v--)
        for (let i = 0; i < numPoints; i++) sideUvs.push(i / (numPoints - 1), v);
      addGroup({ vertices: topVerts.concat(bottomVerts), uvs: sideUvs, indices: sideIndices });
    }

    if (withTop) {
      const capVertices = [];
      const capUvs = [];
      const [lngMin, lngMax] = extent(lngs);
      const [latMin, latMax] = extent(lats);
      const lngSpan = lngMax - lngMin || 1;
      const latSpan = latMax - latMin || 1;
      lngs.forEach((lng, i) => {
        capVertices.push(...polar2Cartesian(lats[i], lng, top));
        capUvs.push((lng - lngMin) / lngSpan, (lats[i] - latMin) / latSpan);
      });
      faceOutwards(capVertices, capIndices);
      addGroup({ vertices: capVertices, uvs: capUvs, indices: capIndices });
    }

    this.setIndex(indices);
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    this.computeVertexNormals();
  }
}
