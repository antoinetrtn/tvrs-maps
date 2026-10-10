import { describe, expect, it } from "vitest";

import { resolveGlobeRenderer } from "../globe/render/globeRendererFlag";

const base = { envValue: "", search: "", hostname: "dev.example.app", hasWebGPU: true };

describe("globe renderer flag", () => {
  it("defaults to WebGL", () => {
    expect(resolveGlobeRenderer(base)).toBe("webgl");
  });

  it("enables WebGPU with ?renderer=webgpu off production", () => {
    expect(resolveGlobeRenderer({ ...base, search: "?renderer=webgpu" })).toBe("webgpu");
  });

  it("ignores the URL switch on the production host", () => {
    expect(
      resolveGlobeRenderer({ ...base, search: "?renderer=webgpu", hostname: "maps.tvrs.fr" })
    ).toBe("webgl");
  });

  it("enables WebGPU from VITE_GLOBE_RENDERER", () => {
    expect(resolveGlobeRenderer({ ...base, envValue: "WebGPU", hostname: "maps.tvrs.fr" })).toBe(
      "webgpu"
    );
  });

  it("falls back silently without navigator.gpu", () => {
    expect(resolveGlobeRenderer({ ...base, search: "?renderer=webgpu", hasWebGPU: false })).toBe(
      "webgl"
    );
  });

  it("?renderer=webgl always wins", () => {
    expect(resolveGlobeRenderer({ ...base, envValue: "webgpu", search: "?renderer=webgl" })).toBe(
      "webgl"
    );
  });
});
