/**
 * Globe renderer choice: WebGL (default) or experimental WebGPU.
 *
 * Priority: `?renderer=webgl|webgpu` in the URL, then the Settings preference
 * (globePrefs, persisted in localStorage), then VITE_GLOBE_RENDERER=webgpu.
 * WebGPU also needs `navigator.gpu`; otherwise we stay on WebGLRenderer. If the
 * adapter request fails later, three's WebGPURenderer falls back to its own
 * WebGL2 backend by itself.
 */
import { getGlobePrefs } from "../globePrefs";

export function hasWebGPUSupport() {
  return typeof navigator !== "undefined" && Boolean(navigator.gpu);
}

export function resolveGlobeRenderer({
  envValue = import.meta.env?.VITE_GLOBE_RENDERER,
  search = globalThis.location?.search || "",
  preference = getGlobePrefs().renderer,
  hasWebGPU = hasWebGPUSupport(),
} = {}) {
  const param = new URLSearchParams(search).get("renderer");
  let wanted = String(envValue || "").toLowerCase() === "webgpu" ? "webgpu" : "webgl";
  if (preference === "webgpu" || preference === "webgl") wanted = preference;
  if (param === "webgpu" || param === "webgl") wanted = param;
  return wanted === "webgpu" && hasWebGPU ? "webgpu" : "webgl";
}

/** Renderer for globes created now (the globe host remounts on change). */
export function isGlobeWebGPU() {
  return resolveGlobeRenderer() === "webgpu";
}

/** True when the URL forces a renderer (the Settings toggle is then moot). */
export function isRendererForcedByUrl(search = globalThis.location?.search || "") {
  const param = new URLSearchParams(search).get("renderer");
  return param === "webgpu" || param === "webgl";
}
