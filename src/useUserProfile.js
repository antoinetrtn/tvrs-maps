import { useState, useEffect, useCallback } from "react";
import {
  isSupabaseConfigured,
  supabase,
  getProfile,
  upsertProfile,
  getUserRecords,
  upsertUserRecord,
  submitLeaderboardScore,
  getLeaderboard
} from "./supabaseClient";

export function getLevelAndProgress(totalXp) {
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
    percent: Math.min(100, Math.floor((tempXp / (level * 200)) * 100))
  };
}

export function getAvatarUnlockLevel(avatarId) {
  const match = avatarId.match(/^invader_(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num <= 3) return 1;
    return num - 2; // invader_4 -> lvl 2, invader_5 -> lvl 3, etc.
  }
  return 1;
}

export function checkAndUnlockBadges(
  currentBadges,
  gameMode,
  score,
  timeSpent,
  totalCount,
  gameDuration,
  localRecords,
  lastScores
) {
  const newlyUnlocked = [];
  const addBadge = (id) => {
    if (!currentBadges.includes(id) && !newlyUnlocked.includes(id)) {
      newlyUnlocked.push(id);
    }
  };

  // 1. Premier Pas
  if (score >= 1) {
    addBadge("first_step");
  }

  // 2. Explorateur
  const allQuizModes = ["countries", "capitals", "departments", "rivers_mountains"];
  const playedAll = allQuizModes.every((m) => {
    if (m === gameMode) return true;
    return (localRecords[m]?.gamesPlayed || 0) > 0;
  });
  if (playedAll) {
    addBadge("explorer");
  }

  // 3. Bolide
  if (gameDuration && gameDuration > 0 && timeSpent <= gameDuration / 2 && score > 0) {
    addBadge("speed_runner");
  }

  // 4. Centurion
  if (score >= 100) {
    addBadge("centurion");
  }

  // 5. Perfectionniste
  if (score > 0 && totalCount > 0 && score === totalCount) {
    addBadge("perfectionist");
  }

  // 6. Maître des Reliefs
  if (gameMode === "rivers_mountains" && score >= 20) {
    addBadge("relief_master");
  }

  // 7. Pilier (10 parties)
  const totalGames = Object.values(localRecords).reduce((acc, rec) => acc + (rec.gamesPlayed || 0), 0) + 1;
  if (totalGames >= 10) {
    addBadge("loyal_player");
  }

  // 8. Oiseau de Nuit (22h - 4h)
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 4) {
    addBadge("night_owl");
  }

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
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
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
            ...parsed
          };
        }
      }
    } catch (_) {}

    const randomNum = Math.floor(100 + Math.random() * 900);
    const newProfile = {
      id: generateUUID(),
      username: `Explorer_${randomNum}`,
      avatarId: "invader_1",
      avatarColor: "cyan",
      xp: 0,
      level: 1,
      unlockedBadges: []
    };
    try {
      localStorage.setItem("tvrs-user-profile", JSON.stringify(newProfile));
    } catch (_) {}
    return newProfile;
  });

  const [localRecords, setLocalRecords] = useState(() => {
    const defaultRecords = {
      countries: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      capitals: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      departments: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      rivers_mountains: { maxScore: 0, bestTime: null, gamesPlayed: 0 }
    };
    try {
      const cached = localStorage.getItem("tvrs-local-records");
      if (cached) {
        return { ...defaultRecords, ...JSON.parse(cached) };
      }
    } catch (_) {}
    return defaultRecords;
  });

  const [lastScores, setLastScores] = useState(() => {
    const defaultScores = {
      countries: [],
      capitals: [],
      departments: [],
      rivers_mountains: []
    };
    try {
      const cached = localStorage.getItem("tvrs-last-scores");
      if (cached) {
        return { ...defaultScores, ...JSON.parse(cached) };
      }
    } catch (_) {}
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

  // Listen to Supabase Auth State changes
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Get current session
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
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
        // 1. Sync Profile (with fusion logic)
        const { data: dbProfile, error: profileErr } = await getProfile(activeUserId);
        if (!isMounted) return;

        // Get local cached copy
        let localProfile = {};
        try {
          const cached = localStorage.getItem("tvrs-user-profile");
          if (cached) localProfile = JSON.parse(cached);
        } catch (_) {}

        if (profileErr || !dbProfile) {
          // If logged in, but no profile exists in database, upload our local progress
          const uploadId = session?.user?.id || userProfile.id;
          const merged = {
            ...userProfile,
            id: uploadId
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
          // Profile exists in DB. Perform fusion with local profile!
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
            avatarColor: dbProfile.avatar_color || localProfile.avatarColor || userProfile.avatarColor,
            xp: mergedXp,
            level: mergedLevel,
            unlockedBadges: mergedBadges
          };

          // Save back the fused profile to DB and LocalStorage
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

        // 2. Sync Records (with fusion)
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
                if (localRec.bestTime === null || (dbBestTime !== null && dbBestTime < localRec.bestTime)) {
                  useDb = true;
                }
              }

              mergedRecords[modeKey] = {
                maxScore: useDb ? dbMaxScore : localRec.maxScore,
                bestTime: useDb ? dbBestTime : localRec.bestTime,
                gamesPlayed: Math.max(localRec.gamesPlayed, dbGamesPlayed)
              };
            }
          });

          // Upload fused records back if local was better or merge updated them
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
          // DB has no records, upload local records
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
        console.error("Erreur lors de la synchronisation en ligne :", err);
      }
    };

    syncProfileAndRecords();

    return () => {
      isMounted = false;
    };
  }, [session, userProfile.id]);

  const updateGameRecord = useCallback(
    async (gameMode, finalScore, timeSpent, totalPossible = 0, gameDuration = 0, continentsConquered = 0) => {
      // 1. Calculate XP
      const oldXp = userProfile.xp || 0;
      const oldLevel = userProfile.level || 1;

      const foundXp = finalScore * 10;
      const completionXp = 50;
      const conquestXp = continentsConquered * 100;
      const perfectXp = (finalScore > 0 && finalScore === totalPossible) ? 250 : 0;
      const gainedXp = foundXp + completionXp + conquestXp + perfectXp;

      const newXp = oldXp + gainedXp;
      const { level: newLevel } = getLevelAndProgress(newXp);

      // Update local records
      const currentRecord = localRecords[gameMode] || { maxScore: 0, bestTime: null, gamesPlayed: 0 };
      const nextGamesPlayed = currentRecord.gamesPlayed + 1;

      let nextMaxScore = currentRecord.maxScore;
      let nextBestTime = currentRecord.bestTime;

      if (finalScore > currentRecord.maxScore) {
        nextMaxScore = finalScore;
        nextBestTime = timeSpent;
      } else if (finalScore === currentRecord.maxScore) {
        if (currentRecord.bestTime === null || timeSpent < currentRecord.bestTime) {
          nextBestTime = timeSpent;
        }
      }

      const updatedRecord = {
        maxScore: nextMaxScore,
        bestTime: nextBestTime,
        gamesPlayed: nextGamesPlayed
      };

      const updatedRecords = {
        ...localRecords,
        [gameMode]: updatedRecord
      };

      // Check badges
      const currentBadges = userProfile.unlockedBadges || [];
      const newlyUnlocked = checkAndUnlockBadges(
        currentBadges,
        gameMode,
        finalScore,
        timeSpent,
        totalPossible,
        gameDuration,
        localRecords,
        lastScores[gameMode] || []
      );
      const updatedBadges = [...currentBadges, ...newlyUnlocked];

      // Update states
      const activeUserId = session?.user?.id || userProfile.id;
      const updatedProfile = {
        ...userProfile,
        id: activeUserId,
        xp: newXp,
        level: newLevel,
        unlockedBadges: updatedBadges
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

      // Sync updated profile to DB
      if (isSupabaseConfigured) {
        await upsertProfile(
          activeUserId,
          updatedProfile.username,
          updatedProfile.avatarId,
          updatedProfile.avatarColor,
          updatedProfile.xp,
          updatedProfile.level,
          updatedProfile.unlockedBadges
        ).catch((err) => console.error("Error syncing profile update:", err));

        await upsertUserRecord(
          activeUserId,
          gameMode,
          nextMaxScore,
          nextBestTime,
          nextGamesPlayed
        ).catch((err) => console.error("Error syncing record:", err));

        if (finalScore > 0) {
          submitLeaderboardScore(activeUserId, gameMode, finalScore, timeSpent)
            .then(() => {
              fetchTopExplorers();
            })
            .catch((err) => console.error("Error submitting score:", err));
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
          perfect: perfectXp
        },
        newlyUnlockedBadges: newlyUnlocked
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
    lastScores
  };
}
