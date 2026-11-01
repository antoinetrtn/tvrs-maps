import { useCallback, useEffect, useState } from "react";

import {
  getLeaderboard,
  getProfile,
  getSupabase,
  getUserRecords,
  isSupabaseConfigured,
} from "../services/supabaseClient";
import { evaluateGameRewardsAndBadges, getLevelAndProgress } from "../utils/gamification";
import { secureRandomInt } from "../utils/secureRandom";
import { generateUUID } from "../utils/utils";
import {
  calculateUpdatedRecord,
  DEFAULT_RECORD,
  readCachedLocalProfile,
  syncGameRecordToSupabase,
  syncLocalProfileToDb,
  syncRecordsStep,
  syncRemoteProfileWithLocal,
  updateLocalScoresAndHistory,
} from "./userProfileSync";

/**
 * Session that owns the profile. The anonymous account created for Conquête
 * multiplayer must not take over the guest's local profile, XP and records,
 * so it is treated as "no session" here.
 */
export const profileSession = (session) => (session?.user?.is_anonymous ? null : session);

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

    const randomNum = secureRandomInt(100, 1000);
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
    if (!isSupabaseConfigured) return undefined;

    let cancelled = false;
    let subscription = null;

    getSupabase()
      .then((supabase) => {
        if (cancelled || !supabase) return null;
        const { data } = supabase.auth.onAuthStateChange((_event, activeSession) => {
          if (!cancelled) setSession(profileSession(activeSession));
        });
        subscription = data?.subscription || null;
        return supabase.auth.getSession();
      })
      .then((res) => {
        if (!cancelled && res?.data) setSession(profileSession(res.data.session));
        return null;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
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

        const localProfile = readCachedLocalProfile();
        if (profileErr || !dbProfile) {
          await syncLocalProfileToDb({ session, userProfile, setUserProfile });
        } else {
          await syncRemoteProfileWithLocal({
            dbProfile,
            localProfile,
            userProfile,
            setUserProfile,
          });
        }

        const { data: dbRecords, error: recordsErr } = await getUserRecords(activeUserId);
        if (!isMounted) return;

        await syncRecordsStep({
          activeUserId,
          localRecords,
          dbRecords,
          recordsErr,
          setLocalRecords,
        });
      } catch (err) {
        console.error("Erreur lors de la synchronisation Supabase :", err);
      }
    };

    void syncProfileAndRecords();

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

      const currentRecord =
        (Object.hasOwn(localRecords, gameMode) && localRecords[gameMode]) || DEFAULT_RECORD;

      const { updatedRecord, nextMaxScore, nextBestTime, nextGamesPlayed, isNewBestRun } =
        calculateUpdatedRecord({ currentRecord, finalScore, timeSpent, hardcore });

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

      updateLocalScoresAndHistory({
        activeUserId,
        gameMode,
        finalScore,
        timeSpent,
        hardcore,
        lastScores,
        setLastScores,
        localGameHistory,
        setLocalGameHistory,
      });

      if (isSupabaseConfigured) {
        await syncGameRecordToSupabase({
          activeUserId,
          gameMode,
          finalScore,
          timeSpent,
          hardcore,
          updatedProfile,
          setUserProfile,
          nextMaxScore,
          nextBestTime,
          nextGamesPlayed,
          isNewBestRun,
          fetchTopExplorers,
        });
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
