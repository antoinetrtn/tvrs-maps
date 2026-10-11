import { describe, expect, it } from "vitest";

import { isRendererForcedByUrl, resolveGlobeRenderer } from "../globe/render/globeRendererFlag";

const base = { envValue: "", search: "", preference: "webgl", hasWebGPU: true };

describe("globe renderer choice", () => {
  it("defaults to WebGL", () => {
    expect(resolveGlobeRenderer(base)).toBe("webgl");
  });

  it("follows the Settings preference", () => {
    expect(resolveGlobeRenderer({ ...base, preference: "webgpu" })).toBe("webgpu");
  });

  it("lets the URL override the preference both ways", () => {
    expect(resolveGlobeRenderer({ ...base, search: "?renderer=webgpu" })).toBe("webgpu");
    expect(resolveGlobeRenderer({ ...base, preference: "webgpu", search: "?renderer=webgl" })).toBe(
      "webgl"
    );
    expect(isRendererForcedByUrl("?renderer=webgl")).toBe(true);
    expect(isRendererForcedByUrl("")).toBe(false);
  });

  it("uses VITE_GLOBE_RENDERER when no preference is stored", () => {
    expect(resolveGlobeRenderer({ ...base, preference: undefined, envValue: "WebGPU" })).toBe(
      "webgpu"
    );
  });

  it("falls back silently without navigator.gpu", () => {
    expect(resolveGlobeRenderer({ ...base, preference: "webgpu", hasWebGPU: false })).toBe("webgl");
  });
});
