import { useCallback, useEffect, useState } from "react";

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
import { evaluateGameRewardsAndBadges, getLevelAndProgress } from "../utils/gamification";
import { generateUUID } from "../utils/utils";

export function useUserProfile() {
  const [session, setSession] = useState(null);

  // Initialize or load local profile
  const [userProfile, setUserProfile] = useState(() => {
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
      us_states: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
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
      us_states: [],
    };
    try {
      const cached = localStorage.getItem("tvrs-last-scores");
      if (cached) {
        return { ...defaultScores, ...JSON.parse(cached) };
      }
    } catch {}
    return defaultScores;
  });

  const [localGameHistory, setLocalGameHistory] = useState(() => {
    try {
      const cached = localStorage.getItem("tvrs-local-game-history");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    return [];
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

      const { gainedXp, updatedBadges, totalNewlyUnlocked, xpBreakdown } =
        evaluateGameRewardsAndBadges({
          userProfile,
          localRecords,
          gameMode,
          finalScore,
          timeSpent,
          totalPossible,
          gameDuration,
          continentsConquered,
        });

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
        hardcore: isNewBestRun ? hardcore : Boolean(currentRecord.hardcore),
      };

      const updatedRecords = {
        ...localRecords,
        [gameMode]: updatedRecord,
      };

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

      const newHistoryItem = {
        id: generateUUID(),
        profile_id: activeUserId,
        game_mode: gameMode,
        score: finalScore,
        time_spent_seconds: timeSpent,
        created_at: new Date().toISOString(),
        hardcore: Boolean(hardcore),
      };
      const updatedGameHistory = [newHistoryItem, ...localGameHistory].slice(0, 100);
      setLocalGameHistory(updatedGameHistory);
      localStorage.setItem("tvrs-local-game-history", JSON.stringify(updatedGameHistory));

      if (isSupabaseConfigured) {
        const { data: upsertedProfileData, error: profileErr } = await upsertProfile(
          activeUserId,
          updatedProfile.username,
          updatedProfile.avatarId,
          updatedProfile.avatarColor,
          updatedProfile.xp,
          updatedProfile.level,
          updatedProfile.unlockedBadges
        );
        if (profileErr) {
          console.error("Error syncing profile update to Supabase:", profileErr);
        } else if (
          upsertedProfileData &&
          upsertedProfileData.username !== updatedProfile.username
        ) {
          updatedProfile.username = upsertedProfileData.username;
          setUserProfile(updatedProfile);
          localStorage.setItem("tvrs-user-profile", JSON.stringify(updatedProfile));
        }

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
        xpBreakdown,
        newlyUnlockedBadges: totalNewlyUnlocked,
      };
    },
    [session, userProfile, localRecords, lastScores, localGameHistory, fetchTopExplorers]
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
    localGameHistory,
  };
}
