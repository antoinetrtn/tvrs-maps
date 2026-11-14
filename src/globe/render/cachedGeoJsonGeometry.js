// Drop-in replacement for `three-geojson-geometry`, wired through a Vite alias
// (see vite.config.js) so three-globe polygon borders reuse interpolated line
// geometries and WebGL buffers instead of re-interpolating and re-uploading
// all polygon strokes on layer switches.
import { BufferGeometry } from "three";
import OriginalGeoJsonGeometry from "three-geojson-geometry-original";

import { disposePooledGeometry, initPooledGeometry, takePooledGeometry } from "./geometryPool";

const CACHE_KEY = "__tvrsGeoJsonGeometryCache";
const cache = (globalThis[CACHE_KEY] ??= new WeakMap());

const paramsKey = (type, radius, resolution) => `${type || ""}|${radius}|${resolution}`;

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
    const recycled = takePooledGeometry(entry);
    if (recycled) {
      recycled.parameters = { geoJson, radius, resolution };
      return recycled;
    }
    initPooledGeometry(this, entry, entry.template.type, { geoJson, radius, resolution });
  }

  dispose() {
    disposePooledGeometry(this, () => super.dispose());
  }
}
