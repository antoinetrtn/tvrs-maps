/**
 * Experimental WebGPU renderer flag for the globe (off by default).
 *
 * Enabled when either:
 * - the build sets VITE_GLOBE_RENDERER=webgpu, or
 * - the URL has ?renderer=webgpu on a non-production host.
 * `?renderer=webgl` always forces the classic path. Without `navigator.gpu`
 * we stay on WebGLRenderer; if the adapter request fails later, three's
 * WebGPURenderer falls back to its own WebGL2 backend by itself.
 */
const PRODUCTION_HOSTS = new Set(["maps.tvrs.fr", "www.maps.tvrs.fr"]);

export function resolveGlobeRenderer({
  envValue = import.meta.env?.VITE_GLOBE_RENDERER,
  search = globalThis.location?.search || "",
  hostname = globalThis.location?.hostname || "",
  hasWebGPU = typeof navigator !== "undefined" && Boolean(navigator.gpu),
} = {}) {
  const param = new URLSearchParams(search).get("renderer");
  if (param === "webgl") return "webgl";
  const fromUrl = param === "webgpu" && !PRODUCTION_HOSTS.has(hostname);
  const fromEnv = String(envValue || "").toLowerCase() === "webgpu";
  return (fromUrl || fromEnv) && hasWebGPU ? "webgpu" : "webgl";
}

let cached = null;
/** Resolved once per page load (the renderer cannot change at runtime). */
export function isGlobeWebGPU() {
  if (cached === null) cached = resolveGlobeRenderer() === "webgpu";
  return cached;
}
