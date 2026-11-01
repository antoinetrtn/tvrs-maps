import { useEffect, useRef } from "react";

import { unregisterAnimatedPolygonMaterial } from "../render/polygonGlitchShader";

// Wait for globe.gl's debounced digest and the (de)selection transition to
// finish before looking at what the meshes still use.
const EVICT_DELAY_MS = 3000;
// Recent selection materials kept warm (re-selecting a country is instant).
const KEEP_SHADER_MATERIALS = 4;

const isEvictableKey = (key) => key.startsWith("ignite-") || key.startsWith("shader-");

/**
 * Per-country materials (`ignite-<country>` from the progressive ignition,
 * `shader-<country>-cap/side` from selection) were never released: +3 pool
 * entries per found country. Dispose those no mesh uses anymore, keeping the
 * last few selection materials. The GPU program is shared and stays cached by
 * the remaining materials, so nothing recompiles.
 */
export function evictUnusedPolygonMaterials(scene, pool, perCountryCache) {
  if (!scene || !pool) return 0;
  const inUse = new Set();
  scene.traverse((obj) => {
    const m = obj.material;
    if (!m) return;
    if (Array.isArray(m)) m.forEach((x) => inUse.add(x));
    else inUse.add(m);
  });
  const candidates = [...pool.entries()].filter(
    ([key, material]) => isEvictableKey(key) && !inUse.has(material)
  );
  const shaderCandidates = candidates.filter(([key]) => key.startsWith("shader-"));
  const keep = new Set(shaderCandidates.slice(-KEEP_SHADER_MATERIALS).map(([key]) => key));
  let evicted = 0;
  candidates.forEach(([key, material]) => {
    if (keep.has(key)) return;
    pool.delete(key);
    unregisterAnimatedPolygonMaterial(material);
    ["cap", "side"].forEach((kind) => {
      const map = perCountryCache?.[kind];
      map?.forEach((value, admin) => {
        if (value === material) map.delete(admin);
      });
    });
    material.dispose();
    evicted += 1;
  });
  return evicted;
}

export function usePolygonMaterialEviction(
  globeEl,
  sharedMaterialsRef,
  polygonMaterialCacheRef,
  key
) {
  const timerRef = useRef(null);

  // Throttled, not debounced: quick answers keep changing `key`, and a reset
  // timer would never fire during a fast game.
  useEffect(() => {
    if (timerRef.current != null) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      try {
        evictUnusedPolygonMaterials(
          globeEl?.current?.scene?.(),
          sharedMaterialsRef?.current,
          polygonMaterialCacheRef?.current
        );
      } catch {
        // Best effort: a leak is better than a broken frame.
      }
    }, EVICT_DELAY_MS);
  }, [globeEl, sharedMaterialsRef, polygonMaterialCacheRef, key]);

  useEffect(
    () => () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
      timerRef.current = null;
    },
    []
  );
}
