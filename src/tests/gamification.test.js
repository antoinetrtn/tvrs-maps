import { describe, expect, it } from "vitest";

import { getProceduralDesign } from "../components/InvaderAvatar";
import { checkChallengesRealTime } from "../utils/achievementEvaluator";
import {
  evaluateGameRewardsAndBadges,
  getAvatarUnlockLevel,
  getLevelAndProgress,
} from "../utils/gamification";
import { normalizeString } from "../utils/utils";

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

  describe("Game Reward Evaluation (evaluateGameRewardsAndBadges)", () => {
    const baseRecords = {
      countries: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      capitals: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      departments: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      rivers_mountains: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      us_states: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
    };

    const baseArgs = {
      userProfile: { xp: 0, level: 1, unlockedBadges: [] },
      localRecords: baseRecords,
      gameMode: "countries",
      finalScore: 10,
      timeSpent: 60,
      totalPossible: 20,
      gameDuration: 120,
      continentsConquered: [],
    };

    it("should compose XP from found, completion, conquest and perfect parts", () => {
      const result = evaluateGameRewardsAndBadges({
        ...baseArgs,
        finalScore: 10,
        totalPossible: 10,
        continentsConquered: ["Europe"],
      });

      expect(result.xpBreakdown.found).toBe(100); // 10 finds x 10 XP
      expect(result.xpBreakdown.completion).toBe(50);
      expect(result.xpBreakdown.conquest).toBe(100); // 1 continent x 100 XP
      expect(result.xpBreakdown.perfect).toBe(250); // finalScore === totalPossible
      expect(result.gainedXp).toBeGreaterThanOrEqual(500);
    });

    it("should not grant perfect XP on an incomplete game", () => {
      const result = evaluateGameRewardsAndBadges(baseArgs);
      expect(result.xpBreakdown.perfect).toBe(0);
      expect(result.xpBreakdown.conquest).toBe(0);
    });

    it("should unlock the level badge when gained XP crosses a level boundary", () => {
      // 190 XP + at least 150 gained XP crosses the level 2 boundary (200 XP)
      const result = evaluateGameRewardsAndBadges({
        ...baseArgs,
        userProfile: { xp: 190, level: 1, unlockedBadges: [] },
      });

      expect(result.totalNewlyUnlocked).toContain("ch_gen_lvl_2");
      expect(result.updatedBadges).toContain("ch_gen_lvl_2");
    });

    it("should not re-award an already unlocked level badge", () => {
      const result = evaluateGameRewardsAndBadges({
        ...baseArgs,
        userProfile: { xp: 190, level: 1, unlockedBadges: ["ch_gen_lvl_2"] },
      });

      expect(result.totalNewlyUnlocked).not.toContain("ch_gen_lvl_2");
    });

    it("should record continent conquest markers with completion count", () => {
      const result = evaluateGameRewardsAndBadges({
        ...baseArgs,
        continentsConquered: ["Europe"],
      });
      expect(result.updatedBadges).toContain("conquered_Europe_1");

      const again = evaluateGameRewardsAndBadges({
        ...baseArgs,
        userProfile: { xp: 0, level: 1, unlockedBadges: ["conquered_Europe_1"] },
        continentsConquered: ["Europe"],
      });
      expect(again.updatedBadges).toContain("conquered_Europe_2");
    });
  });

  describe("Real-time Challenge System", () => {
    const mockRecords = {
      countries: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      capitals: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      departments: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      rivers_mountains: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
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
        lightningCount: 0,
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
        lightningCount: 0,
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
        lightningCount: 0,
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
        lightningCount: 0,
      };

      const unlocked = checkChallengesRealTime([], mockRecords, sessionData);
      expect(unlocked).toContain("ch_special_islands");
    });
  });
});
