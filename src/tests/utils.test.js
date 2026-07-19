import { describe, expect, it } from "vitest";

import {
  areLngLatPointsEqual,
  getCleanRingForRendering,
  getExteriorPolygonForRendering,
  getFeatureAdmin,
  getFlagEmoji,
  getGameStats,
  getLabelRenderRadius,
  getLngLatBounds,
  getLngLatDistance,
  getMobileRenderRadius,
  pointInBounds,
  pointInPolygon,
} from "../utils/utils";

describe("Geographical and Math Utilities", () => {
  describe("getFeatureAdmin", () => {
    it("should extract correct administrative codes or names", () => {
      expect(getFeatureAdmin({ properties: { code: "FR" } })).toBe("FR");
      expect(getFeatureAdmin({ properties: { ADMIN: "France" } })).toBe("France");
      expect(getFeatureAdmin({ properties: { name: "Paris" } })).toBe("Paris");
      expect(getFeatureAdmin({ properties: { NAME: "Nice" } })).toBe("Nice");
      expect(getFeatureAdmin({ properties: { ADMIN: "Somaliland" } })).toBe("Somalia");
      expect(getFeatureAdmin({})).toBeUndefined();
    });
  });

  describe("getFlagEmoji", () => {
    it("should return correct emoji flags for iso2 codes", () => {
      expect(getFlagEmoji("FR")).toBe("🇫🇷");
      expect(getFlagEmoji("US")).toBe("🇺🇸");
      expect(getFlagEmoji("ca")).toBe("🇨🇦");
      expect(getFlagEmoji("")).toBe("");
      expect(getFlagEmoji("F")).toBe("");
      expect(getFlagEmoji("FRA")).toBe("");
    });
  });

  describe("areLngLatPointsEqual", () => {
    it("should compare points correctly", () => {
      expect(areLngLatPointsEqual([2, 48], [2, 48])).toBe(true);
      expect(areLngLatPointsEqual([2, 48], [3, 48])).toBe(false);
      expect(areLngLatPointsEqual([2], [2])).toBe(false);
      expect(areLngLatPointsEqual(null, [2, 48])).toBe(false);
    });
  });

  describe("getCleanRingForRendering", () => {
    it("should return null for invalid/short rings", () => {
      expect(getCleanRingForRendering([])).toBeNull();
      expect(
        getCleanRingForRendering([
          [0, 0],
          [1, 1],
        ])
      ).toBeNull();
    });

    it("should clean up and close rings correctly", () => {
      const ring = [
        [0, 0],
        [1, 1],
        [2, 0],
        [0, 0], // already closed
      ];
      const clean = getCleanRingForRendering(ring);
      expect(clean).not.toBeNull();
      expect(clean.length).toBe(4);

      const unclosed = [
        [0, 0],
        [1, 1],
        [2, 0],
      ];
      const cleanUnclosed = getCleanRingForRendering(unclosed);
      expect(cleanUnclosed).not.toBeNull();
      expect(cleanUnclosed.length).toBe(4); // should auto-close
      expect(cleanUnclosed[3]).toEqual([0, 0]);
    });

    it("should filter duplicate contiguous points and invalid points", () => {
      const ring = [
        [0, 0],
        [0, 0], // duplicate
        [1, 1],
        ["invalid", 2], // invalid
        [2, 0],
        [0, 0],
      ];
      const clean = getCleanRingForRendering(ring);
      expect(clean.length).toBe(4);
      expect(clean[1]).toEqual([1, 1]);
    });
  });

  describe("getExteriorPolygonForRendering", () => {
    it("should extract exterior ring", () => {
      const polygon = [
        [
          [0, 0],
          [1, 1],
          [2, 0],
          [0, 0],
        ], // exterior
        [
          [0.5, 0.2],
          [0.8, 0.2],
          [0.5, 0.5],
          [0.5, 0.2],
        ], // interior (hole)
      ];
      const ext = getExteriorPolygonForRendering(polygon);
      expect(ext).not.toBeNull();
      expect(ext.length).toBe(1);
      expect(ext[0].length).toBe(4);
    });
  });

  describe("getLngLatBounds", () => {
    it("should return correct bounding box limits", () => {
      const polygons = [
        [
          [
            [0, 10],
            [5, 15],
            [10, 10],
            [0, 10],
          ],
        ],
      ];
      const bounds = getLngLatBounds(polygons);
      expect(bounds).toEqual({
        minLng: 0,
        maxLng: 10,
        minLat: 10,
        maxLat: 15,
      });
    });
  });

  describe("pointInBounds", () => {
    it("should boundary check correctly", () => {
      const bounds = { minLng: 0, maxLng: 10, minLat: 10, maxLat: 20 };
      expect(pointInBounds(5, 15, bounds)).toBe(true);
      expect(pointInBounds(-1, 15, bounds)).toBe(false);
      expect(pointInBounds(5, 9, bounds)).toBe(false);
    });
  });

  describe("pointInPolygon", () => {
    it("should test point-in-polygon correctly", () => {
      // Triangle: (0,0), (10,0), (0,10)
      const polygon = [
        [
          [0, 0],
          [10, 0],
          [0, 10],
          [0, 0],
        ],
      ];
      expect(pointInPolygon(1, 1, polygon)).toBe(true);
      expect(pointInPolygon(2, 2, polygon)).toBe(true);
      expect(pointInPolygon(8, 8, polygon)).toBe(false);
    });
  });

  describe("getLngLatDistance", () => {
    it("should compute distance between coordinate points, handling wrap-around", () => {
      expect(getLngLatDistance(0, 0, 0, 10)).toBe(10);
      expect(getLngLatDistance(170, 0, -170, 0)).toBe(20); // wrap-around: 10 + 10 = 20 degrees
    });
  });

  describe("Radius Helpers", () => {
    it("should compute correct mobile render radius", () => {
      expect(getMobileRenderRadius(2)).toBe(118);
      expect(getMobileRenderRadius(1.2)).toBe(96);
      expect(getMobileRenderRadius(0.8)).toBe(78);
      expect(getMobileRenderRadius(0.5)).toBe(64);
    });

    it("should compute correct label render radius", () => {
      expect(getLabelRenderRadius(2, true)).toBe(118 * 0.82);
      expect(getLabelRenderRadius(3, false)).toBe(38);
      expect(getLabelRenderRadius(1.2, false)).toBe(78);
      expect(getLabelRenderRadius(0.5, false)).toBe(96);
    });
  });

  describe("getGameStats", () => {
    it("should calculate correctly grouped statistics by continent/region", () => {
      const mockCountryDataMap = {
        FR: { name_fr: "France", name_en: "France", capital: "Paris", region: "Europe" },
        DE: { name_fr: "Allemagne", name_en: "Germany", capital: "Berlin", region: "Europe" },
        US: {
          name_fr: "États-Unis",
          name_en: "United States",
          capital: "Washington",
          region: "Americas",
        },
      };

      const foundList = ["FR"];
      const { stats, CONTINENT_ORDER } = getGameStats(foundList, mockCountryDataMap, "en");

      expect(CONTINENT_ORDER).toContain("Europe");
      expect(CONTINENT_ORDER).toContain("Americas");
      expect(stats["Europe"].total).toBe(2);
      expect(stats["Europe"].found).toBe(1);
      expect(stats["Americas"].total).toBe(1);
      expect(stats["Americas"].found).toBe(0);

      // Verify sorting: found countries first, then alphabetical by name
      const europeCountries = stats["Europe"].countries;
      expect(europeCountries[0].key).toBe("FR"); // found
      expect(europeCountries[1].key).toBe("DE"); // unfound
    });
  });
});
