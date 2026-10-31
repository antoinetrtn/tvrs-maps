const packCache = new Map();

/** Normalizes a region name (`"Europe"` -> `"europe"`) for `/quiz/{region}.json`. */
function normalizeRegionKey(region) {
  return String(region || "")
    .trim()
    .toLowerCase();
}

/**
 * Fetches `/quiz/{region}.json` (answers stripped) and memoizes the promise per region.
 */
export function loadKnowledgePack(region, fetchImpl = globalThis.fetch) {
  const key = normalizeRegionKey(region);
  if (!key || typeof fetchImpl !== "function") {
    return Promise.resolve([]);
  }
  const useCache = fetchImpl === globalThis.fetch;
  if (useCache && packCache.has(key)) {
    return packCache.get(key);
  }

  const request = Promise.resolve()
    .then(() => fetchImpl(`/quiz/${encodeURIComponent(key)}.json`))
    .then((res) => (res && res.ok ? res.json() : []))
    .then((data) => (Array.isArray(data) ? data : []))
    .catch(() => {
      if (useCache) packCache.delete(key);
      return [];
    });

  if (useCache) {
    packCache.set(key, request);
  }
  return request;
}

/** Clears the memoized region pack cache (used in tests). */
export function clearKnowledgePackCache() {
  packCache.clear();
}
