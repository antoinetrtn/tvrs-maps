import { useState, useEffect, useCallback } from "react";
import {
  isSupabaseConfigured,
  getProfile,
  upsertProfile,
  getUserRecords,
  upsertUserRecord,
  submitLeaderboardScore,
  getLeaderboard
} from "./supabaseClient";

export function useUserProfile() {
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
          return parsed;
        }
      }
    } catch (_) {}

    const randomNum = Math.floor(100 + Math.random() * 900);
    const newProfile = {
      id: generateUUID(),
      username: `Explorer_${randomNum}`,
      avatarId: "invader_1",
      avatarColor: "cyan"
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
    try {
      localStorage.setItem("tvrs-local-records", JSON.stringify(defaultRecords));
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

  // Sync profile & records with Supabase on startup
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;

    const syncProfileAndRecords = async () => {
      try {
        // 1. Sync Profile
        const { data: dbProfile, error: profileErr } = await getProfile(userProfile.id);
        if (!isMounted) return;

        if (profileErr || !dbProfile) {
          // If not found in DB, upload our local profile
          await upsertProfile(
            userProfile.id,
            userProfile.username,
            userProfile.avatarId,
            userProfile.avatarColor
          );
        } else {
          // If found in DB, sync local state
          const syncedProfile = {
            id: dbProfile.id,
            username: dbProfile.username,
            avatarId: dbProfile.avatar_id,
            avatarColor: dbProfile.avatar_color
          };
          setUserProfile(syncedProfile);
          localStorage.setItem("tvrs-user-profile", JSON.stringify(syncedProfile));
        }

        // 2. Sync Records
        const { data: dbRecords, error: recordsErr } = await getUserRecords(userProfile.id);
        if (!isMounted) return;

        if (!recordsErr && dbRecords && dbRecords.length > 0) {
          setLocalRecords((prev) => {
            const merged = { ...prev };
            dbRecords.forEach((rec) => {
              const modeKey = rec.game_mode;
              if (merged[modeKey]) {
                const localRec = merged[modeKey];
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

                merged[modeKey] = {
                  maxScore: useDb ? dbMaxScore : localRec.maxScore,
                  bestTime: useDb ? dbBestTime : localRec.bestTime,
                  gamesPlayed: Math.max(localRec.gamesPlayed, dbGamesPlayed)
                };
              }
            });
            localStorage.setItem("tvrs-local-records", JSON.stringify(merged));
            return merged;
          });
        } else {
          // If online records are empty, upload all our local records
          for (const [modeKey, record] of Object.entries(localRecords)) {
            if (record.gamesPlayed > 0) {
              await upsertUserRecord(
                userProfile.id,
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
  }, [userProfile.id]);

  const updateGameRecord = useCallback(
    async (gameMode, finalScore, timeSpent) => {
      setLocalRecords((prev) => {
        const currentRecord = prev[gameMode] || { maxScore: 0, bestTime: null, gamesPlayed: 0 };
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
          ...prev,
          [gameMode]: updatedRecord
        };

        localStorage.setItem("tvrs-local-records", JSON.stringify(updatedRecords));

        setLastScores((prevHistory) => {
          const modeHistory = prevHistory[gameMode] || [];
          const nextHistory = [...modeHistory, finalScore].slice(-3);
          const nextScores = { ...prevHistory, [gameMode]: nextHistory };
          try {
            localStorage.setItem("tvrs-last-scores", JSON.stringify(nextScores));
          } catch (_) {}
          return nextScores;
        });

        if (isSupabaseConfigured) {
          upsertUserRecord(
            userProfile.id,
            gameMode,
            nextMaxScore,
            nextBestTime,
            nextGamesPlayed
          ).catch((err) => console.error("Error syncing record:", err));

          if (finalScore > 0) {
            submitLeaderboardScore(userProfile.id, gameMode, finalScore, timeSpent)
              .then(() => {
                fetchTopExplorers();
              })
              .catch((err) => console.error("Error submitting score:", err));
          }
        }

        return updatedRecords;
      });
    },
    [userProfile.id, fetchTopExplorers]
  );

  return {
    userProfile,
    setUserProfile,
    localRecords,
    topExplorers,
    updateGameRecord,
    fetchTopExplorers,
    lastScores
  };
}
