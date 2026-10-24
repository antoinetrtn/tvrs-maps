import { useEffect } from "react";

import { prefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { polygonGlitchUniforms } from "../render/polygonGlitchShader";

/**
 * Unified shader clock: updates time uniforms from scene.onBeforeRender, i.e.
 * right before globe.gl renders a frame, so shader animation (including the 3D
 * dithered ocean swell and country glitch/selection effects) runs at the real
 * render rate when reduced motion is off.
 */
export function useGlobeShaderClock({
  globeEl,
  globeMaterialRef,
  needsSharedTimeRef,
  mountainGlitchActiveRef,
  mountainGlitchUniforms,
}) {
  useEffect(() => {
    let restore = null;
    let waitId = null;
    const attach = () => {
      waitId = null;
      const scene = globeEl.current?.scene?.();
      if (!scene) {
        waitId = setTimeout(attach, 50);
        return;
      }
      const prev = scene.onBeforeRender;
      scene.onBeforeRender = function shaderClock(...args) {
        if (typeof prev === "function") prev.apply(this, args);
        const timeSec = performance.now() / 1000;
        const reduced = prefersReducedMotion();
        const mat = globeMaterialRef.current;
        if (mat?.userData?.shader?.uniforms?.uTime && !reduced) {
          mat.userData.shader.uniforms.uTime.value = timeSec;
        }
        if (needsSharedTimeRef.current || !reduced) {
          polygonGlitchUniforms.uTime.value = timeSec;
        }
        if (mountainGlitchActiveRef.current && mountainGlitchUniforms?.uTime) {
          mountainGlitchUniforms.uTime.value = timeSec;
        }
      };
      restore = () => {
        scene.onBeforeRender = prev;
      };
    };
    attach();
    return () => {
      if (waitId != null) clearTimeout(waitId);
      restore?.();
    };
  }, [
    globeEl,
    globeMaterialRef,
    needsSharedTimeRef,
    mountainGlitchActiveRef,
    mountainGlitchUniforms,
  ]);
}
