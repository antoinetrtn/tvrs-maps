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

  it("ignores small pointer jitter (< 12px) on click so side-card clicks do not double-fire or snap back", () => {
    const onSelectIndex = vi.fn();
    const { result } = renderHook(() =>
      useCarouselDrag({
        activeIndex: 1,
        totalModes: 5,
        onSelectIndex,
      })
    );

    const mockStage = document.createElement("div");
    result.current.stageRef.current = mockStage;

    act(() => {
      result.current.handlePointerDown({
        clientX: 200,
        target: mockStage,
      });
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 207 }));
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 207 }));
    });

    expect(onSelectIndex).not.toHaveBeenCalled();
    expect(result.current.wasDraggingRef.current).toBe(false);
    expect(result.current.isDragging).toBe(false);
  });

  it("uses latest activeIndex on swipe and blocks synthetic click via wasDraggingRef", () => {
    const onSelectIndex = vi.fn();
    const { result, rerender } = renderHook(
      ({ activeIndex }) =>
        useCarouselDrag({
          activeIndex,
          totalModes: 5,
          onSelectIndex,
        }),
      { initialProps: { activeIndex: 0 } }
    );

    const mockStage = document.createElement("div");
    result.current.stageRef.current = mockStage;

    act(() => {
      result.current.handlePointerDown({
        clientX: 200,
        target: mockStage,
      });
    });

    // Simulate activeIndex updating before pointerup
    rerender({ activeIndex: 2 });

    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 150 }));
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 150 }));
    });

    expect(onSelectIndex).toHaveBeenCalledTimes(1);
    expect(onSelectIndex).toHaveBeenCalledWith(3);
    expect(result.current.wasDraggingRef.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(result.current.wasDraggingRef.current).toBe(false);
  });

  it("cleans up window listeners if unmounted mid-drag", () => {
    const onSelectIndex = vi.fn();
    const { result, unmount } = renderHook(() =>
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
        clientX: 200,
        target: mockStage,
      });
    });

    unmount();

    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 120 }));
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 120 }));
    });

    expect(onSelectIndex).not.toHaveBeenCalled();
  });
});
