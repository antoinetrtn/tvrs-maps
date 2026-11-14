import { BufferAttribute } from "three";

function shareAttribute(attr) {
  const shared = new BufferAttribute(attr.array, attr.itemSize, attr.normalized);
  shared.name = attr.name;
  return shared;
}

/** Copy index, attributes, groups and bounds from a cached template onto `geom`. */
function adoptTemplateBuffers(geom, template) {
  if (template.index) geom.setIndex(shareAttribute(template.index));
  Object.entries(template.attributes).forEach(([name, attr]) => {
    geom.setAttribute(name, shareAttribute(attr));
  });
  template.groups.forEach((g) => geom.addGroup(g.start, g.count, g.materialIndex));
  if (template.boundingSphere) geom.boundingSphere = template.boundingSphere.clone();
  if (template.boundingBox) geom.boundingBox = template.boundingBox.clone();
}

/** Pop a pooled geometry, or return null so the caller can build a new one. */
export function takePooledGeometry(entry) {
  if (!entry.pool || entry.pool.length === 0) return null;
  const recycled = entry.pool.pop();
  recycled.__inPool = false;
  return recycled;
}

export function initPooledGeometry(geom, entry, type, parameters) {
  geom.__pool = entry.pool;
  geom.__inPool = false;
  geom.type = type;
  geom.parameters = parameters;
  adoptTemplateBuffers(geom, entry.template);
}

/** Recycle into the pool instead of releasing shared typed arrays. */
export function disposePooledGeometry(geom, fallbackDispose) {
  if (geom.__pool) {
    if (!geom.__inPool) {
      geom.__inPool = true;
      geom.__pool.push(geom);
    }
    return;
  }
  fallbackDispose();
}
