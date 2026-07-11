import { describe, it, expect } from "vitest";
import { normalizeString } from "./utils";
import { getLevelAndProgress, getAvatarUnlockLevel, checkAndUnlockBadges } from "./useUserProfile";

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

  describe("XP and Level System", () => {
    it("should calculate correct level and progress from XP", () => {
      // Level 1: 0 to 199 XP
      let progress = getLevelAndProgress(0);
      expect(progress.level).toBe(1);
      expect(progress.xpInLevel).toBe(0);
      expect(progress.percent).toBe(0);

      progress = getLevelAndProgress(150);
      expect(progress.level).toBe(1);
      expect(progress.xpInLevel).toBe(150);
      expect(progress.percent).toBe(75);

      // Level 2: 200 to 599 XP (requires 400 XP)
      progress = getLevelAndProgress(200);
      expect(progress.level).toBe(2);
      expect(progress.xpInLevel).toBe(0);
      expect(progress.percent).toBe(0);

      progress = getLevelAndProgress(400);
      expect(progress.level).toBe(2);
      expect(progress.xpInLevel).toBe(200);
      expect(progress.percent).toBe(50);

      // Level 3: 600 to 1199 XP (requires 600 XP)
      progress = getLevelAndProgress(600);
      expect(progress.level).toBe(3);
      expect(progress.xpInLevel).toBe(0);
    });

    it("should return correct avatar unlock levels", () => {
      expect(getAvatarUnlockLevel("invader_1")).toBe(1);
      expect(getAvatarUnlockLevel("invader_2")).toBe(1);
      expect(getAvatarUnlockLevel("invader_3")).toBe(1);
      expect(getAvatarUnlockLevel("invader_4")).toBe(2);
      expect(getAvatarUnlockLevel("invader_5")).toBe(3);
      expect(getAvatarUnlockLevel("invader_12")).toBe(10);
      expect(getAvatarUnlockLevel("invalid_id")).toBe(1);
    });
  });

  describe("Badge Unlock System", () => {
    const mockRecords = {
      countries: { gamesPlayed: 0 },
      capitals: { gamesPlayed: 0 },
      departments: { gamesPlayed: 0 },
      rivers_mountains: { gamesPlayed: 0 }
    };

    it("should unlock 'first_step' if score is at least 1", () => {
      const unlocked = checkAndUnlockBadges([], "countries", 1, 10, 10, 60, mockRecords, []);
      expect(unlocked).toContain("first_step");
    });

    it("should unlock 'centurion' if score is 100 or more", () => {
      const unlocked = checkAndUnlockBadges([], "countries", 100, 10, 150, 600, mockRecords, []);
      expect(unlocked).toContain("centurion");
    });

    it("should unlock 'perfectionist' on 100% correct answers", () => {
      const unlocked = checkAndUnlockBadges([], "countries", 10, 100, 10, 600, mockRecords, []);
      expect(unlocked).toContain("perfectionist");
    });

    it("should unlock 'speed_runner' if completed in less than half time", () => {
      const unlocked = checkAndUnlockBadges([], "countries", 5, 29, 10, 60, mockRecords, []);
      expect(unlocked).toContain("speed_runner");
    });

    it("should unlock 'relief_master' on score >= 20 in rivers_mountains mode", () => {
      const unlocked = checkAndUnlockBadges([], "rivers_mountains", 20, 100, 30, 600, mockRecords, []);
      expect(unlocked).toContain("relief_master");
    });

    it("should unlock 'loyal_player' after 10 cumulative games", () => {
      const tenGamesRecords = {
        countries: { gamesPlayed: 9 },
        capitals: { gamesPlayed: 0 },
        departments: { gamesPlayed: 0 },
        rivers_mountains: { gamesPlayed: 0 }
      };
      const unlocked = checkAndUnlockBadges([], "countries", 1, 10, 10, 60, tenGamesRecords, []);
      expect(unlocked).toContain("loyal_player");
    });

    it("should unlock 'explorer' if all 4 modes have been played", () => {
      const explorerRecords = {
        countries: { gamesPlayed: 1 },
        capitals: { gamesPlayed: 1 },
        departments: { gamesPlayed: 1 },
        rivers_mountains: { gamesPlayed: 0 } // current game will play this
      };
      const unlocked = checkAndUnlockBadges([], "rivers_mountains", 1, 10, 10, 60, explorerRecords, []);
      expect(unlocked).toContain("explorer");
    });
  });
});
