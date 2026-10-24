import { useEffect } from "react";

import { prefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { polygonGlitchUniforms } from "../render/polygonGlitchShader";

const stepGlobeMotionState = (state, cam, dt, reduced) => {
  if (reduced) {
    state.smoothMotion = 0;
    state.smoothVelLng = 0;
    state.smoothVelLat = 0;
    return;
  }
  if (!cam?.position) return;

  const px = cam.position.x || 0;
  const py = cam.position.y || 0;
  const pz = cam.position.z || 0;
  const dist = Math.hypot(px, py, pz) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, py / dist)));
  const lng = Math.atan2(pz, px);

  if (state.prevCamLat != null && state.prevCamLng != null && state.prevCamDist != null) {
    let dLng = lng - state.prevCamLng;
    if (dLng > Math.PI) dLng -= Math.PI * 2;
    if (dLng < -Math.PI) dLng += Math.PI * 2;
    const dLat = lat - state.prevCamLat;
    const dDist = (dist - state.prevCamDist) / Math.max(100, dist);

    const instVelLng = Math.max(-4, Math.min(4, dLng / dt));
    const instVelLat = Math.max(-4, Math.min(4, dLat / dt));
    const instSpeed = Math.hypot(instVelLng, instVelLat) + Math.abs(dDist / dt) * 1.4;
    const targetMotion = Math.min(1, instSpeed * 0.72);

    const decay = Math.exp(-dt * 3.2);
    const attack = 1 - Math.exp(-dt * 14.0);
    state.smoothMotion =
      targetMotion > state.smoothMotion
        ? state.smoothMotion + (targetMotion - state.smoothMotion) * attack
        : state.smoothMotion * decay;
    state.smoothVelLng = state.smoothVelLng * decay + instVelLng * (1 - decay) * 0.65;
    state.smoothVelLat = state.smoothVelLat * decay + instVelLat * (1 - decay) * 0.65;
  }
  state.prevCamLat = lat;
  state.prevCamLng = lng;
  state.prevCamDist = dist;
};

/**
 * Unified shader clock: updates time uniforms and camera motion reactivity
 * uniforms from scene.onBeforeRender, i.e. right before globe.gl renders a frame,
 * so shader animation (including the magnetic-field dithered ocean currents and
 * country selection effects) runs at the real render rate and reacts to globe motion.
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
    const motionState = {
      prevTimeSec: null,
      prevCamLat: null,
      prevCamLng: null,
      prevCamDist: null,
      smoothMotion: 0,
      smoothVelLng: 0,
      smoothVelLat: 0,
    };

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
        const dt =
          motionState.prevTimeSec != null
            ? Math.max(0.001, Math.min(0.1, timeSec - motionState.prevTimeSec))
            : 1 / 60;
        motionState.prevTimeSec = timeSec;

        const reduced = prefersReducedMotion();
        const cam = args[2] || globeEl.current?.camera?.();
        stepGlobeMotionState(motionState, cam, dt, reduced);

        polygonGlitchUniforms.uGlobeMotion.value = motionState.smoothMotion;
        polygonGlitchUniforms.uGlobeVelocity.value.set(
          motionState.smoothVelLng,
          motionState.smoothVelLat
        );

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
