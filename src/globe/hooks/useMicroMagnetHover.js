import { useCallback, useRef } from "react";

import { clientToGlobeCoords } from "../../utils/utils";
import { getProjector, snapMicroAtScreen, toCanvasPx } from "../microSnap";

/**
 * Hover magnet: when the mouse is within the snap radius of a micro-territory,
 * show the pointer cursor (no change to the globe rendering). rAF-throttled.
 */
export function useMicroMagnetHover(globeEl, gameDataMap) {
  const rafRef = useRef(null);
  const lastRef = useRef(null);
  return useCallback(
    (event) => {
      lastRef.current = { x: event.clientX, y: event.clientY };
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const ev = lastRef.current;
        const canvas = globeEl.current?.renderer?.()?.domElement;
        const project = getProjector(globeEl);
        const coords = canvas && project && clientToGlobeCoords(globeEl, ev.x, ev.y);
        if (!coords) return;
        const micro = snapMicroAtScreen({
          globeEl,
          project,
          gameDataMap,
          lng: coords.lng,
          lat: coords.lat,
          screen: { ...toCanvasPx(globeEl, ev.x, ev.y), pointerType: "mouse" },
          insideOther: true,
        });
        canvas.style.cursor = micro ? "pointer" : "";
      });
    },
    [gameDataMap, globeEl]
  );
}
