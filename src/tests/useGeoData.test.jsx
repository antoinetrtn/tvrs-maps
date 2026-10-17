import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGeoData } from "../hooks/useGeoData";
import { useGeoResource } from "../hooks/useGeoResource";

vi.mock("../hooks/useGeoResource");

describe("useGeoData geoStatus aggregation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("only countries required in countries mode (failing departments idle prefetch keeps status ready)", () => {
    const countriesRetry = vi.fn();
    const departmentsRetry = vi.fn();
    const usStatesRetry = vi.fn();

    vi.mocked(useGeoResource).mockImplementation(({ url }) => {
      if (url.includes("countries")) {
        return { data: [{ id: "c0" }], status: "ready", error: null, retry: countriesRetry };
      }
      if (url.includes("departements")) {
        return {
          data: [],
          status: "error",
          error: new Error("fail"),
          retry: departmentsRetry,
        };
      }
      return { data: [], status: "ready", error: null, retry: usStatesRetry };
    });

    const { result } = renderHook(() => useGeoData({ mode: "countries" }));

    expect(result.current.geoStatus.status).toBe("ready");
    expect(result.current.geoStatus.failed).toEqual([]);

    result.current.geoStatus.retry();
    expect(countriesRetry).not.toHaveBeenCalled();
    expect(departmentsRetry).not.toHaveBeenCalled();
  });

  it(
    "departments required in departments mode " +
      "(failing -> error, failed ['departments'], retry refetches only it)",
    () => {
      const countriesRetry = vi.fn();
      const departmentsRetry = vi.fn();
      const usStatesRetry = vi.fn();

      vi.mocked(useGeoResource).mockImplementation(({ url }) => {
        if (url.includes("countries")) {
          return { data: [{ id: "c0" }], status: "ready", error: null, retry: countriesRetry };
        }
        if (url.includes("departements")) {
          return {
            data: [],
            status: "error",
            error: new Error("fail"),
            retry: departmentsRetry,
          };
        }
        return { data: [], status: "ready", error: null, retry: usStatesRetry };
      });

      const { result } = renderHook(() => useGeoData({ mode: "departments" }));

      expect(result.current.geoStatus.status).toBe("error");
      expect(result.current.geoStatus.failed).toEqual(["departments"]);

      result.current.geoStatus.retry();
      expect(departmentsRetry).toHaveBeenCalledTimes(1);
      expect(countriesRetry).not.toHaveBeenCalled();
    }
  );

  it("us states required in us_states mode (failing -> error, failed ['usStates'], retry refetches only it)", () => {
    const countriesRetry = vi.fn();
    const departmentsRetry = vi.fn();
    const usStatesRetry = vi.fn();

    vi.mocked(useGeoResource).mockImplementation(({ url }) => {
      if (url.includes("countries")) {
        return { data: [{ id: "c0" }], status: "ready", error: null, retry: countriesRetry };
      }
      if (url.includes("departements")) {
        return { data: [], status: "ready", error: null, retry: departmentsRetry };
      }
      return {
        data: [],
        status: "error",
        error: new Error("fail"),
        retry: usStatesRetry,
      };
    });

    const { result } = renderHook(() => useGeoData({ mode: "us_states" }));

    expect(result.current.geoStatus.status).toBe("error");
    expect(result.current.geoStatus.failed).toEqual(["usStates"]);

    result.current.geoStatus.retry();
    expect(usStatesRetry).toHaveBeenCalledTimes(1);
    expect(countriesRetry).not.toHaveBeenCalled();
    expect(departmentsRetry).not.toHaveBeenCalled();
  });

  it("sets status to loading when a required dataset is loading", () => {
    vi.mocked(useGeoResource).mockImplementation(({ url }) => {
      if (url.includes("countries")) {
        return { data: [], status: "loading", error: null, retry: vi.fn() };
      }
      return { data: [], status: "idle", error: null, retry: vi.fn() };
    });

    const { result } = renderHook(() => useGeoData({ mode: "countries" }));

    expect(result.current.geoStatus.status).toBe("loading");
    expect(result.current.geoStatus.failed).toEqual([]);
  });
});
