/**
 * Runtime WebGPU availability, shared by the renderer flag and the globe host.
 * `navigator.gpu` alone is not enough (Linux/old GPUs expose it but return no
 * adapter), so the host probes an adapter before mounting a WebGPU globe, and
 * any init failure / device loss flips the session back to WebGL.
 */
// globalThis holder: Vite may load this module twice in dev (see globePrefs).
const holder = (globalThis.__TVRS_WEBGPU_HEALTH__ ||= {
  state: { adapter: "unknown", failed: false },
  probe: null,
});
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn());
const update = (patch) => {
  holder.state = { ...holder.state, ...patch };
  emit();
};

export const getWebGPUHealth = () => holder.state;

export function subscribeWebGPUHealth(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Requests an adapter once per session; resolves to "ok" or "none". */
export function probeWebGPUAdapter(gpu = globalThis.navigator?.gpu) {
  if (holder.state.adapter !== "unknown") return Promise.resolve(holder.state.adapter);
  holder.probe ||= Promise.resolve()
    .then(() => gpu?.requestAdapter?.())
    .then(
      (adapter) => (adapter ? "ok" : "none"),
      () => "none"
    )
    .then((result) => {
      update({ adapter: result });
      return result;
    });
  return holder.probe;
}

/** WebGPU init failed, fell back to its WebGL2 backend, or the device was lost. */
export function markWebGPUFailed() {
  if (!holder.state.failed) update({ failed: true });
}

/**
 * Watches a freshly initialised WebGPURenderer: WebGL2-backend fallback or a
 * later device loss (other than our own dispose) mark WebGPU as failed.
 */
export function watchWebGPURenderer(renderer) {
  const backend = renderer?.backend;
  if (!backend) return;
  if (backend.isWebGLBackend) {
    markWebGPUFailed();
    return;
  }
  backend.device?.lost?.then((info) => {
    if (info?.reason !== "destroyed") markWebGPUFailed();
  });
}

/** Test helper. */
export function resetWebGPUHealth(state = { adapter: "unknown", failed: false }) {
  holder.state = { ...state };
  holder.probe = null;
}
