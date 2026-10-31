import { describe, expect, it } from "vitest";

import {
  CONQUEST_FOCUS_HOLD_MS,
  nextConquestFocus,
  shouldAutoRelease,
} from "../multiplayer/conquestFocus";

describe("conquestFocus", () => {
  it("holds transient focus for 2500 ms", () => {
    expect(CONQUEST_FOCUS_HOLD_MS).toBe(2500);
  });

  it("returns null when countryId is falsy", () => {
    expect(nextConquestFocus(null, null)).toBeNull();
    expect(nextConquestFocus(null, "")).toBeNull();
    expect(nextConquestFocus(null, undefined)).toBeNull();
    expect(nextConquestFocus({ id: "FRA", sticky: true }, null)).toBeNull();
    expect(nextConquestFocus({ id: "FRA", sticky: false }, "")).toBeNull();
  });

  it("creates transient focus by default or when sticky is false", () => {
    expect(nextConquestFocus(null, "FRA", { sticky: false })).toEqual({
      id: "FRA",
      sticky: false,
    });
    expect(nextConquestFocus(null, "FRA")).toEqual({
      id: "FRA",
      sticky: false,
    });
  });

  it("creates a sticky selection when sticky is true", () => {
    expect(nextConquestFocus(null, "FRA", { sticky: true })).toEqual({
      id: "FRA",
      sticky: true,
    });
  });

  it("deselects when tapping the same sticky country", () => {
    const prev = { id: "FRA", sticky: true };
    expect(nextConquestFocus(prev, "FRA", { sticky: true })).toBeNull();
  });

  it("replaces a transient focus with a new sticky one", () => {
    const prev = { id: "FRA", sticky: false };
    expect(nextConquestFocus(prev, "DEU", { sticky: true })).toEqual({
      id: "DEU",
      sticky: true,
    });
    expect(nextConquestFocus(prev, "FRA", { sticky: true })).toEqual({
      id: "FRA",
      sticky: true,
    });
  });

  it("replaces a sticky selection with another sticky country", () => {
    const prev = { id: "FRA", sticky: true };
    expect(nextConquestFocus(prev, "DEU", { sticky: true })).toEqual({
      id: "DEU",
      sticky: true,
    });
  });

  it("does not auto-release sticky selection, but auto-releases transient focus", () => {
    const stickyFocus = nextConquestFocus(null, "FRA", { sticky: true });
    const transientFocus = nextConquestFocus(null, "FRA", { sticky: false });

    expect(shouldAutoRelease(stickyFocus)).toBe(false);
    expect(shouldAutoRelease(transientFocus)).toBe(true);
    expect(shouldAutoRelease(null)).toBe(false);
    expect(shouldAutoRelease(undefined)).toBe(false);
  });
});
