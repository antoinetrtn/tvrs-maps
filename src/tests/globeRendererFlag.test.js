import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isRendererForcedByUrl,
  resolveGlobeRenderer,
  wantedGlobeRenderer,
} from "../globe/render/globeRendererFlag";
import {
  getWebGPUHealth,
  markWebGPUFailed,
  probeWebGPUAdapter,
  resetWebGPUHealth,
  watchWebGPURenderer,
} from "../globe/render/webgpuHealth";

const OK = { adapter: "ok", failed: false };
const base = { envValue: "", search: "", preference: null, hasWebGPU: true, health: OK };

describe("globe renderer choice", () => {
  it("defaults to WebGPU when nothing is saved (old default users migrate)", () => {
    expect(resolveGlobeRenderer(base)).toBe("webgpu");
    expect(resolveGlobeRenderer({ ...base, preference: undefined })).toBe("webgpu");
    expect(resolveGlobeRenderer({ ...base, preference: "garbage" })).toBe("webgpu");
  });

  it("keeps an explicitly saved WebGL choice", () => {
    expect(resolveGlobeRenderer({ ...base, preference: "webgl" })).toBe("webgl");
  });

  it("lets the URL override the preference both ways", () => {
    expect(resolveGlobeRenderer({ ...base, preference: "webgl", search: "?renderer=webgpu" })).toBe(
      "webgpu"
    );
    expect(resolveGlobeRenderer({ ...base, search: "?renderer=webgl" })).toBe("webgl");
    expect(isRendererForcedByUrl("?renderer=webgl")).toBe(true);
    expect(isRendererForcedByUrl("?renderer=nope")).toBe(false);
  });

  it("uses VITE_GLOBE_RENDERER when no preference is stored", () => {
    expect(wantedGlobeRenderer({ ...base, envValue: "WebGL" })).toBe("webgl");
    expect(wantedGlobeRenderer({ ...base, envValue: "" })).toBe("webgpu");
  });

  it("falls back to WebGL without navigator.gpu, adapter or after a failure", () => {
    expect(resolveGlobeRenderer({ ...base, hasWebGPU: false })).toBe("webgl");
    expect(resolveGlobeRenderer({ ...base, health: { adapter: "none", failed: false } })).toBe(
      "webgl"
    );
    expect(resolveGlobeRenderer({ ...base, health: { adapter: "ok", failed: true } })).toBe(
      "webgl"
    );
    // Not probed yet: WebGPU stays the target (the host waits for the probe).
    expect(resolveGlobeRenderer({ ...base, health: { adapter: "unknown", failed: false } })).toBe(
      "webgpu"
    );
  });
});

describe("webgpu health", () => {
  afterEach(() => resetWebGPUHealth());

  it("probes the adapter once", async () => {
    const gpu = { requestAdapter: vi.fn().mockResolvedValue({}) };
    expect(await probeWebGPUAdapter(gpu)).toBe("ok");
    expect(await probeWebGPUAdapter(gpu)).toBe("ok");
    expect(gpu.requestAdapter).toHaveBeenCalledTimes(1);
  });

  it("reports no adapter on null or rejection", async () => {
    expect(await probeWebGPUAdapter({ requestAdapter: () => Promise.resolve(null) })).toBe("none");
    resetWebGPUHealth();
    expect(await probeWebGPUAdapter({ requestAdapter: () => Promise.reject(new Error("x")) })).toBe(
      "none"
    );
  });

  it("marks failure on WebGL2-backend fallback and on device loss", async () => {
    watchWebGPURenderer({ backend: { isWebGLBackend: true } });
    expect(getWebGPUHealth().failed).toBe(true);

    resetWebGPUHealth();
    let lose;
    const lost = new Promise((resolve) => (lose = resolve));
    watchWebGPURenderer({ backend: { device: { lost } } });
    lose({ reason: "unknown" });
    await lost;
    await Promise.resolve();
    expect(getWebGPUHealth().failed).toBe(true);
  });

  it("ignores our own device destruction", async () => {
    const lost = Promise.resolve({ reason: "destroyed" });
    watchWebGPURenderer({ backend: { device: { lost } } });
    await lost;
    await Promise.resolve();
    expect(getWebGPUHealth().failed).toBe(false);
    markWebGPUFailed();
    expect(getWebGPUHealth().failed).toBe(true);
  });
});
