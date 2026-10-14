/**
 * Aliased in place of `three-render-objects` (see vite.config.js) so globe.gl,
 * which does not forward the option, creates its renderer with `useWebGPU`
 * when WebGPU is the active renderer. With WebGL this is a pass-through.
 */
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import ThreeRenderObjects from "three-render-objects-original";

import { isGlobeWebGPU } from "./globeRendererFlag";
import { markWebGPUFailed, watchWebGPURenderer } from "./webgpuHealth";

let composerPatched = false;
const initPromises = new WeakMap();

// three-render-objects always renders through an EffectComposer whose copy
// passes are GLSL-only. We use no extra passes, so under WebGPU a frame is just
// the scene render of the first RenderPass.
function patchComposerForWebGPU() {
  if (composerPatched) return;
  composerPatched = true;
  const original = EffectComposer.prototype.render;
  EffectComposer.prototype.render = function render(deltaTime) {
    const renderer = this.renderer;
    if (!renderer?.isWebGPURenderer) return original.call(this, deltaTime);
    // WebGPURenderer must finish its async init (adapter/device, or WebGL2
    // fallback) before the first frame; keep the previous frame meanwhile.
    if (!renderer.hasInitialized()) {
      if (!initPromises.has(renderer)) {
        const composer = this;
        initPromises.set(
          renderer,
          renderer
            .init()
            .then(() => {
              watchWebGPURenderer(renderer);
              composer.render();
            })
            .catch(markWebGPUFailed)
        );
      }
      return undefined;
    }
    const pass = this.passes.find((p) => p.scene && p.camera);
    if (pass) renderer.render(pass.scene, pass.camera);
    return undefined;
  };
}

export default function ThreeRenderObjectsWithFlag(config = {}) {
  const useWebGPU = config.useWebGPU ?? isGlobeWebGPU();
  if (useWebGPU) patchComposerForWebGPU();
  return ThreeRenderObjects({ ...config, useWebGPU });
}
