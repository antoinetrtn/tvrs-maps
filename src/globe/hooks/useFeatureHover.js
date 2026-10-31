import { useCallback, useEffect, useMemo, useRef } from "react";

import { clientToGlobeCoords } from "../../utils/utils";
import { pickRiverOrRelief } from "../pickFallback";
import { setFeatureHover } from "../render/featureMask";

/** True only for a real hovering pointer (desktop mouse / trackpad), never touch. */
const canHover = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches === true;

/**
 * Rivers & Mountains hover: a thin, lighter amber outline (no halo) on the river
 * or massif under the mouse. rAF-throttled; the mask only changes when the
 * hovered key changes. Disabled on touch and on the home screen.
 */
export function useFeatureHover(globeEl, gameDataMap, enabled) {
  const rafRef = useRef(null);
  const lastRef = useRef(null);

  useEffect(() => {
    if (!enabled) setFeatureHover(null);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled]);

  const clear = useCallback(() => {
    lastRef.current = null;
    setFeatureHover(null);
    const canvas = globeEl.current?.renderer?.()?.domElement;
    if (canvas) canvas.style.cursor = "";
  }, [globeEl]);

  const update = useCallback(
    (event) => {
      if (!enabled || event.pointerType !== "mouse" || !canHover()) return;
      lastRef.current = { x: event.clientX, y: event.clientY };
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const ev = lastRef.current;
        if (!ev) return;
        const coords = clientToGlobeCoords(globeEl, ev.x, ev.y);
        const key = coords ? pickRiverOrRelief(gameDataMap, coords.lng, coords.lat) : null;
        setFeatureHover(key, gameDataMap);
        const canvas = globeEl.current?.renderer?.()?.domElement;
        if (canvas) canvas.style.cursor = key ? "pointer" : "";
      });
    },
    [enabled, gameDataMap, globeEl]
  );

  return useMemo(() => ({ update, clear }), [update, clear]);
}
