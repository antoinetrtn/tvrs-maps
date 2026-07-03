import { describe, it, expect } from "vitest";
import {
  isPlayMode,
  shouldScrambleLabel,
  getPolygonAltitudeFor,
  getRegionAbbr,
  POLYGON_ALTITUDE,
} from "./gameConfig";

describe("Game Configuration Utilities", () => {
  describe("isPlayMode", () => {
    it("should return true for active quiz modes", () => {
      expect(isPlayMode("countries")).toBe(true);
      expect(isPlayMode("capitals")).toBe(true);
      expect(isPlayMode("departments")).toBe(true);
      expect(isPlayMode("rivers_mountains")).toBe(true);
    });

    it("should return false for home screen, end screen, learn mode, or unknown modes", () => {
      expect(isPlayMode("learn")).toBe(false);
      expect(isPlayMode("countries", { isHomeScreen: true })).toBe(false);
      expect(isPlayMode("countries", { isEndScreen: true })).toBe(false);
      expect(isPlayMode("unknown_mode")).toBe(false);
    });
  });

  describe("shouldScrambleLabel", () => {
    it("should return false in learn mode", () => {
      expect(shouldScrambleLabel("countries", { isLearn: true })).toBe(false);
    });

    it("should return isSelected on home screen", () => {
      expect(shouldScrambleLabel("countries", { isHomeScreen: true, isSelected: true })).toBe(true);
      expect(shouldScrambleLabel("countries", { isHomeScreen: true, isSelected: false })).toBe(false);
    });

    it("should return false if not in play mode", () => {
      expect(shouldScrambleLabel("learn", { isFound: false })).toBe(false);
    });

    it("should return true if unfound in play mode, and false if found", () => {
      expect(shouldScrambleLabel("countries", { isFound: false })).toBe(true);
      expect(shouldScrambleLabel("countries", { isFound: true })).toBe(false);
    });
  });

  describe("getPolygonAltitudeFor", () => {
    it("should return ghost country altitude if in department mode and ghost country", () => {
      expect(getPolygonAltitudeFor({ isDepartmentMode: true, isGhostCountry: true })).toBe(POLYGON_ALTITUDE.ghostCountry);
    });

    it("should return selected department altitude if in department mode and selected", () => {
      expect(getPolygonAltitudeFor({ isDepartmentMode: true, isSelected: true })).toBe(POLYGON_ALTITUDE.departmentSelected);
    });

    it("should return selected country altitude if selected and not department mode", () => {
      expect(getPolygonAltitudeFor({ isDepartmentMode: false, isSelected: true })).toBe(POLYGON_ALTITUDE.selected);
    });

    it("should return base altitude otherwise", () => {
      expect(getPolygonAltitudeFor({ isDepartmentMode: false, isSelected: false })).toBe(POLYGON_ALTITUDE.base);
      expect(getPolygonAltitudeFor({ isDepartmentMode: true, isSelected: false, isGhostCountry: false })).toBe(POLYGON_ALTITUDE.base);
    });
  });

  describe("getRegionAbbr", () => {
    it("should return customized region abbreviations", () => {
      expect(getRegionAbbr("Americas")).toBe("AM");
      expect(getRegionAbbr("Antarctic")).toBe("AN");
    });

    it("should fallback to the first two uppercase letters of the region name", () => {
      expect(getRegionAbbr("Europe")).toBe("EU");
      expect(getRegionAbbr("Asia")).toBe("AS");
      expect(getRegionAbbr("France")).toBe("FR");
      expect(getRegionAbbr("Unknown")).toBe("UN");
    });

    it("should handle empty or null regions gracefully", () => {
      expect(getRegionAbbr("")).toBe("");
      expect(getRegionAbbr(null)).toBe("");
    });
  });
});
