import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useBootGate } from "../boot/useBootGate";

describe("useBootGate", () => {
  let bootEl;
  let rootEl;

  beforeEach(() => {
    bootEl = document.createElement("div");
    bootEl.id = "tvrs-boot";
    document.body.appendChild(bootEl);

    rootEl = document.createElement("div");
    rootEl.id = "root";
    rootEl.setAttribute("aria-busy", "true");
    document.body.appendChild(rootEl);
  });

  afterEach(() => {
    bootEl?.remove();
    rootEl?.remove();
  });

  it("starts not ready until both geo data and globe are ready", () => {
    const { result, rerender } = renderHook(({ geoStatus }) => useBootGate({ geoStatus }), {
      initialProps: { geoStatus: { status: "loading" } },
    });

    expect(result.current.isBootReady).toBe(false);
    expect(result.current.isGlobeReady).toBe(false);

    // Globe fires, but geo data is still loading
    act(() => {
      result.current.onGlobeReady();
    });
    expect(result.current.isGlobeReady).toBe(true);
    expect(result.current.isBootReady).toBe(false);
    expect(bootEl.classList.contains("tvrs-boot-done")).toBe(false);

    // Geo data becomes ready -> gate opens
    rerender({ geoStatus: { status: "ready" } });
    expect(result.current.isBootReady).toBe(true);
    expect(bootEl.classList.contains("tvrs-boot-done")).toBe(true);
    expect(rootEl.getAttribute("aria-busy")).toBeNull();
  });

  it("stays not ready if geo data is ready before globe", () => {
    const { result, rerender } = renderHook(({ geoStatus }) => useBootGate({ geoStatus }), {
      initialProps: { geoStatus: { status: "ready" } },
    });

    expect(result.current.isBootReady).toBe(false);
    expect(result.current.isGlobeReady).toBe(false);
    expect(bootEl.classList.contains("tvrs-boot-done")).toBe(false);

    // Globe fires ready
    act(() => {
      result.current.onGlobeReady();
    });
    rerender({ geoStatus: { status: "ready" } });
    expect(result.current.isBootReady).toBe(true);
    expect(bootEl.classList.contains("tvrs-boot-done")).toBe(true);
  });

  it("yields boot overlay immediately if geo data fails with error", () => {
    const { result } = renderHook(() => useBootGate({ geoStatus: { status: "error" } }));

    expect(result.current.isBootReady).toBe(false);
    expect(bootEl.classList.contains("tvrs-boot-done")).toBe(true);
    expect(rootEl.getAttribute("aria-busy")).toBeNull();
  });
});
