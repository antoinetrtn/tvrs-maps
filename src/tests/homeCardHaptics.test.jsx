import { render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomeScreenCategoryCarousel from "../components/HomeScreenCategoryCarousel";
import {
  resetHapticsThrottleForTests,
  SELECTION_HAPTIC_COOLDOWN_MS,
  SELECTION_HAPTIC_TICK_MS,
  triggerSelectionHaptic,
  triggerSubtleHapticTick,
} from "../utils/haptics";

const setMatchMedia = (reduced) => {
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: reduced && q.includes("reduce"),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
};

describe("home card change haptics", () => {
  let vibrate;
  beforeEach(() => {
    resetHapticsThrottleForTests();
    setMatchMedia(false);
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    delete navigator.vibrate;
  });

  it("vibrates 10ms with an explicit navigator", () => {
    const nav = { vibrate: vi.fn(() => true) };
    expect(triggerSelectionHaptic(nav, 1000)).toBe(true);
    expect(nav.vibrate).toHaveBeenCalledWith(SELECTION_HAPTIC_TICK_MS);
  });

  it("throttles rapid card changes", () => {
    const nav = { vibrate: vi.fn(() => true) };
    triggerSelectionHaptic(nav, 1000);
    expect(triggerSelectionHaptic(nav, 1000 + SELECTION_HAPTIC_COOLDOWN_MS - 1)).toBe(false);
    expect(nav.vibrate).toHaveBeenCalledTimes(1);
  });

  it("regression: a deck-arrow button tick does not swallow the card-change tick", () => {
    // IconButton fires a 1ms tick on click, then the card-change effect runs ~16ms later.
    triggerSubtleHapticTick();
    expect(triggerSelectionHaptic()).toBe(true);
    expect(vibrate.mock.calls).toEqual([[1], [SELECTION_HAPTIC_TICK_MS]]);
  });

  it("no-ops without throwing when vibrate is unsupported", () => {
    expect(() => triggerSelectionHaptic({}, 5000)).not.toThrow();
  });

  it("respects prefers-reduced-motion", () => {
    setMatchMedia(true);
    const nav = { vibrate: vi.fn(() => true) };
    expect(triggerSelectionHaptic(nav, 9000)).toBe(false);
    expect(nav.vibrate).not.toHaveBeenCalled();
  });

  it("ticks once per card change in the carousel, not on mount", () => {
    const props = { setHomeMode: vi.fn(), lang: "fr", onStartGame: vi.fn() };
    const { rerender } = render(<HomeScreenCategoryCarousel {...props} homeMode="countries" />);
    expect(vibrate).not.toHaveBeenCalled();
    rerender(<HomeScreenCategoryCarousel {...props} homeMode="capitals" />);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(SELECTION_HAPTIC_TICK_MS);
    console.log("[haptics-proof] vibrate calls:", JSON.stringify(vibrate.mock.calls));
  });
});
