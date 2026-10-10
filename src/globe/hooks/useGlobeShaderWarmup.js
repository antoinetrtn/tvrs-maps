import { useEffect, useRef } from "react";

// How long after a state change we keep looking for freshly assigned
// materials (globe.gl applies data/accessor changes on a debounced digest).
const WARM_WINDOW_MS = 900;
const WARM_CHECK_INTERVAL_MS = 120;
// Never hold frames longer than this, even if the driver is slow.
const MAX_HOLD_MS = 1200;

/**
 * Non-blocking shader warm-up.
 *
 * A game-mode switch or game start assigns material variants that have no GPU
 * program yet. three.js then links them synchronously during the next render,
 * which froze the main thread for hundreds of ms (carousel/UI included).
 *
 * After each relevant state change, we call `renderer.compile()` (it only
 * issues compile/link calls, without waiting) and, with KHR_parallel_shader_compile,
 * keep presenting the previous frame until the new programs report ready.
 * Without the extension programs report ready at once (same behavior as
 * before). Frames are never held longer than MAX_HOLD_MS.
 */
// Programs created by compile() whose parallel link is still running.
// Materials without a program (e.g. `visible: false`) are skipped.
function collectPendingPrograms(renderer, materials) {
  const pending = [];
  if (!materials || typeof materials.forEach !== "function") return pending;
  materials.forEach((material) => {
    const program = renderer.properties?.get?.(material)?.currentProgram;
    if (program && typeof program.isReady === "function" && !program.isReady()) {
      pending.push(program);
    }
  });
  return pending;
}

function waitForPrograms(programs, done) {
  let remaining = programs;
  const check = () => {
    remaining = remaining.filter((program) => !program.isReady());
    if (remaining.length === 0) done();
    else setTimeout(check, 10);
  };
  setTimeout(check, 10);
}

function startProgramCompile(renderer, scene, camera) {
  try {
    return collectPendingPrograms(renderer, renderer.compile(scene, camera));
  } catch {
    return [];
  }
}

// Returns true when the current frame should be skipped (previous frame kept)
// because freshly assigned shader programs are still linking in parallel.
function shouldHoldForWarmup(renderer, scene, camera, state, now) {
  if (state.pending) {
    if (now - state.holdSince < MAX_HOLD_MS) return true;
    state.pending = false;
  }
  const armed = now < state.armedUntil && now - state.lastCheck >= WARM_CHECK_INTERVAL_MS;
  if (!armed || !scene?.isScene) return false;
  state.lastCheck = now;
  const notReady = startProgramCompile(renderer, scene, camera);
  if (notReady.length === 0) return false;
  state.pending = true;
  state.holdSince = now;
  waitForPrograms(notReady, () => {
    state.pending = false;
  });
  return true;
}

export function useGlobeShaderWarmup(globeEl, warmKey) {
  const stateRef = useRef({ armedUntil: 0, lastCheck: 0, pending: false, holdSince: 0 });

  useEffect(() => {
    let restore = null;
    let waitId = null;
    const install = () => {
      waitId = null;
      const globe = globeEl.current;
      const renderer = globe?.renderer?.();
      if (!renderer || typeof renderer.compile !== "function") {
        waitId = setTimeout(install, 100);
        return;
      }
      // Without the extension compile() cannot report progress without
      // blocking, so the warm-up would only add work: leave rendering as is.
      // WebGPU (experimental flag) builds pipelines asynchronously already,
      // and getContext() there would configure the canvas before init.
      if (renderer.isWebGPURenderer) return;
      if (!renderer.getContext?.()?.getExtension?.("KHR_parallel_shader_compile")) return;
      const state = stateRef.current;
      // globe.gl draws through an EffectComposer whose RenderPass calls
      // renderer.clear() right *before* renderer.render(). Holding only
      // render() therefore presented a cleared, undrawn buffer: a black frame
      // on learn-mode clicks and on return home. Hold the whole composer
      // frame instead so the previous image really stays on screen.
      const composer = globe.postProcessingComposer?.();
      const target = typeof composer?.render === "function" ? composer : renderer;
      const originalRender = target.render;
      target.render = function warmRender(...args) {
        const scene = target === renderer ? args[0] : globe.scene?.();
        const camera = target === renderer ? args[1] : globe.camera?.();
        if (shouldHoldForWarmup(renderer, scene, camera, state, performance.now())) {
          return undefined;
        }
        return originalRender.apply(this, args);
      };
      restore = () => {
        target.render = originalRender;
      };
    };
    install();
    return () => {
      if (waitId != null) clearTimeout(waitId);
      restore?.();
    };
  }, [globeEl]);

  useEffect(() => {
    stateRef.current.armedUntil = performance.now() + WARM_WINDOW_MS;
    stateRef.current.lastCheck = 0;
  }, [warmKey]);
}
