import { useCallback, useEffect, useRef } from "react";

/**
 * Native touch listeners. React registers touch handlers as passive, so the
 * preventDefault() calls used by the double-tap zoom gesture were ignored.
 */
export function useGlobeNativeTouch(containerRef, handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onStart = (e) => handlersRef.current.handleTouchStart?.(e);
    const onMove = (e) => handlersRef.current.handleTouchMove?.(e);
    const onEnd = (e) => handlersRef.current.handleTouchEnd?.(e);
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [containerRef]);
}

/** Pause globe.gl's render loop while the tab is hidden. */
export function useGlobeVisibilityPause(globeEl) {
  useEffect(() => {
    const handleVisibility = () => {
      const globe = globeEl.current;
      if (!globe) return;
      try {
        if (document.hidden) globe.pauseAnimation?.();
        else globe.resumeAnimation?.();
      } catch {}
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [globeEl]);
}

/**
 * WebGL context loss (common on iOS Safari under memory pressure): prevent the
 * default so the browser may restore it, pause meanwhile, resume on restore.
 * Returns an idempotent attach function to call once the globe is ready.
 */
export function useGlobeContextLoss(globeEl) {
  const cleanupRef = useRef(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  return useCallback(() => {
    const canvas = globeEl.current?.renderer?.()?.domElement;
    if (!canvas || cleanupRef.current) return;
    const onLost = (e) => {
      e.preventDefault();
      try {
        globeEl.current?.pauseAnimation?.();
      } catch {}
    };
    const onRestored = () => {
      try {
        globeEl.current?.resumeAnimation?.();
      } catch {}
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    cleanupRef.current = () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [globeEl]);
}
