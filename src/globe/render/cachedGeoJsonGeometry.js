// Drop-in replacement for `three-geojson-geometry`, wired through a Vite alias
// (see vite.config.js) so three-globe polygon borders reuse interpolated line
// geometries and WebGL buffers instead of re-interpolating and re-uploading
// all polygon strokes on layer switches.
import { BufferAttribute, BufferGeometry } from "three";
import OriginalGeoJsonGeometry from "three-geojson-geometry-original";

const CACHE_KEY = "__tvrsGeoJsonGeometryCache";
const cache = (globalThis[CACHE_KEY] ??= new WeakMap());

const paramsKey = (type, radius, resolution) => `${type || ""}|${radius}|${resolution}`;

const shareAttribute = (attr) => {
  const shared = new BufferAttribute(attr.array, attr.itemSize, attr.normalized);
  shared.name = attr.name;
  return shared;
};

function getEntry(geoJson, radius, resolution) {
  const keyObj =
    geoJson && typeof geoJson.coordinates === "object" && geoJson.coordinates !== null
      ? geoJson.coordinates
      : geoJson;
  const isCacheable = keyObj !== null && typeof keyObj === "object";
  if (!isCacheable) {
    return {
      template: new OriginalGeoJsonGeometry(geoJson, radius, resolution),
      pool: null,
    };
  }
  let byParams = cache.get(keyObj);
  if (!byParams) {
    byParams = new Map();
    cache.set(keyObj, byParams);
  }
  const key = paramsKey(geoJson?.type, radius, resolution);
  let entry = byParams.get(key);
  if (!entry) {
    entry = {
      template: new OriginalGeoJsonGeometry(geoJson, radius, resolution),
      pool: [],
    };
    byParams.set(key, entry);
  }
  return entry;
}

export default class GeoJsonGeometry extends BufferGeometry {
  constructor(geoJson, radius = 1, resolution = 5) {
    super();
    const entry = getEntry(geoJson, radius, resolution);
    if (entry.pool && entry.pool.length > 0) {
      const recycled = entry.pool.pop();
      recycled.__inPool = false;
      recycled.parameters = { geoJson, radius, resolution };
      return recycled;
    }
    const { template } = entry;
    this.__pool = entry.pool;
    this.__inPool = false;
    this.type = template.type;
    this.parameters = { geoJson, radius, resolution };
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
