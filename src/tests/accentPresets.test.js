import { afterEach, describe, expect, it } from "vitest";

import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  getAccentOverrides,
  isValidAccent,
  persistAccent,
  readStoredAccent,
  resolveAccentId,
  setActiveAccent,
} from "../config/accentPresets";
import { getThemeColors, getThemeCssVariables } from "../config/designSystem";

const KEY = "tvrs-accent";

const luminance = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
};

afterEach(() => {
  setActiveAccent(DEFAULT_ACCENT);
  localStorage.clear();
});

describe("accent presets", () => {
  it("offers only bone (default) and teal", () => {
    const ids = Object.keys(ACCENT_PRESETS);
    expect(ids.sort()).toEqual(["bone", "teal"]);
    expect(DEFAULT_ACCENT).not.toBe("teal");
    expect(isValidAccent(DEFAULT_ACCENT)).toBe(true);
  });

  it("defaults to bone with label 'Os (sobre)'", () => {
    expect(DEFAULT_ACCENT).toBe("bone");
    expect(ACCENT_PRESETS[DEFAULT_ACCENT].label.fr).toBe("Os (sobre)");
  });

  it.each(Object.entries(ACCENT_PRESETS))("%s meets AA contrast", (_id, p) => {
    const { bg: ink, bgElevated } = getThemeColors("monochrome", "dark");
    for (const bg of [ink, bgElevated]) {
      expect(contrast(p.accent, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.hover, bg)).toBeGreaterThanOrEqual(4.5);
    }
    // Label on the primary button (accent background)
    expect(contrast(p.contrast, p.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.contrast, p.hover)).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to the default for unknown ids", () => {
    expect(resolveAccentId("nope")).toBe(DEFAULT_ACCENT);
    expect(resolveAccentId(null)).toBe(DEFAULT_ACCENT);
    expect(resolveAccentId("cyan")).toBe(DEFAULT_ACCENT);
    expect(resolveAccentId("teal")).toBe("teal");
  });
});

describe("accent persistence", () => {
  it("returns bone when nothing is stored", () => {
    expect(readStoredAccent(localStorage, KEY)).toBe("bone");
  });

  it.each(["magenta", "cyan", "acid", "signal"])(
    "migrates the retired %s preset to bone and rewrites storage",
    (retired) => {
      localStorage.setItem(KEY, retired);
      expect(readStoredAccent(localStorage, KEY)).toBe("bone");
      expect(localStorage.getItem(KEY)).toBe("bone");
    }
  );

  it("persists and reads back a valid accent", () => {
    expect(persistAccent(localStorage, KEY, "teal")).toBe("teal");
    expect(localStorage.getItem(KEY)).toBe("teal");
    expect(readStoredAccent(localStorage, KEY)).toBe("teal");
  });

  it("ignores corrupted stored values", () => {
    localStorage.setItem(KEY, "<script>");
    expect(readStoredAccent(localStorage, KEY)).toBe(DEFAULT_ACCENT);
  });

  it("survives a throwing storage", () => {
    const broken = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
    };
    expect(readStoredAccent(broken, KEY)).toBe(DEFAULT_ACCENT);
    expect(persistAccent(broken, KEY, "teal")).toBe("teal");
  });
});

describe("accent tokens", () => {
  it("drives CSS variables (button, focus, stamps, xp)", () => {
    setActiveAccent("teal");
    const vars = getThemeCssVariables("dark", "monochrome");
    expect(vars["--accent"]).toBe(ACCENT_PRESETS.teal.accent);
    expect(vars["--accent-hover"]).toBe(ACCENT_PRESETS.teal.hover);
    expect(vars["--accent-contrast"]).toBe(ACCENT_PRESETS.teal.contrast);
    expect(vars["--xp-yellow-inner"]).toBe(ACCENT_PRESETS.teal.accent);
  });

  it("drives globe colours (selection ring, grid)", () => {
    setActiveAccent("teal");
    const colors = getThemeColors("monochrome", "dark");
    expect(colors.selectionRingColor).toBe(ACCENT_PRESETS.teal.accent);
    expect(colors.graticule).toBe(ACCENT_PRESETS.teal.grid);
    expect(colors.gridDot).toContain(ACCENT_PRESETS.teal.rgb);
  });

  it("overrides contain no gold/yellow", () => {
    const o = getAccentOverrides("teal");
    expect(o.gold).toBe(ACCENT_PRESETS.teal.accent);
  });

  it("resolves monochrome@bone accent to bone preset accent", () => {
    const colors = getThemeColors("monochrome@bone", "dark");
    expect(colors.accent).toBe(ACCENT_PRESETS.bone.accent);
  });
});
