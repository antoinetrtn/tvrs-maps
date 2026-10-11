import { useCallback, useEffect, useRef } from "react";

import { cullPolygonsBeyondHorizon } from "../render/horizonCulling";
import { swapLineMaterialsForWebGPU } from "../render/webgpu/lineMaterialSwap";

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

// Re-cull at least this often even if the camera did not move (new polygons
// after a mode switch, altitude tweens).
const CULL_REFRESH_MS = 250;

/**
 * Hide countries entirely beyond the horizon before each render (see
 * render/horizonCulling.js). Hooked on scene.onBeforeRender so it runs for
 * every frame the globe actually draws, whatever triggered it.
 */
function useGlobeHorizonCulling(globeEl) {
  useEffect(() => {
    let scene = null;
    let previous = null;
    let waitId = null;
    const last = { x: NaN, y: NaN, z: NaN, at: 0 };
    const install = () => {
      waitId = null;
      const globe = globeEl.current;
      scene = globe?.scene?.();
      const radius = globe?.getGlobeRadius?.() || 100;
      if (!scene) {
        waitId = setTimeout(install, 100);
        return;
      }
      previous = scene.onBeforeRender;
      scene.onBeforeRender = function cullBeforeRender(renderer, sc, camera, ...rest) {
        // WebGPU flag: rivers' GLSL LineMaterial → Line2NodeMaterial, every
        // frame so a new path never reaches the GPU with the GLSL material.
        if (renderer?.isWebGPURenderer) swapLineMaterialsForWebGPU(sc);
        const p = camera.position;
        const now = performance.now();
        const moved =
          Math.abs(p.x - last.x) + Math.abs(p.y - last.y) + Math.abs(p.z - last.z) > 0.01;
        if (moved || now - last.at > CULL_REFRESH_MS) {
          cullPolygonsBeyondHorizon(sc, camera, radius);
          last.x = p.x;
          last.y = p.y;
          last.z = p.z;
          last.at = now;
        }
        return previous?.call(this, renderer, sc, camera, ...rest);
      };
    };
    install();
    return () => {
      if (waitId != null) clearTimeout(waitId);
      if (scene) scene.onBeforeRender = previous || (() => {});
    };
  }, [globeEl]);
}

/** Pause globe.gl's render loop while the tab is hidden (and horizon-cull). */
export function useGlobeVisibilityPause(globeEl) {
  useGlobeHorizonCulling(globeEl);
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
