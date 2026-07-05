import { describe, it, expect } from "vitest";
import { normalizeString } from "./utils";

// Mock implementation of score history logic to test its correctness
const updateScoreHistory = (currentHistory, newScore) => {
  const nextHistory = [...currentHistory, newScore].slice(-3);
  return nextHistory;
};

// Mock implementation of continent completion detection logic
const checkRegionCompletion = (activeDataMap, foundList, guessedKey) => {
  const newFound = [...foundList, guessedKey];
  const guessItem = activeDataMap[guessedKey];
  const region = guessItem?.region;
  
  if (!region || region === "Unknown") {
    return false;
  }
  
  const allInRegion = Object.keys(activeDataMap).filter(
    (k) => activeDataMap[k]?.region === region
  );
  
  if (allInRegion.length === 0) return false;
  
  const wasCompletedBefore = foundList.filter(
    (k) => activeDataMap[k]?.region === region
  ).length === allInRegion.length;
  
  const isCompletedNow = newFound.filter(
    (k) => activeDataMap[k]?.region === region
  ).length === allInRegion.length;
  
  return !wasCompletedBefore && isCompletedNow;
};

describe("Gamification System Logic", () => {
  describe("Score History Limit", () => {
    it("should retain only the last 3 scores chronologically", () => {
      let history = [];
      
      history = updateScoreHistory(history, 10);
      expect(history).toEqual([10]);
      
      history = updateScoreHistory(history, 20);
      expect(history).toEqual([10, 20]);
      
      history = updateScoreHistory(history, 30);
      expect(history).toEqual([10, 20, 30]);
      
      history = updateScoreHistory(history, 40);
      expect(history).toEqual([20, 30, 40]);
      
      history = updateScoreHistory(history, 5);
      expect(history).toEqual([30, 40, 5]);
    });
  });

  describe("Continent Completion Check", () => {
    const mockDataMap = {
      France: { region: "Europe" },
      Germany: { region: "Europe" },
      Kenya: { region: "Africa" },
      Egypt: { region: "Africa" }
    };

    it("should return false if the region was already completed", () => {
      const foundList = ["France", "Germany"];
      const isCompleted = checkRegionCompletion(mockDataMap, foundList, "Germany");
      expect(isCompleted).toBe(false);
    });

    it("should return true when the last country of a continent is found", () => {
      const foundList = ["France"];
      const isCompleted = checkRegionCompletion(mockDataMap, foundList, "Germany");
      expect(isCompleted).toBe(true);
    });

    it("should return false if there are still unfound countries in the continent", () => {
      const foundList = [];
      const isCompleted = checkRegionCompletion(mockDataMap, foundList, "France");
      expect(isCompleted).toBe(false);
    });

    it("should return false if the guessed country does not exist or has Unknown region", () => {
      const foundList = [];
      const isCompleted = checkRegionCompletion(mockDataMap, foundList, "Atlantis");
      expect(isCompleted).toBe(false);
    });
  });

  describe("Input Security and Normalization", () => {
    it("should sanitize and normalize string inputs correctly", () => {
      expect(normalizeString("  Élément-Gêné  ")).toBe("element gene");
      expect(normalizeString("United States'")).toBe("united states");
      expect(normalizeString("")).toBe("");
      expect(normalizeString(null)).toBe("");
    });
  });
});
