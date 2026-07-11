import { describe, it, expect } from "vitest";
import { normalizeString } from "./utils";
import { getLevelAndProgress, getAvatarUnlockLevel, checkChallengesRealTime } from "./useUserProfile";
import { getProceduralDesign } from "./InvaderAvatar";

const updateScoreHistory = (currentHistory, newScore) => {
  const nextHistory = [...currentHistory, newScore].slice(-3);
  return nextHistory;
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
    });
  });

  describe("Input Security and Normalization", () => {
    it("should sanitize and normalize string inputs correctly", () => {
      expect(normalizeString("  Élément-Gêné  ")).toBe("element gene");
      expect(normalizeString("United States'")).toBe("united states");
      expect(normalizeString("")).toBe("");
    });
  });

  describe("XP and Level System", () => {
    it("should calculate correct level and progress from XP", () => {
      let progress = getLevelAndProgress(0);
      expect(progress.level).toBe(1);
      expect(progress.xpInLevel).toBe(0);
      expect(progress.percent).toBe(0);

      progress = getLevelAndProgress(150);
      expect(progress.level).toBe(1);
      expect(progress.xpInLevel).toBe(150);
      expect(progress.percent).toBe(75);

      progress = getLevelAndProgress(200);
      expect(progress.level).toBe(2);
      expect(progress.xpInLevel).toBe(0);

      progress = getLevelAndProgress(600);
      expect(progress.level).toBe(3);
      expect(progress.xpInLevel).toBe(0);
    });

    it("should return correct avatar unlock levels", () => {
      expect(getAvatarUnlockLevel("invader_1")).toBe(1);
      expect(getAvatarUnlockLevel("invader_4")).toBe(2);
      expect(getAvatarUnlockLevel("invader_12")).toBe(10);
    });
  });

  describe("Procedural Invader Emote Generator", () => {
    it("should generate a symmetric 11x8 design for any string ID", () => {
      const design = getProceduralDesign("ch_score_countries_10");
      expect(design).toHaveLength(8);
      
      design.forEach((row) => {
        expect(row).toHaveLength(11);
        // Verify horizontal symmetry: columns 0-4 must match columns 10-6 in reverse
        const leftHalf = row.slice(0, 5);
        const rightHalf = row.slice(6, 11);
        const rightReversed = rightHalf.split("").reverse().join("");
        expect(leftHalf).toBe(rightReversed);
      });
    });

    it("should generate different designs for different IDs", () => {
      const designA = getProceduralDesign("challenge_a");
      const designB = getProceduralDesign("challenge_b");
      expect(designA).not.toEqual(designB);
    });
  });

  describe("Real-time Challenge System", () => {
    const mockRecords = {
      countries: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      capitals: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      departments: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      rivers_mountains: { maxScore: 0, bestTime: null, gamesPlayed: 0 }
    };

    it("should unlock ch_gen_play_1 when playing the first game", () => {
      const sessionData = {
        mode: "countries",
        score: 1,
        timeSpent: 10,
        timeLeft: 50,
        accuracy: 1,
        isGameOver: true,
        perfect: false,
        continentsConquered: [],
        guessesThisGame: [],
        speedGuessCount3s: 0,
        speedGuessCount1s: 0,
        lightningCount: 0
      };

      const unlocked = checkChallengesRealTime([], mockRecords, sessionData);
      expect(unlocked).toContain("ch_gen_play_1");
    });

    it("should unlock ch_cont_europe when Europe is conquered", () => {
      const sessionData = {
        mode: "countries",
        score: 10,
        timeSpent: 30,
        timeLeft: 30,
        accuracy: 1,
        isGameOver: false,
        perfect: false,
        continentsConquered: ["Europe"],
        guessesThisGame: [],
        speedGuessCount3s: 0,
        speedGuessCount1s: 0,
        lightningCount: 0
      };

      const unlocked = checkChallengesRealTime([], mockRecords, sessionData);
      expect(unlocked).toContain("ch_cont_europe");
    });

    it("should unlock speed challenges like ch_speed_fast_guess on fast guesses", () => {
      const sessionData = {
        mode: "countries",
        score: 1,
        timeSpent: 2,
        timeLeft: 58,
        accuracy: 1,
        isGameOver: false,
        perfect: false,
        continentsConquered: [],
        guessesThisGame: [],
        lastGuessDuration: 2.5,
        speedGuessCount3s: 1,
        speedGuessCount1s: 0,
        lightningCount: 0
      };

      const unlocked = checkChallengesRealTime([], mockRecords, sessionData);
      expect(unlocked).toContain("ch_speed_fast_guess");
    });

    it("should unlock ch_special_islands when finding 5 islands in a game", () => {
      const sessionData = {
        mode: "countries",
        score: 5,
        timeSpent: 15,
        timeLeft: 45,
        accuracy: 1,
        isGameOver: false,
        perfect: false,
        continentsConquered: [],
        guessesThisGame: ["Iceland", "Madagascar", "New Zealand", "Japan", "Cuba"],
        lastGuessDuration: 3,
        speedGuessCount3s: 0,
        speedGuessCount1s: 0,
        lightningCount: 0
      };

      const unlocked = checkChallengesRealTime([], mockRecords, sessionData);
      expect(unlocked).toContain("ch_special_islands");
    });
  });
});
