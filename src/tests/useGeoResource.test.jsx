import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FETCH_TIMEOUT_MS, RETRY_DELAYS_MS, useGeoResource } from "../hooks/useGeoResource";

describe("useGeoResource", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("handles success (status loading -> ready, data = transform(features))", async () => {
    const rawFeatures = [{ properties: { name: "Alpha" } }];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: rawFeatures }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const transform = (features) => features.map((f) => ({ ...f, mapped: true }));
    const { result } = renderHook(() => useGeoResource({ url: "/data/test.json", transform }));

    expect(result.current.status).toBe("loading");
    await act(async () => {});

    expect(result.current.status).toBe("ready");
    expect(result.current.data).toEqual([{ properties: { name: "Alpha" }, mapped: true }]);
    expect(result.current.error).toBeNull();
  });

  it("res.ok false triggers 2 automatic retries then status becomes error with fetch called 3 times", async () => {
    vi.useFakeTimers();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useGeoResource({ url: "/data/fail.json" }));

    expect(result.current.status).toBe("loading");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("loading");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeInstanceOf(Error);
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it("manual retry() after error succeeds -> ready", async () => {
    vi.useFakeTimers();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 3) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ features: [{ id: 1 }] }),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useGeoResource({ url: "/data/retry.json" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
    });
    expect(result.current.status).toBe("error");

    await act(async () => {
      result.current.retry();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.data).toEqual([{ id: 1 }]);
    expect(result.current.error).toBeNull();

    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it("payload without features -> error", async () => {
    vi.useFakeTimers();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useGeoResource({ url: "/data/empty.json" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error.message).toBe("invalid geodata");

    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it("enabled=false -> idle and fetch never called, then enabled=true fetches", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ id: "feat" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result, rerender } = renderHook(
      ({ enabled }) => useGeoResource({ url: "/data/test.json", enabled }),
      { initialProps: { enabled: false } }
    );

    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(result.current.status).toBe("loading");
    await act(async () => {});

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("ready");
    expect(result.current.data).toEqual([{ id: "feat" }]);
  });

  it("changing transform identity does not refetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ id: "item" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result, rerender } = renderHook(
      ({ transform }) => useGeoResource({ url: "/data/test.json", transform }),
      { initialProps: { transform: (f) => f } }
    );

    await act(async () => {});
    expect(result.current.status).toBe("ready");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    rerender({ transform: (f) => f.map((x) => ({ ...x, newProp: true })) });
    await act(async () => {});

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("unmount aborts (signal.aborted true) and does not setState", () => {
    let abortSignal = null;
    const mockFetch = vi.fn().mockImplementation((_url, { signal }) => {
      abortSignal = signal;
      return new Promise(() => {});
    });
    vi.stubGlobal("fetch", mockFetch);

    const { unmount } = renderHook(() => useGeoResource({ url: "/data/hang.json" }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(abortSignal.aborted).toBe(false);

    unmount();

    expect(abortSignal.aborted).toBe(true);
  });

  it("online event while in error triggers a new fetch", async () => {
    vi.useFakeTimers();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 3) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ features: [{ id: "online-ok" }] }),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useGeoResource({ url: "/data/online.json" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
    });
    expect(result.current.status).toBe("error");
    expect(mockFetch).toHaveBeenCalledTimes(3);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(result.current.status).toBe("ready");
    expect(result.current.data).toEqual([{ id: "online-ok" }]);

    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it("aborts and counts as a failed attempt after 20s timeout", async () => {
    vi.useFakeTimers();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let abortSignal = null;
    const mockFetch = vi.fn().mockImplementation((_url, { signal }) => {
      abortSignal = signal;
      return new Promise(() => {});
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useGeoResource({ url: "/data/timeout.json" }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(abortSignal.aborted).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    });

    expect(abortSignal.aborted).toBe(true);
    expect(result.current.status).toBe("loading");

    consoleSpy.mockRestore();
    vi.useRealTimers();
  });
});
