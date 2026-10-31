import { describe, expect, it } from "vitest";

import { ACCENT_PRESETS } from "../config/accentPresets";
import {
  getThemeColors,
  getThemeRegionColor,
  isValidGlobeTheme,
  migrateGlobeTheme,
} from "../config/designSystem";
import { buildMonochromePalette } from "../config/monochromeGlobe";

const lum = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

describe("Monochrome globe", () => {
  it("migrates the old blackout setting", () => {
    expect(migrateGlobeTheme("blackout")).toBe("monochrome");
    expect(migrateGlobeTheme("satellite")).toBe("satellite");
    expect(isValidGlobeTheme("monochrome")).toBe(true);
    expect(isValidGlobeTheme("blackout")).toBe(false);
  });

  it("derives a palette per accent with land lighter than ocean", () => {
    Object.keys(ACCENT_PRESETS).forEach((id) => {
      const p = buildMonochromePalette(id);
      expect(p.glitchTintA).toBe(ACCENT_PRESETS[id].accent);
      Object.values(p.land).forEach((shade) => expect(lum(shade)).toBeGreaterThan(lum(p.ocean)));
    });
  });

  it("keeps land contrast comparable across accents", () => {
    const europe = Object.keys(ACCENT_PRESETS).map((id) =>
      lum(buildMonochromePalette(id).land.Europe)
    );
    expect(Math.max(...europe) - Math.min(...europe)).toBeLessThan(0.12);
  });

  it("feeds the accent into the render key", () => {
    const teal = getThemeColors("monochrome@teal", "dark");
    const bone = getThemeColors("monochrome@bone", "dark");
    expect(teal.glitchTintA).toBe(ACCENT_PRESETS.teal.accent);
    expect(teal.globeMaterialColor).not.toBe(bone.globeMaterialColor);
    expect(getThemeRegionColor("monochrome@teal", "dark", "Asia")).toBe(
      buildMonochromePalette("teal").land.Asia
    );
  });
});
