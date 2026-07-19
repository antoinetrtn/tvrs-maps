import { useCallback, useEffect, useState } from "react";

import { CHALLENGES, ISLANDS_LIST } from "../data/challenges";
import {
  getLeaderboard,
  getProfile,
  getUserRecords,
  isSupabaseConfigured,
  submitLeaderboardScore,
  supabase,
  upsertProfile,
  upsertUserRecord,
} from "../services/supabaseClient";
import { getLevelAndProgress } from "../utils/gamification";

export function checkChallengesRealTime(currentBadges, localRecords, sessionData) {
  const newlyUnlocked = [];
  const addBadge = (id) => {
    if (!currentBadges.includes(id) && !newlyUnlocked.includes(id)) {
      newlyUnlocked.push(id);
    }
  };

  const totalGames =
    Object.values(localRecords || {}).reduce((acc, rec) => acc + (rec.gamesPlayed || 0), 0) +
    (sessionData.isGameOver ? 1 : 0);

  const gameMode = sessionData.mode;

  // Evaluate each challenge
  CHALLENGES.forEach((ch) => {
    if (currentBadges.includes(ch.id)) return;

    switch (ch.id) {
      // General Play Counts
      case "ch_gen_play_1":
        if (totalGames >= 1) addBadge(ch.id);
        break;
      case "ch_gen_play_5":
        if (totalGames >= 5) addBadge(ch.id);
        break;
      case "ch_gen_play_10":
        if (totalGames >= 10) addBadge(ch.id);
        break;
      case "ch_gen_play_25":
        if (totalGames >= 25) addBadge(ch.id);
        break;
      case "ch_gen_play_50":
        if (totalGames >= 50) addBadge(ch.id);
        break;

      // General Levels (checked separately during level calculation, but safe to check here too)
      case "ch_gen_lvl_2":
      case "ch_gen_lvl_5":
      case "ch_gen_lvl_10":
      case "ch_gen_lvl_15":
      case "ch_gen_lvl_20":
        // Evaluated based on active level
        break;

      // Continents
      case "ch_cont_europe":
        if (sessionData.continentsConquered?.includes("Europe")) addBadge(ch.id);
        break;
      case "ch_cont_europe_5":
        {
          const count =
            currentBadges.filter((b) => b.startsWith("conquered_Europe_")).length +
            (sessionData.continentsConquered?.includes("Europe") ? 1 : 0);
          if (count >= 5) addBadge(ch.id);
        }
        break;
      case "ch_cont_africa":
        if (sessionData.continentsConquered?.includes("Africa")) addBadge(ch.id);
        break;
      case "ch_cont_africa_5":
        {
          const count =
            currentBadges.filter((b) => b.startsWith("conquered_Africa_")).length +
            (sessionData.continentsConquered?.includes("Africa") ? 1 : 0);
          if (count >= 5) addBadge(ch.id);
        }
        break;
      case "ch_cont_asia":
        if (sessionData.continentsConquered?.includes("Asia")) addBadge(ch.id);
        break;
      case "ch_cont_asia_5":
        {
          const count =
            currentBadges.filter((b) => b.startsWith("conquered_Asia_")).length +
            (sessionData.continentsConquered?.includes("Asia") ? 1 : 0);
          if (count >= 5) addBadge(ch.id);
        }
        break;
      case "ch_cont_americas":
        if (sessionData.continentsConquered?.includes("Americas")) addBadge(ch.id);
        break;
      case "ch_cont_americas_5":
        {
          const count =
            currentBadges.filter((b) => b.startsWith("conquered_Americas_")).length +
            (sessionData.continentsConquered?.includes("Americas") ? 1 : 0);
          if (count >= 5) addBadge(ch.id);
        }
        break;
      case "ch_cont_oceania":
        if (sessionData.continentsConquered?.includes("Oceania")) addBadge(ch.id);
        break;
      case "ch_cont_oceania_5":
        {
          const count =
            currentBadges.filter((b) => b.startsWith("conquered_Oceania_")).length +
            (sessionData.continentsConquered?.includes("Oceania") ? 1 : 0);
          if (count >= 5) addBadge(ch.id);
        }
        break;

      // Scores
      case "ch_score_countries_10":
        if (gameMode === "countries" && sessionData.score >= 10) addBadge(ch.id);
        break;
      case "ch_score_countries_20":
        if (gameMode === "countries" && sessionData.score >= 20) addBadge(ch.id);
        break;
      case "ch_score_countries_50":
        if (gameMode === "countries" && sessionData.score >= 50) addBadge(ch.id);
        break;
      case "ch_score_countries_100":
        if (gameMode === "countries" && sessionData.score >= 100) addBadge(ch.id);
        break;

      case "ch_score_capitals_10":
        if (gameMode === "capitals" && sessionData.score >= 10) addBadge(ch.id);
        break;
      case "ch_score_capitals_20":
        if (gameMode === "capitals" && sessionData.score >= 20) addBadge(ch.id);
        break;
      case "ch_score_capitals_50":
        if (gameMode === "capitals" && sessionData.score >= 50) addBadge(ch.id);
        break;
      case "ch_score_capitals_100":
        if (gameMode === "capitals" && sessionData.score >= 100) addBadge(ch.id);
        break;

      case "ch_score_departments_10":
        if (gameMode === "departments" && sessionData.score >= 10) addBadge(ch.id);
        break;
      case "ch_score_departments_20":
        if (gameMode === "departments" && sessionData.score >= 20) addBadge(ch.id);
        break;
      case "ch_score_departments_50":
        if (gameMode === "departments" && sessionData.score >= 50) addBadge(ch.id);
        break;
      case "ch_score_departments_100":
        if (gameMode === "departments" && sessionData.score >= 100) addBadge(ch.id);
        break;

      // Speed
      case "ch_speed_fast_guess":
        if (sessionData.lastGuessDuration > 0 && sessionData.lastGuessDuration <= 3)
          addBadge(ch.id);
        break;
      case "ch_speed_10_guesses_30s":
        if (sessionData.speedGuessCount3s >= 10) addBadge(ch.id);
        break;
      case "ch_speed_20_guesses_60s":
        if (sessionData.speedGuessCount3s >= 20) addBadge(ch.id);
        break;
      case "ch_speed_under_2m":
        if (sessionData.isGameOver && sessionData.timeSpent <= 120 && sessionData.score > 0)
          addBadge(ch.id);
        break;
      case "ch_speed_under_1m":
        if (sessionData.isGameOver && sessionData.timeSpent <= 60 && sessionData.score > 0)
          addBadge(ch.id);
        break;
      case "ch_speed_under_30s":
        if (sessionData.isGameOver && sessionData.timeSpent <= 30 && sessionData.score > 0)
          addBadge(ch.id);
        break;
      case "ch_speed_half_time":
        if (
          sessionData.isGameOver &&
          sessionData.gameDuration > 0 &&
          sessionData.timeSpent <= sessionData.gameDuration / 2 &&
          sessionData.score > 0
        ) {
          addBadge(ch.id);
        }
        break;
      case "ch_speed_blitz":
        if (sessionData.lastGuessDuration > 0 && sessionData.lastGuessDuration <= 1)
          addBadge(ch.id);
        break;
      case "ch_speed_perfect_100":
        if (
          sessionData.isGameOver &&
          sessionData.perfect &&
          sessionData.score >= 100 &&
          sessionData.timeSpent <= 120
        ) {
          addBadge(ch.id);
        }
        break;
      case "ch_speed_lightning":
        if (sessionData.lightningCount >= 1) addBadge(ch.id);
        break;

      // Relief
      case "ch_relief_score_10":
        if (gameMode === "rivers_mountains" && sessionData.score >= 10) addBadge(ch.id);
        break;
      case "ch_relief_score_20":
        if (gameMode === "rivers_mountains" && sessionData.score >= 20) addBadge(ch.id);
        break;
      case "ch_relief_score_30":
        if (gameMode === "rivers_mountains" && sessionData.score >= 30) addBadge(ch.id);
        break;
      case "ch_relief_score_40":
        if (gameMode === "rivers_mountains" && sessionData.score >= 40) addBadge(ch.id);
        break;

      // Specialties
      case "ch_special_night":
        if (sessionData.isNight) addBadge(ch.id);
        break;
      case "ch_special_lunch":
        if (sessionData.isLunch) addBadge(ch.id);
        break;
      case "ch_special_perfect":
        if (sessionData.isGameOver && sessionData.perfect && sessionData.score > 0) addBadge(ch.id);
        break;
      case "ch_special_islands":
        {
          const islands =
            sessionData.guessesThisGame?.filter((k) => ISLANDS_LIST.includes(k)).length || 0;
          if (islands >= 5) addBadge(ch.id);
        }
        break;
    }
  });

  return newlyUnlocked;
}

export function useUserProfile() {
  const [session, setSession] = useState(null);

  // Initialize or load local profile
  const [userProfile, setUserProfile] = useState(() => {
    const generateUUID = () => {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
        return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
      }
      throw new Error("Secure random generator is not available in this environment.");
    };

    const isUUID = (str) => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    };

    try {
      const cached = localStorage.getItem("tvrs-user-profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && isUUID(parsed.id)) {
          return {
            xp: 0,
            level: 1,
            unlockedBadges: [],
            ...parsed,
          };
        }
      }
    } catch {}

    const getSecureRandomIntInRange = (min, maxExclusive) => {
      const range = maxExclusive - min;
      if (typeof crypto !== "undefined") {
        if (typeof crypto.randomInt === "function") {
          return crypto.randomInt(min, maxExclusive);
        }
        if (crypto.getRandomValues) {
          const maxUint32 = 0x100000000;
          const maxUnbiased = Math.floor(maxUint32 / range) * range;
          const arr = new Uint32Array(1);
          let x;
          do {
            crypto.getRandomValues(arr);
            x = arr[0];
          } while (x >= maxUnbiased);
          return min + (x % range);
        }
      }
      return Math.floor(min + Math.random() * range);
    };

    const randomNum = getSecureRandomIntInRange(100, 1000);
    const newProfile = {
      id: generateUUID(),
      username: `Explorer_${randomNum}`,
      avatarId: "invader_1",
      avatarColor: "cyan",
      xp: 0,
      level: 1,
      unlockedBadges: [],
    };
    try {
      localStorage.setItem("tvrs-user-profile", JSON.stringify(newProfile));
    } catch {}
    return newProfile;
  });

  const [localRecords, setLocalRecords] = useState(() => {
    const defaultRecords = {
      countries: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      capitals: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      departments: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      rivers_mountains: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
    };
    try {
      const cached = localStorage.getItem("tvrs-local-records");
      if (cached) {
        return { ...defaultRecords, ...JSON.parse(cached) };
      }
    } catch {}
    return defaultRecords;
  });

  const [lastScores, setLastScores] = useState(() => {
    const defaultScores = {
      countries: [],
      capitals: [],
      departments: [],
      rivers_mountains: [],
    };
    try {
      const cached = localStorage.getItem("tvrs-last-scores");
      if (cached) {
        return { ...defaultScores, ...JSON.parse(cached) };
      }
    } catch {}
    return defaultScores;
  });

  const [topExplorers, setTopExplorers] = useState([]);

  // Fetch top explorers
  const fetchTopExplorers = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await getLeaderboard("countries", 3);
      if (!error && data) {
        setTopExplorers(data);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération du Top 3 :", err);
    }
  }, []);

  // Fetch top explorers on mount
  useEffect(() => {
    fetchTopExplorers();
  }, [fetchTopExplorers]);

  // Listen to Supabase Auth State changes
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth
      .getSession()
      .then(({ data: { session: activeSession } }) => {
        setSession(activeSession);
        return;
      })
      .catch(() => {});

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync profile & records with Supabase when session changes
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;

    const syncProfileAndRecords = async () => {
      const activeUserId = session?.user?.id || userProfile.id;

      try {
        const { data: dbProfile, error: profileErr } = await getProfile(activeUserId);
        if (!isMounted) return;

        let localProfile = {};
        try {
          const cached = localStorage.getItem("tvrs-user-profile");
          if (cached) localProfile = JSON.parse(cached);
        } catch {}

        if (profileErr || !dbProfile) {
          const uploadId = session?.user?.id || userProfile.id;
          const merged = {
            ...userProfile,
            id: uploadId,
          };
          await upsertProfile(
            uploadId,
            merged.username,
            merged.avatarId,
            merged.avatarColor,
            merged.xp || 0,
            merged.level || 1,
            merged.unlockedBadges || []
          );
          if (session?.user?.id) {
            setUserProfile(merged);
            localStorage.setItem("tvrs-user-profile", JSON.stringify(merged));
          }
        } else {
          const mergedXp = Math.max(dbProfile.xp || 0, localProfile.xp || 0);
          const computedLevel = getLevelAndProgress(mergedXp).level;
          const mergedLevel = Math.max(dbProfile.level || 1, computedLevel);
          const mergedBadges = Array.from(
            new Set([...(dbProfile.unlocked_badges || []), ...(localProfile.unlockedBadges || [])])
          );

          const syncedProfile = {
            id: dbProfile.id,
            username: dbProfile.username || localProfile.username || userProfile.username,
            avatarId: dbProfile.avatar_id || localProfile.avatarId || userProfile.avatarId,
            avatarColor:
              dbProfile.avatar_color || localProfile.avatarColor || userProfile.avatarColor,
            xp: mergedXp,
            level: mergedLevel,
            unlockedBadges: mergedBadges,
          };

          await upsertProfile(
            dbProfile.id,
            syncedProfile.username,
            syncedProfile.avatarId,
            syncedProfile.avatarColor,
            syncedProfile.xp,
            syncedProfile.level,
            syncedProfile.unlockedBadges
          );

          setUserProfile(syncedProfile);
          localStorage.setItem("tvrs-user-profile", JSON.stringify(syncedProfile));
        }

        const { data: dbRecords, error: recordsErr } = await getUserRecords(activeUserId);
        if (!isMounted) return;

        const mergedRecords = { ...localRecords };

        if (!recordsErr && dbRecords && dbRecords.length > 0) {
          dbRecords.forEach((rec) => {
            const modeKey = rec.game_mode;
            if (mergedRecords[modeKey]) {
              const localRec = mergedRecords[modeKey];
              const dbMaxScore = rec.max_score;
              const dbBestTime = rec.best_time_seconds;
              const dbGamesPlayed = rec.games_played || 0;

              let useDb = false;
              if (dbMaxScore > localRec.maxScore) {
                useDb = true;
              } else if (dbMaxScore === localRec.maxScore) {
                if (
                  localRec.bestTime === null ||
                  (dbBestTime !== null && dbBestTime < localRec.bestTime)
                ) {
                  useDb = true;
                }
              }

              mergedRecords[modeKey] = {
                maxScore: useDb ? dbMaxScore : localRec.maxScore,
                bestTime: useDb ? dbBestTime : localRec.bestTime,
                gamesPlayed: Math.max(localRec.gamesPlayed, dbGamesPlayed),
              };
            }
          });

          for (const [modeKey, record] of Object.entries(mergedRecords)) {
            if (record.gamesPlayed > 0) {
              await upsertUserRecord(
                activeUserId,
                modeKey,
                record.maxScore,
                record.bestTime,
                record.gamesPlayed
              );
            }
          }

          setLocalRecords(mergedRecords);
          localStorage.setItem("tvrs-local-records", JSON.stringify(mergedRecords));
        } else {
          for (const [modeKey, record] of Object.entries(localRecords)) {
            if (record.gamesPlayed > 0) {
              await upsertUserRecord(
                activeUserId,
                modeKey,
                record.maxScore,
                record.bestTime,
                record.gamesPlayed
              );
            }
          }
        }
      } catch (err) {
        console.error("Erreur lors de la synchronisation Supabase :", err);
      }
    };

    syncProfileAndRecords();

    return () => {
      isMounted = false;
    };
  }, [session, userProfile.id]);

  const updateGameRecord = useCallback(
    async (
      gameMode,
      finalScore,
      timeSpent,
      totalPossible = 0,
      gameDuration = 0,
      continentsConquered = [],
      hardcore = false
    ) => {
      const oldXp = userProfile.xp || 0;
      const oldLevel = userProfile.level || 1;

      // Base gameplay XP
      const foundXp = finalScore * 10;
      const completionXp = 50;
      const conquestXp =
        (Array.isArray(continentsConquered) ? continentsConquered.length : 0) * 100;
      const perfectXp = finalScore > 0 && finalScore === totalPossible ? 250 : 0;
      let gainedXp = foundXp + completionXp + conquestXp + perfectXp;

      // Intermediate level detection
      const intermediateXp = oldXp + gainedXp;
      const { level: intermediateLevel } = getLevelAndProgress(intermediateXp);

      // Check level achievements
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

      // Update local records
      const currentRecord = localRecords[gameMode] || {
        maxScore: 0,
        bestTime: null,
        gamesPlayed: 0,
      };
      const nextGamesPlayed = currentRecord.gamesPlayed + 1;

      let nextMaxScore = currentRecord.maxScore;
      let nextBestTime = currentRecord.bestTime;
      let isNewBestRun = false;

      if (finalScore > currentRecord.maxScore) {
        nextMaxScore = finalScore;
        nextBestTime = timeSpent;
        isNewBestRun = true;
      } else if (finalScore === currentRecord.maxScore) {
        if (currentRecord.bestTime === null || timeSpent < currentRecord.bestTime) {
          nextBestTime = timeSpent;
          isNewBestRun = true;
        }
      }

      const updatedRecord = {
        maxScore: nextMaxScore,
        bestTime: nextBestTime,
        gamesPlayed: nextGamesPlayed,
        // Whether the standing best run was achieved in hardcore.
        hardcore: isNewBestRun ? hardcore : Boolean(currentRecord.hardcore),
      };

      const updatedRecords = {
        ...localRecords,
        [gameMode]: updatedRecord,
      };

      // Add incremental continents markers
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

      // Final Game End Session Data
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
      const newlyUnlocked = checkChallengesRealTime(
        baseBadgesPlusMarkers,
        localRecords,
        sessionData
      );

      // Award +100 XP per unlocked achievement
      const totalNewlyUnlocked = [...levelBadges, ...newlyUnlocked];
      const achievementXp = totalNewlyUnlocked.length * 100;
      gainedXp += achievementXp;

      const newXp = oldXp + gainedXp;
      const { level: newLevel } = getLevelAndProgress(newXp);
      const updatedBadges = [...baseBadgesPlusMarkers, ...newlyUnlocked];

      // Secondary check: did the achievement XP trigger further level-ups?
      for (let lvl = intermediateLevel + 1; lvl <= newLevel; lvl++) {
        if ([2, 5, 10, 15, 20].includes(lvl)) {
          const chId = `ch_gen_lvl_${lvl}`;
          if (!updatedBadges.includes(chId)) {
            updatedBadges.push(chId);
            // Award an extra 100 XP for this level badge
            gainedXp += 100;
            totalNewlyUnlocked.push(chId);
          }
        }
      }

      const finalXp = oldXp + gainedXp;
      const { level: finalLevel } = getLevelAndProgress(finalXp);

      const activeUserId = session?.user?.id || userProfile.id;
      const updatedProfile = {
        ...userProfile,
        id: activeUserId,
        xp: finalXp,
        level: finalLevel,
        unlockedBadges: updatedBadges,
      };

      setUserProfile(updatedProfile);
      localStorage.setItem("tvrs-user-profile", JSON.stringify(updatedProfile));

      setLocalRecords(updatedRecords);
      localStorage.setItem("tvrs-local-records", JSON.stringify(updatedRecords));

      const modeHistory = lastScores[gameMode] || [];
      const nextHistory = [...modeHistory, finalScore].slice(-3);
      const nextScores = { ...lastScores, [gameMode]: nextHistory };
      setLastScores(nextScores);
      localStorage.setItem("tvrs-last-scores", JSON.stringify(nextScores));

      if (isSupabaseConfigured) {
        const { error: profileErr } = await upsertProfile(
          activeUserId,
          updatedProfile.username,
          updatedProfile.avatarId,
          updatedProfile.avatarColor,
          updatedProfile.xp,
          updatedProfile.level,
          updatedProfile.unlockedBadges
        );
        if (profileErr) console.error("Error syncing profile update to Supabase:", profileErr);

        const { error: recordErr } = await upsertUserRecord(
          activeUserId,
          gameMode,
          nextMaxScore,
          nextBestTime,
          nextGamesPlayed,
          isNewBestRun ? hardcore : null
        );
        if (recordErr) console.error("Error syncing user record to Supabase:", recordErr);

        if (finalScore > 0) {
          const { error: scoreErr } = await submitLeaderboardScore(
            activeUserId,
            gameMode,
            finalScore,
            timeSpent,
            hardcore
          );
          if (scoreErr) {
            console.error("Error submitting score to Supabase:", scoreErr);
          } else {
            fetchTopExplorers();
          }
        }
      }

      return {
        oldXp,
        oldLevel,
        gainedXp,
        xpBreakdown: {
          found: foundXp,
          completion: completionXp,
          conquest: conquestXp,
          perfect: perfectXp,
          achievements: achievementXp,
        },
        newlyUnlockedBadges: totalNewlyUnlocked,
      };
    },
    [session, userProfile, localRecords, lastScores, fetchTopExplorers]
  );

  return {
    session,
    userProfile,
    setUserProfile,
    localRecords,
    topExplorers,
    updateGameRecord,
    fetchTopExplorers,
    lastScores,
  };
}
