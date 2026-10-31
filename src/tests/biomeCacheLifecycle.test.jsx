import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGlobeSceneAnimation } from "../globe/hooks/useGlobeSceneAnimation";
import { disposeBiomeCache } from "../globe/render/LowPolyBiomes";

vi.mock("../globe/render/LowPolyBiomes", () => ({
  disposeBiomeCache: vi.fn(),
}));

vi.mock("../globe/hooks/useGlobeAnimationLoop", () => ({
  useGlobeAnimationLoop: vi.fn(),
}));

describe("useGlobeSceneAnimation biome cache lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const selectionTransition = {
    refs: {
      transitioningPreviousCountryRef: { current: null },
      transitioningIncomingCountryRef: { current: null },
      selectionTransitionStartRef: { current: 0 },
    },
    state: {
      transitioningPreviousCountryState: null,
      transitioningIncomingCountryState: null,
    },
    setters: {
      setTransitioningPreviousCountryState: vi.fn(),
      setTransitioningIncomingCountryState: vi.fn(),
    },
  };

  it("does not dispose cache when foundList grows, disposes on reset to empty, and disposes on unmount", () => {
    const { rerender, unmount } = renderHook(
      ({ foundList }) =>
        useGlobeSceneAnimation({
          selectionTransition,
          foundList,
        }),
      { initialProps: { foundList: [] } }
    );

    expect(disposeBiomeCache).toHaveBeenCalledTimes(0);

    rerender({ foundList: ["France"] });
    expect(disposeBiomeCache).toHaveBeenCalledTimes(0);

    rerender({ foundList: ["France", "Spain"] });
    expect(disposeBiomeCache).toHaveBeenCalledTimes(0);

    rerender({ foundList: [] });
    expect(disposeBiomeCache).toHaveBeenCalledTimes(1);

    unmount();
    expect(disposeBiomeCache).toHaveBeenCalledTimes(2);
  });

  it("does not dispose cache when rerendered with an empty list reference", () => {
    const { rerender } = renderHook(
      ({ foundList }) =>
        useGlobeSceneAnimation({
          selectionTransition,
          foundList,
        }),
      { initialProps: { foundList: [] } }
    );

    expect(disposeBiomeCache).toHaveBeenCalledTimes(0);

    rerender({ foundList: [] });
    expect(disposeBiomeCache).toHaveBeenCalledTimes(0);
  });
});
