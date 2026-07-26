import { checkChallengesRealTime } from "./achievementEvaluator";

/**
 * Pure gamification helpers (no React, no side effects).
 * Extracted so they can be reliably imported everywhere without bundling issues
 * tied to the useUserProfile hook module.
 */

export function getLevelAndProgress(totalXp = 0) {
  let level = 1;
  let tempXp = totalXp;
  while (true) {
    const needed = level * 200;
    if (tempXp >= needed) {
      tempXp -= needed;
      level++;
    } else {
      break;
    }
  }
  return {
    level,
    xpInLevel: tempXp,
    xpNeededForNext: level * 200,
    percent: Math.min(100, Math.floor((tempXp / (level * 200)) * 100)),
  };
}

export function getAvatarUnlockLevel(avatarId) {
  const match = avatarId.match(/^invader_(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num <= 3) return 1;
    return num - 2; // invader_4 -> lvl 2, etc.
  }
  return 1;
}

export function evaluateGameRewardsAndBadges({
  userProfile,
  localRecords,
  gameMode,
  finalScore,
  timeSpent,
  totalPossible,
  gameDuration,
  continentsConquered,
}) {
  const oldXp = userProfile.xp || 0;
  const foundXp = finalScore * 10;
  const completionXp = 50;
  const conquestXp = (Array.isArray(continentsConquered) ? continentsConquered.length : 0) * 100;
  const perfectXp = finalScore > 0 && finalScore === totalPossible ? 250 : 0;
  let gainedXp = foundXp + completionXp + conquestXp + perfectXp;

  const intermediateXp = oldXp + gainedXp;
  const { level: intermediateLevel } = getLevelAndProgress(intermediateXp);

  const currentBadges = userProfile.unlockedBadges || [];
  const levelBadges = [];
  for (let lvl = 2; lvl <= intermediateLevel; lvl++) {
    if ([2, 5, 10, 15, 20].includes(lvl)) {
      const chId = `ch_gen_lvl_${lvl}`;
      if (!currentBadges.includes(chId)) {
        levelBadges.push(chId);
      }
    }
  }

  const continentMarkers = [];
  if (Array.isArray(continentsConquered) && continentsConquered.length > 0) {
    continentsConquered.forEach((region) => {
      const prevCompletions = currentBadges.filter((b) =>
        b.startsWith(`conquered_${region}_`)
      ).length;
      if (prevCompletions < 5) {
        continentMarkers.push(`conquered_${region}_${prevCompletions + 1}`);
      }
    });
  }

  const hour = new Date().getHours();
  const sessionData = {
    mode: gameMode,
    score: finalScore,
    timeSpent,
    timeLeft: gameDuration - timeSpent,
    accuracy: totalPossible > 0 ? finalScore / totalPossible : 1,
    isGameOver: true,
    perfect: finalScore > 0 && finalScore === totalPossible,
    continentsConquered,
    consecutiveCorrect: finalScore,
    lastGuessDuration: 0,
    guessesThisGame: [],
    speedGuessCount3s: 0,
    speedGuessCount1s: 0,
    lightningCount: 0,
    gameDuration,
    isNight: hour >= 22 || hour < 4,
    isLunch: hour >= 12 && hour < 14,
  };

  const baseBadgesPlusMarkers = [...currentBadges, ...levelBadges, ...continentMarkers];
  const newlyUnlocked = checkChallengesRealTime(baseBadgesPlusMarkers, localRecords, sessionData);

  const totalNewlyUnlocked = [...levelBadges, ...newlyUnlocked];
  const achievementXp = totalNewlyUnlocked.length * 100;
  gainedXp += achievementXp;

  const newXp = oldXp + gainedXp;
  const { level: newLevel } = getLevelAndProgress(newXp);
  const updatedBadges = [...baseBadgesPlusMarkers, ...newlyUnlocked];

  for (let lvl = intermediateLevel + 1; lvl <= newLevel; lvl++) {
    if ([2, 5, 10, 15, 20].includes(lvl)) {
      const chId = `ch_gen_lvl_${lvl}`;
      if (!updatedBadges.includes(chId)) {
        updatedBadges.push(chId);
        gainedXp += 100;
        totalNewlyUnlocked.push(chId);
      }
    }
  }

  return {
    gainedXp,
    updatedBadges,
    totalNewlyUnlocked,
    xpBreakdown: {
      found: foundXp,
      completion: completionXp,
      conquest: conquestXp,
      perfect: perfectXp,
      achievements: achievementXp,
    },
  };
}
