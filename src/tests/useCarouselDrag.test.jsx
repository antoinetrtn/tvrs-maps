import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useCarouselDrag from "../components/useCarouselDrag";

describe("useCarouselDrag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with stageRef and isDragging false", () => {
    const onSelectIndex = vi.fn();
    const { result } = renderHook(() =>
      useCarouselDrag({
        activeIndex: 0,
        totalModes: 5,
        onSelectIndex,
      })
    );

    expect(result.current.isDragging).toBe(false);
    expect(result.current.stageRef.current).toBeNull();
  });

  it("sets isDragging true on pointer down", () => {
    const onSelectIndex = vi.fn();
    const { result } = renderHook(() =>
      useCarouselDrag({
        activeIndex: 0,
        totalModes: 5,
        onSelectIndex,
      })
    );

    const mockStage = document.createElement("div");
    result.current.stageRef.current = mockStage;

    act(() => {
      result.current.handlePointerDown({
        clientX: 100,
        target: mockStage,
      });
    });

    expect(result.current.isDragging).toBe(true);
  });

  it("does not drag when exiting prop is true", () => {
    const onSelectIndex = vi.fn();
    const { result } = renderHook(() =>
      useCarouselDrag({
        activeIndex: 0,
        totalModes: 5,
        onSelectIndex,
        exiting: true,
      })
    );

    const mockStage = document.createElement("div");
    result.current.stageRef.current = mockStage;

    act(() => {
      result.current.handlePointerDown({
        clientX: 100,
        target: mockStage,
      });
    });

    expect(result.current.isDragging).toBe(false);
  });
});
