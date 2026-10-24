import { describe, expect, it } from "vitest";

import { getKeyboardShift } from "../globe/hooks/useGlobeCamera";

describe("getKeyboardShift", () => {
  const base = { isKeyboardMode: true, isHomeScreen: false, canvasHeight: 915 };

  it("moves the globe up to the centre of the visible viewport", () => {
    // Keyboard covers the bottom 400px: visible 0..515, centre 257.5 vs canvas 457.5.
    expect(getKeyboardShift({ ...base, viewport: { width: 412, height: 515, top: 0 } })).toBe(-200);
  });

  it("accounts for a scrolled visual viewport", () => {
    expect(getKeyboardShift({ ...base, viewport: { width: 412, height: 515, top: 100 } })).toBe(
      -100
    );
  });

  it("is a no-op without keyboard, on home or on desktop", () => {
    const viewport = { width: 412, height: 515, top: 0 };
    expect(getKeyboardShift({ ...base, viewport, isKeyboardMode: false })).toBe(0);
    expect(getKeyboardShift({ ...base, viewport, isHomeScreen: true })).toBe(0);
    expect(getKeyboardShift({ ...base, viewport: { width: 1200, height: 515, top: 0 } })).toBe(0);
  });
});
