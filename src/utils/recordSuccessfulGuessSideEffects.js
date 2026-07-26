import { AVATAR_COLORS, getThemeRegionColorLabel } from "../config/designSystem";
import { CHALLENGES } from "../data/challenges";
import { isSupabaseConfigured, upsertProfile } from "../services/supabaseClient";
import { checkChallengesRealTime } from "../utils/achievementEvaluator";
import { getLevelAndProgress } from "../utils/gamification";

const CONTINENT_INVADERS = [
  "invader_1",
  "invader_2",
  "invader_3",
  "invader_4",
  "invader_5",
  "invader_6",
  "invader_7",
  "invader_8",
];

function trackGuessTiming(refs, guessedKey) {
  const now = Date.now();
  const lastGuessDuration = (now - refs.lastGuessTimeRef.current) / 1000;
  refs.lastGuessTimeRef.current = now;
  refs.guessesThisGameRef.current.push(guessedKey);

  if (lastGuessDuration <= 3) refs.speedGuessCount3sRef.current += 1;
  if (lastGuessDuration <= 1) refs.speedGuessCount1sRef.current += 1;

  refs.guessTimestampsRef.current.push(now);
  if (refs.guessTimestampsRef.current.length >= 3) {
    const thirdLast = refs.guessTimestampsRef.current[refs.guessTimestampsRef.current.length - 3];
    if (now - thirdLast <= 5000) refs.lightningCountRef.current += 1;
  }

  return lastGuessDuration;
}

function checkContinentConquest({
  guessedKey,
  foundList,
  newFound,
  activeDataMap,
  conqueredRegionsThisGameRef,
  globeTheme,
  theme,
  t,
  addAchievementToQueue,
}) {
  const region = activeDataMap[guessedKey]?.region;
  if (!region || region === "Unknown") return [];

  const allInRegion = Object.keys(activeDataMap).filter((k) => activeDataMap[k]?.region === region);
  if (allInRegion.length === 0) return [];

  const wasCompletedBefore =
    foundList.filter((k) => activeDataMap[k]?.region === region).length === allInRegion.length;
  const isCompletedNow =
    newFound.filter((k) => activeDataMap[k]?.region === region).length === allInRegion.length;

  if (wasCompletedBefore || !isCompletedNow) return [];

  conqueredRegionsThisGameRef.current.push(region);
  const labelColor = getThemeRegionColorLabel(globeTheme, theme, region);
  const regionHash = region.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  addAchievementToQueue({
    title: t("achievement_continent_conquered"),
    message: t("achievement_continent_desc", {
      region: t(`region_${region}`) || region,
    }),
    color: labelColor,
    invaderId: CONTINENT_INVADERS[regionHash % CONTINENT_INVADERS.length],
  });

  return [region];
}

function applyUnlockedChallenges({
  unlocked,
  currentBadges,
  userProfile,
  lang,
  setUserProfile,
  addAchievementToQueue,
  session,
}) {
  const gainedAchievementXp = unlocked.length * 100;
  const newXp = (userProfile.xp || 0) + gainedAchievementXp;
  const { level: newLevel } = getLevelAndProgress(newXp);

  const levelBadges = [];
  for (let lvl = 2; lvl <= newLevel; lvl++) {
    if ([2, 5, 10, 15, 20].includes(lvl)) {
      const chId = `ch_gen_lvl_${lvl}`;
      if (!currentBadges.includes(chId) && !unlocked.includes(chId)) {
        levelBadges.push(chId);
      }
    }
  }

  const updatedBadges = [...currentBadges, ...unlocked, ...levelBadges];
  const finalXp = newXp + levelBadges.length * 100;
  const { level: finalLevel } = getLevelAndProgress(finalXp);
  const updatedProfile = {
    ...userProfile,
    xp: finalXp,
    level: finalLevel,
    unlockedBadges: updatedBadges,
  };

  setUserProfile(updatedProfile);
  localStorage.setItem("tvrs-user-profile", JSON.stringify(updatedProfile));

  [...unlocked, ...levelBadges].forEach((chId) => {
    const chObj = CHALLENGES.find((c) => c.id === chId);
    if (!chObj) return;
    addAchievementToQueue({
      title: lang === "fr" ? chObj.titleFr : chObj.titleEn,
      message: `${lang === "fr" ? chObj.descFr : chObj.descEn} (Emote débloquée !)`,
      color: AVATAR_COLORS[chObj.color] || chObj.color,
      invaderId: chObj.id,
    });
  });

  if (isSupabaseConfigured) {
    const activeUserId = session?.user?.id || userProfile.id;
    upsertProfile(
      activeUserId,
      updatedProfile.username,
      updatedProfile.avatarId,
      updatedProfile.avatarColor,
      updatedProfile.xp,
      updatedProfile.level,
      updatedProfile.unlockedBadges
    ).catch((err) => console.error("Error syncing real-time challenge:", err));
  }
}

export function recordSuccessfulGuessSideEffects({
  guessedKey,
  foundList,
  newFound,
  activeDataMap,
  refs,
  mode,
  gameDuration,
  timeLeft,
  globeTheme,
  theme,
  t,
  lang,
  userProfile,
  localRecords,
  session,
  setUserProfile,
  addAchievementToQueue,
}) {
  const lastGuessDuration = trackGuessTiming(refs, guessedKey);
  const newlyConqueredRegions = checkContinentConquest({
    guessedKey,
    foundList,
    newFound,
    activeDataMap,
    conqueredRegionsThisGameRef: refs.conqueredRegionsThisGameRef,
    globeTheme,
    theme,
    t,
    addAchievementToQueue,
  });

  const hour = new Date().getHours();
  const currentBadges = userProfile.unlockedBadges || [];
  const sessionData = {
    mode,
    score: newFound.length,
    timeSpent: gameDuration - timeLeft,
    timeLeft,
    accuracy: 1,
    isGameOver: false,
    perfect: false,
    continentsConquered: newlyConqueredRegions,
    consecutiveCorrect: newFound.length,
    lastGuessDuration,
    guessesThisGame: refs.guessesThisGameRef.current,
    speedGuessCount3s: refs.speedGuessCount3sRef.current,
    speedGuessCount1s: refs.speedGuessCount1sRef.current,
    lightningCount: refs.lightningCountRef.current,
    gameDuration,
    isNight: hour >= 22 || hour < 4,
    isLunch: hour >= 12 && hour < 14,
  };

  const unlocked = checkChallengesRealTime(currentBadges, localRecords, sessionData);
  if (unlocked.length > 0) {
    applyUnlockedChallenges({
      unlocked,
      currentBadges,
      userProfile,
      lang,
      setUserProfile,
      addAchievementToQueue,
      session,
    });
  }
}
