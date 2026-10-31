import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import usePrefersReducedMotion, { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";

describe("usePrefersReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns initial false when media query does not match", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(prefersReducedMotion()).toBe(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns initial true when media query matches", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(prefersReducedMotion()).toBe(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("reacts to a change event", () => {
    let listener = null;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn((event, cb) => {
        if (event === "change") {
          listener = cb;
        }
      }),
      removeEventListener: vi.fn((event, cb) => {
        if (event === "change" && listener === cb) {
          listener = null;
        }
      }),
    }));

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      listener?.({ matches: true });
    });
    expect(result.current).toBe(true);

    act(() => {
      listener?.({ matches: false });
    });
    expect(result.current).toBe(false);
  });

  it("guards against missing matchMedia safely", () => {
    window.matchMedia = undefined;
    expect(prefersReducedMotion()).toBe(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
