import { describe, expect, it } from "vitest";
import { getThemeColors } from "../config/designSystem";
import {
  FOUND_HIGHLIGHT,
  FOUND_SURFACE_GREEN,
  mutedFoundGreen,
  resolveCountryCapColor,
  resolveFoundCountryColor,
  resolveFoundCountryStroke,
  resolvePolygonShaderMode,
  resolveRegionalLandColor,
  shouldUseRegionalUnfoundLand,
} from "../utils/polygonColorResolver";

const lerpColor = (a, _b, _amount) => a;
const UI_COLORS = getThemeColors("satellite", "dark");

describe("polygonColorResolver", () => {
  const baseCtx = {
    admin: "FRA",
    region: "Europe",
    mode: "countries",
    foundSet: new Set(),
    selectedCountry: null,
    isError: false,
    isSuccess: false,
    isEndScreen: false,
    isPerfectScore: false,
    isLearn: false,
    UI_COLORS,
    lerpColor,
    mapBase: UI_COLORS.mapBase,
  };

  it("returns dark base for unfound play countries", () => {
    expect(resolveCountryCapColor(baseCtx)).toBe(UI_COLORS.mapBase);
  });

  it("returns mapBase for unfound learn countries in resolver", () => {
    expect(resolveCountryCapColor({ ...baseCtx, mode: "learn", isLearn: true })).toBe(
      UI_COLORS.mapBase,
    );
  });

  it("uses regional shades for unfound non-selected land", () => {
    expect(
      shouldUseRegionalUnfoundLand({
        isEndScreen: false,
        isFound: false,
        isSelected: false,
      }),
    ).toBe(true);
    expect(
      resolveRegionalLandColor("Europe", {
        globeTheme: "satellite",
        regionColorsLabels: { Europe: UI_COLORS.accent },
        regionColorsAttenuated: { Europe: UI_COLORS.mapBorder },
        fallbackAccent: UI_COLORS.accent,
        fallbackRegionColor: UI_COLORS.mapBase,
      }),
    ).toBe(UI_COLORS.accent);
  });

  it("returns green for learn selection", () => {
    expect(
      resolveCountryCapColor({
        ...baseCtx,
        mode: "learn",
        isLearn: true,
        selectedCountry: "FRA",
      }),
    ).toBe(FOUND_HIGHLIGHT);
  });

  it("uses darker green stroke when found country is selected", () => {
    const blend = (a, b, amount) => {
      const parse = (hex) => {
        const h = hex.replace("#", "");
        return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      };
      const [r1, g1, b1] = parse(a);
      const [r2, g2, b2] = parse(b);
      const mix = (x, y) => Math.round(x + (y - x) * amount);
      const toHex = (r, g, b) =>
        `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      return toHex(mix(r1, r2), mix(g1, g2), mix(b1, b2));
    };
    const selected = resolveFoundCountryStroke({
      isLight: false,
      isSelected: true,
      UI_COLORS,
      lerpColor: blend,
    });
    const normal = resolveFoundCountryStroke({
      isLight: false,
      isSelected: false,
      UI_COLORS,
      lerpColor: blend,
    });
    expect(selected).not.toBe(FOUND_SURFACE_GREEN);
    expect(selected).not.toBe(UI_COLORS.accent);
    expect(selected).not.toBe(normal);
  });

  it("returns contrasting stroke darker than found fill", () => {
    const blend = (a, b, amount) => {
      const parse = (hex) => {
        const h = hex.replace("#", "");
        return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      };
      const [r1, g1, b1] = parse(a);
      const [r2, g2, b2] = parse(b);
      const mix = (x, y) => Math.round(x + (y - x) * amount);
      const toHex = (r, g, b) =>
        `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      return toHex(mix(r1, r2), mix(g1, g2), mix(b1, b2));
    };
    const stroke = resolveFoundCountryStroke({
      isLight: false,
      UI_COLORS,
      lerpColor: blend,
    });
    expect(stroke).not.toBe(FOUND_SURFACE_GREEN);
    expect(stroke).not.toBe(FOUND_HIGHLIGHT);
  });

  it("returns DS found green for found countries", () => {
    expect(
      resolveCountryCapColor({
        ...baseCtx,
        foundSet: new Set(["FRA"]),
      }),
    ).toBe(FOUND_SURFACE_GREEN);
    expect(resolveFoundCountryColor()).toBe(FOUND_SURFACE_GREEN);
    expect(mutedFoundGreen(UI_COLORS.mapBase, lerpColor)).toBe(FOUND_SURFACE_GREEN);
  });

  it("enables glitch shader only on unfound selection in play mode", () => {
    expect(
      resolvePolygonShaderMode({
        admin: "FRA",
        kind: "cap",
        mode: "countries",
        foundSet: new Set(),
        isIsolated: false,
        isPrevTransitioning: false,
        isEndScreen: false,
        isHomeScreen: false,
      }),
    ).toEqual({ useShader: false, isSelectionHighlight: false });

    expect(
      resolvePolygonShaderMode({
        admin: "FRA",
        kind: "cap",
        mode: "countries",
        foundSet: new Set(),
        isIsolated: true,
        isPrevTransitioning: false,
        isEndScreen: false,
        isHomeScreen: false,
      }),
    ).toEqual({ useShader: true, isSelectionHighlight: false });

    expect(
      resolvePolygonShaderMode({
        admin: "FRA",
        kind: "cap",
        mode: "countries",
        foundSet: new Set(["FRA"]),
        isIsolated: true,
        isPrevTransitioning: false,
        isEndScreen: false,
        isHomeScreen: false,
        isSuccess: true,
      }).useShader,
    ).toBe(true);

    expect(
      resolvePolygonShaderMode({
        admin: "FRA",
        kind: "cap",
        mode: "countries",
        foundSet: new Set(["FRA"]),
        isIsolated: true,
        isPrevTransitioning: false,
        isEndScreen: false,
        isHomeScreen: false,
      }).useShader,
    ).toBe(false);

    expect(
      resolvePolygonShaderMode({
        admin: "FRA",
        kind: "cap",
        mode: "countries",
        foundSet: new Set(["FRA"]),
        isIsolated: false,
        isPrevTransitioning: true,
        isEndScreen: false,
        isHomeScreen: false,
      }).useShader,
    ).toBe(false);
  });

  it("enables glitch shader on homepage selection", () => {
    expect(
      resolvePolygonShaderMode({
        admin: "FRA",
        kind: "cap",
        mode: "countries",
        foundSet: new Set(),
        isIsolated: true,
        isPrevTransitioning: false,
        isEndScreen: false,
        isHomeScreen: true,
      }),
    ).toEqual({ useShader: true, isSelectionHighlight: false });
  });
});