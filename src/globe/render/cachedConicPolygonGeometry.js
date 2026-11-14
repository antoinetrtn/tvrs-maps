// Drop-in replacement for `three-conic-polygon-geometry`, wired through a Vite
// alias (see vite.config.js) so three-globe picks it up.
//
// three-globe rebuilds a polygon's ConicPolygonGeometry whenever its curvature
// resolution changes (e.g. countries becoming dimmed "ghost" countries when
// entering departments / US states, and back). Triangulating ~250 countries on
// the main thread was the largest remaining cost of a mode switch.
//
// This wrapper memoizes the triangulated buffers per source ring array and
// parameter set, and hands each new geometry its own BufferAttributes over the
// shared (read-only) typed arrays. Output is identical to a fresh build of the same geometry.
import { BufferAttribute, BufferGeometry } from "three";
import OriginalConicPolygonGeometry from "three-conic-polygon-geometry-original";

import RefinedConicPolygonGeometry, { shouldRefine } from "./refinedConicPolygonGeometry";

// Shared through globalThis: the dev-server dependency optimizer can bundle this
// module twice (app code + the pre-bundled globe library); one cache for both.
const CACHE_KEY = "__tvrsConicPolygonGeometryCache";
const cache = (globalThis[CACHE_KEY] ??= new WeakMap());

// Registered polygons (US states, departments) get RefinedConicPolygonGeometry
// caps: exact cover, bounded sag. Everything else, bottom caps and polygons
// crossing the antimeridian or a pole keep the original Delaunay/voronoi caps.
const buildGeometry = (args) => {
  const [polygon, , , closedBottom] = args;
  return closedBottom || !shouldRefine(polygon)
    ? new OriginalConicPolygonGeometry(...args)
    : new RefinedConicPolygonGeometry(...args);
};

const paramsKey = (...args) => args.map(String).join("|");

const shareAttribute = (attr) => {
  const shared = new BufferAttribute(attr.array, attr.itemSize, attr.normalized);
  shared.name = attr.name;
  return shared;
};

function getEntry(polygonGeoJson, args) {
  const isCacheable = polygonGeoJson !== null && typeof polygonGeoJson === "object";
  if (!isCacheable) return { template: buildGeometry(args), pool: null };
  let byParams = cache.get(polygonGeoJson);
  if (!byParams) {
    byParams = new Map();
    cache.set(polygonGeoJson, byParams);
  }
  const key = paramsKey(...args.slice(1));
  let entry = byParams.get(key);
  if (!entry) {
    entry = { template: buildGeometry(args), pool: [] };
    byParams.set(key, entry);
  } else if (!entry.template) {
    entry = { template: entry, pool: [] };
    byParams.set(key, entry);
  }
  return entry;
}

export default class ConicPolygonGeometry extends BufferGeometry {
  constructor(...args) {
    super();
    const entry = getEntry(args[0], args);
    if (entry.pool && entry.pool.length > 0) {
      const recycled = entry.pool.pop();
      recycled.__inPool = false;
      return recycled;
    }
    const { template } = entry;
    this.__pool = entry.pool;
    this.__inPool = false;
    this.type = template.type;
    this.parameters = { ...template.parameters };
    if (template.index) this.setIndex(shareAttribute(template.index));
    Object.entries(template.attributes).forEach(([name, attr]) => {
      this.setAttribute(name, shareAttribute(attr));
    });
    template.groups.forEach((g) => this.addGroup(g.start, g.count, g.materialIndex));
    if (template.boundingSphere) this.boundingSphere = template.boundingSphere.clone();
    if (template.boundingBox) this.boundingBox = template.boundingBox.clone();
  }

  dispose() {
    if (this.__pool) {
      if (!this.__inPool) {
        this.__inPool = true;
        this.__pool.push(this);
      }
      return;
    }
    super.dispose();
  }
}
