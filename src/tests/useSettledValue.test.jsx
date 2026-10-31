import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useSettledValue from "../hooks/useSettledValue";

describe("useSettledValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useSettledValue("initial", 200, true));
    expect(result.current).toBe("initial");
  });

  it("retains old value after rerender until delayMs has elapsed", () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs, active }) => useSettledValue(value, delayMs, active),
      { initialProps: { value: "first", delayMs: 200, active: true } }
    );
    expect(result.current).toBe("first");

    rerender({ value: "second", delayMs: 200, active: true });
    expect(result.current).toBe("first");

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe("first");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("second");
  });

  it("applies only the last value after rapid successive changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs, active }) => useSettledValue(value, delayMs, active),
      { initialProps: { value: "v1", delayMs: 200, active: true } }
    );

    rerender({ value: "v2", delayMs: 200, active: true });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("v1");

    rerender({ value: "v3", delayMs: 200, active: true });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("v1");

    rerender({ value: "v4", delayMs: 200, active: true });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("v1");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("v4");
  });

  it("passes value through immediately when active is false", () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs, active }) => useSettledValue(value, delayMs, active),
      { initialProps: { value: "initial", delayMs: 200, active: false } }
    );
    expect(result.current).toBe("initial");

    rerender({ value: "updated", delayMs: 200, active: false });
    expect(result.current).toBe("updated");
  });

  it("passes value through immediately when delayMs is 0", () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs, active }) => useSettledValue(value, delayMs, active),
      { initialProps: { value: "initial", delayMs: 0, active: true } }
    );
    expect(result.current).toBe("initial");

    rerender({ value: "updated", delayMs: 0, active: true });
    expect(result.current).toBe("updated");
  });
});
