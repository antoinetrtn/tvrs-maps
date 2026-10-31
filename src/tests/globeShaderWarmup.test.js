import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useGlobeShaderWarmup } from "../globe/hooks/useGlobeShaderWarmup";

// A program whose parallel link is still running.
const pendingProgram = { isReady: () => false };

function makeGlobe() {
  const material = {};
  const renderer = {
    compile: vi.fn(() => new Set([material])),
    properties: { get: () => ({ currentProgram: pendingProgram }) },
    getContext: () => ({ getExtension: () => ({}) }),
    render: vi.fn(),
    clear: vi.fn(),
  };
  // Mirrors three's RenderPass: clear() first, then render().
  const composer = {
    render: vi.fn(() => {
      renderer.clear();
      renderer.render({ isScene: true }, {});
    }),
  };
  composer.originalRender = composer.render;
  const globe = {
    renderer: () => renderer,
    postProcessingComposer: () => composer,
    scene: () => ({ isScene: true }),
    camera: () => ({}),
  };
  return { globe, renderer, composer };
}

describe("useGlobeShaderWarmup", () => {
  it("holds the whole composer frame (no clear without draw → no black flash)", () => {
    const { globe, renderer, composer } = makeGlobe();
    const ref = { current: globe };
    renderHook(() => useGlobeShaderWarmup(ref, "learn|France"));
    expect(composer.render).not.toBe(composer.originalRender);

    composer.render();
    expect(renderer.compile).toHaveBeenCalled();
    expect(renderer.clear).not.toHaveBeenCalled();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("restores the composer on unmount", () => {
    const { globe, composer } = makeGlobe();
    const { unmount } = renderHook(() => useGlobeShaderWarmup({ current: globe }, "k"));
    unmount();
    expect(composer.render).toBe(composer.originalRender);
  });
});
