/**
 * Globe renderer choice: WebGPU by default, WebGL as the fallback.
 *
 * Wanted renderer, by priority: `?renderer=webgl|webgpu` in the URL, then the
 * Settings preference (globePrefs; only stored when the user picks one, so a
 * saved "webgl" is an explicit choice and is kept), then
 * VITE_GLOBE_RENDERER, then WebGPU. WebGPU is only used when `navigator.gpu`
 * exists, an adapter was found and it has not failed this session
 * (webgpuHealth); otherwise WebGL.
 */
import { getGlobePrefs } from "../globePrefs";
import { getWebGPUHealth } from "./webgpuHealth";

export function hasWebGPUSupport() {
  return typeof navigator !== "undefined" && Boolean(navigator.gpu);
}

const pick = (value) => {
  const v = String(value || "").toLowerCase();
  return v === "webgl" || v === "webgpu" ? v : null;
};

/** Renderer the user/config asks for, before capability checks. */
export function wantedGlobeRenderer({
  envValue = import.meta.env?.VITE_GLOBE_RENDERER,
  search = globalThis.location?.search || "",
  preference = getGlobePrefs().renderer,
} = {}) {
  return (
    pick(new URLSearchParams(search).get("renderer")) ||
    pick(preference) ||
    pick(envValue) ||
    "webgpu"
  );
}

export function resolveGlobeRenderer({
  hasWebGPU = hasWebGPUSupport(),
  health = getWebGPUHealth(),
  ...wantedOptions
} = {}) {
  if (wantedGlobeRenderer(wantedOptions) !== "webgpu") return "webgl";
  const usable = hasWebGPU && health.adapter !== "none" && !health.failed;
  return usable ? "webgpu" : "webgl";
}

/** Renderer for globes created now (the globe host remounts on change). */
export function isGlobeWebGPU() {
  return resolveGlobeRenderer() === "webgpu";
}

/** True when the URL forces a renderer (the Settings toggle is then moot). */
export function isRendererForcedByUrl(search = globalThis.location?.search || "") {
  return pick(new URLSearchParams(search).get("renderer")) !== null;
}
