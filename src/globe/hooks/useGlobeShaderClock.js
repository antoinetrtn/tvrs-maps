import { useEffect } from "react";

import { polygonGlitchUniforms } from "../render/polygonGlitchShader";

/**
 * Unified shader clock: updates time uniforms from scene.onBeforeRender, i.e.
 * right before globe.gl renders a frame, so shader animation runs at the real
 * render rate instead of a separate throttled requestAnimationFrame loop.
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
        const mat = globeMaterialRef.current;
        if (mat?.userData?.shader?.uniforms?.uTime) {
          mat.userData.shader.uniforms.uTime.value = timeSec;
        }
        if (needsSharedTimeRef.current) {
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
