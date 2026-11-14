import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { REGIONAL_PREFETCH_DELAY_MS, useGeoData } from "../hooks/useGeoData";
import { useGeoResource } from "../hooks/useGeoResource";

vi.mock("../hooks/useGeoResource");

/** Mocks the three resources by URL; returns their retry spies. */
function mockResources({ countries = "ready", departments = "ready", usStates = "ready" }) {
  const retries = { countries: vi.fn(), departments: vi.fn(), usStates: vi.fn() };
  const statuses = { countries, departments, usStates };
  vi.mocked(useGeoResource).mockImplementation(({ url }) => {
    const id = ["countries", "departements"].find((k) => url.includes(k));
    const key = id === "departements" ? "departments" : (id ?? "usStates");
    const status = statuses[key];
    return {
      data: status === "ready" ? [{ id: key }] : [],
      status,
      error: status === "error" ? new Error("fail") : null,
      retry: retries[key],
    };
  });
  return retries;
}

const renderMode = (mode) => renderHook(() => useGeoData({ mode })).result.current.geoStatus;

describe("useGeoData geoStatus aggregation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("countries mode: a failing departments idle prefetch stays silent", () => {
    const retries = mockResources({ departments: "error" });
    const geoStatus = renderMode("countries");

    expect(geoStatus.status).toBe("ready");
    expect(geoStatus.failed).toEqual([]);
    geoStatus.retry();
    expect(retries.countries).not.toHaveBeenCalled();
    expect(retries.departments).not.toHaveBeenCalled();
  });

  it.each([
    ["departments", "departments"],
    ["us_states", "usStates"],
  ])("%s mode: its dataset is required, retry refetches only it", (mode, key) => {
    const retries = mockResources({ [key]: "error" });
    const geoStatus = renderMode(mode);

    expect(geoStatus.status).toBe("error");
    expect(geoStatus.failed).toEqual([key]);
    geoStatus.retry();
    expect(retries[key]).toHaveBeenCalledTimes(1);
    expect(Object.values(retries).filter((fn) => fn.mock.calls.length)).toHaveLength(1);
  });

  it("is loading while a required dataset is loading", () => {
    mockResources({ countries: "loading", departments: "idle", usStates: "idle" });
    const geoStatus = renderMode("countries");

    expect(geoStatus.status).toBe("loading");
    expect(geoStatus.failed).toEqual([]);
  });

  it("enables département and US prefetch shortly after countries are ready, without opening those modes", () => {
    vi.useFakeTimers();
    // jsdom has no requestIdleCallback — prefetch should arm after the delay alone.
    mockResources({ countries: "ready", departments: "idle", usStates: "idle" });
    renderHook(() => useGeoData({ mode: "countries" }));

    const enabledOf = (urlPart) => {
      const calls = vi.mocked(useGeoResource).mock.calls;
      const last = [...calls].reverse().find(([opts]) => opts.url.includes(urlPart));
      return last?.[0]?.enabled;
    };

    expect(enabledOf("departements")).toBe(false);
    expect(enabledOf("us-states")).toBe(false);

    act(() => {
      vi.advanceTimersByTime(REGIONAL_PREFETCH_DELAY_MS);
    });

    expect(enabledOf("departements")).toBe(true);
    expect(enabledOf("us-states")).toBe(true);
    vi.useRealTimers();
  });

  it("opens a regional mode: that dataset is enabled immediately, before the prefetch delay", () => {
    vi.useFakeTimers();
    mockResources({ countries: "ready", departments: "idle", usStates: "idle" });
    renderHook(() => useGeoData({ mode: "departments" }));

    const enabledOf = (urlPart) => {
      const calls = vi.mocked(useGeoResource).mock.calls;
      const last = [...calls].reverse().find(([opts]) => opts.url.includes(urlPart));
      return last?.[0]?.enabled;
    };

    expect(enabledOf("departements")).toBe(true);
    expect(enabledOf("us-states")).toBe(false);
    vi.useRealTimers();
  });
});
