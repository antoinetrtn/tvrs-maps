import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ACCENT } from "../config/accentPresets";
import {
  getThemeColors,
  getThemeCssVariables,
  getThemeRegionColor,
  getThemeRegionColorLabel,
} from "../config/designSystem";
import { RETIRED_STORAGE_KEYS } from "../config/gameConstants";
import { GLOBE_PALETTE } from "../config/globePalette";
import { useAppTheme } from "../hooks/useAppTheme";

const luminance = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
};

describe("unified nocturnal theme", () => {
  it("bone accent meets AA contrast", () => {
    const { bg, bgElevated } = getThemeColors("dark");
    for (const surface of [bg, bgElevated]) {
      expect(contrast(ACCENT.accent, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ACCENT.hover, surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(ACCENT.contrast, ACCENT.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("drives CSS variables from the bone accent", () => {
    const vars = getThemeCssVariables("dark");
    expect(vars["--accent"]).toBe(ACCENT.accent);
    expect(vars["--accent-hover"]).toBe(ACCENT.hover);
    expect(vars["--accent-contrast"]).toBe(ACCENT.contrast);
  });

  it("pins globe colours to the globe palette", () => {
    const colors = getThemeColors("dark");
    expect(colors.accent).toBe(ACCENT.accent);
    expect(colors.globeMaterialColor).toBe(GLOBE_PALETTE.ocean);
    expect(colors.glitchTintA).toBe(GLOBE_PALETTE.glitchTintA);
    expect(colors.mapBorder).toBe(GLOBE_PALETTE.border);
    expect(colors.oceanRimColor).toBe(GLOBE_PALETTE.rim);
  });

  it("keeps land lighter than the ocean in every region", () => {
    const ocean = luminance(GLOBE_PALETTE.ocean);
    ["Europe", "Americas", "Africa", "Oceania", "Asia", "Antarctic"].forEach((r) => {
      expect(luminance(getThemeRegionColor(r))).toBeGreaterThan(ocean);
      expect(getThemeRegionColorLabel(r)).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it("is always dark and purges retired theme keys once", () => {
    RETIRED_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, "x"));
    localStorage.setItem("tvrs-globe-renderer", "webgl");
    const { result } = renderHook(() => useAppTheme(1200));
    act(() => {});
    expect(result.current.theme).toBe("dark");
    expect(result.current.appStyle["--accent"]).toBe(ACCENT.accent);
    RETIRED_STORAGE_KEYS.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
    expect(localStorage.getItem("tvrs-globe-renderer")).toBe("webgl");
    localStorage.clear();
  });
});
