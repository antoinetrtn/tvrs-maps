import { useEffect, useRef } from "react";

import { countryDataMap } from "../../data/gameData";
import { loadMicroAdmins } from "../microSnap";

/**
 * Pixel beacons on all micro-territories (unfound: faint amber pulse, found:
 * golden lit). Layer code + list are loaded lazily: no initial bundle growth.
 */
export function useMicroBeacons(globeEl, { foundList, enabled }) {
  const layerRef = useRef(null);
  const loadingRef = useRef(false);
  const latestRef = useRef(foundList);
  latestRef.current = foundList;

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.mesh.visible = enabled;
      if (enabled) layerRef.current.setFound(foundList);
      return;
    }
    if (!enabled || loadingRef.current) return;
    loadingRef.current = true;
    const load = async () => {
      try {
        const [{ createMicroBeaconLayer }, admins] = await Promise.all([
          import("../render/life/microBeacons"),
          loadMicroAdmins(),
        ]);
        const globe = globeEl.current;
        if (!globe?.scene || !admins) return;
        layerRef.current = createMicroBeaconLayer(globe, admins, countryDataMap);
        layerRef.current.setFound(latestRef.current);
      } catch {
        // Decorative layer: ignore load failures.
      } finally {
        loadingRef.current = false;
      }
    };
    load();
  }, [enabled, foundList, globeEl]);

  useEffect(
    () => () => {
      layerRef.current?.dispose();
      layerRef.current = null;
    },
    []
  );
}
