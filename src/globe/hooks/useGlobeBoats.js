import { useEffect, useRef } from "react";

import { countryDataMap } from "../../data/gameData";

/**
 * Pixel-art boats sailing between found coastal countries. The layer (code +
 * sea-lane data) is loaded lazily from the 2nd found country, so the initial
 * bundle does not grow.
 */
export function useGlobeBoats(globeEl, { foundList, enabled }) {
  const layerRef = useRef(null);
  const loadingRef = useRef(false);
  const latestRef = useRef(foundList);
  latestRef.current = foundList;
  const active = enabled && foundList.length >= 2;

  useEffect(() => {
    if (!active) {
      if (layerRef.current) layerRef.current.mesh.visible = false;
      return;
    }
    if (layerRef.current) {
      layerRef.current.mesh.visible = true;
      layerRef.current.setFound(foundList, countryDataMap);
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    const load = async () => {
      try {
        const { createBoatLayer } = await import("../render/life/lifeBoats");
        const globe = globeEl.current;
        if (!globe?.scene) return;
        layerRef.current = createBoatLayer(globe);
        layerRef.current.setFound(latestRef.current, countryDataMap);
      } catch {
        // Decorative layer: ignore load failures.
      } finally {
        loadingRef.current = false;
      }
    };
    void load();
  }, [active, foundList, globeEl]);

  useEffect(
    () => () => {
      layerRef.current?.dispose();
      layerRef.current = null;
    },
    []
  );
}
