import {
  submitLeaderboardScore,
  upsertProfile,
  upsertUserRecord,
} from "../services/supabaseClient";
import { getLevelAndProgress } from "../utils/gamification";
import { generateUUID } from "../utils/utils";

/** Pure Supabase/localStorage sync helpers for useUserProfile. */
export function readCachedLocalProfile() {
  try {
    const cached = localStorage.getItem("tvrs-user-profile");
    if (cached) return JSON.parse(cached);
  } catch {}
  return {};
}

export const DEFAULT_RECORD = { maxScore: 0, bestTime: null, gamesPlayed: 0 };

async function upsertAndSaveProfile(id, p, setUserProfile, updateState) {
  await upsertProfile(
    id,
    p.username,
    p.avatarId,
    p.avatarColor,
    p.xp || 0,
    p.level || 1,
    p.unlockedBadges || []
  );
  if (updateState) {
    setUserProfile(p);
    localStorage.setItem("tvrs-user-profile", JSON.stringify(p));
  }
}

export async function syncLocalProfileToDb({ session, userProfile, setUserProfile }) {
  const uploadId = session?.user?.id || userProfile.id;
  const merged = { ...userProfile, id: uploadId };
  await upsertAndSaveProfile(uploadId, merged, setUserProfile, Boolean(session?.user?.id));
}

export async function syncRemoteProfileWithLocal({
  dbProfile,
  localProfile,
  userProfile,
  setUserProfile,
}) {
  const mergedXp = Math.max(dbProfile.xp || 0, localProfile.xp || 0);
  const syncedProfile = {
    id: dbProfile.id,
    username: dbProfile.username || localProfile.username || userProfile.username,
    avatarId: dbProfile.avatar_id || localProfile.avatarId || userProfile.avatarId,
    avatarColor: dbProfile.avatar_color || localProfile.avatarColor || userProfile.avatarColor,
    xp: mergedXp,
    level: Math.max(dbProfile.level || 1, getLevelAndProgress(mergedXp).level),
    unlockedBadges: Array.from(
      new Set([...(dbProfile.unlocked_badges || []), ...(localProfile.unlockedBadges || [])])
    ),
  };
  await upsertAndSaveProfile(dbProfile.id, syncedProfile, setUserProfile, true);
}

function shouldPreferDbRecord(localRec, dbMaxScore, dbBestTime) {
  if (dbMaxScore > localRec.maxScore) return true;
  if (dbMaxScore === localRec.maxScore) {
    return localRec.bestTime === null || (dbBestTime !== null && dbBestTime < localRec.bestTime);
  }
  return false;
}

function mergeRecordEntries(localRecords, dbRecords) {
  const merged = { ...localRecords };
  for (const rec of dbRecords) {
    const k = rec.game_mode;
    if (Object.hasOwn(merged, k) && merged[k]) {
      const cur = merged[k];
      const useDb = shouldPreferDbRecord(cur, rec.max_score, rec.best_time_seconds);
      merged[k] = {
        maxScore: useDb ? rec.max_score : cur.maxScore,
        bestTime: useDb ? rec.best_time_seconds : cur.bestTime,
        gamesPlayed: Math.max(cur.gamesPlayed, rec.games_played || 0),
      };
    }
  }
  return merged;
}

export async function syncRecordsStep({
  activeUserId,
  localRecords,
  dbRecords,
  recordsErr,
  setLocalRecords,
}) {
  const merged =
    !recordsErr && dbRecords && dbRecords.length > 0
      ? mergeRecordEntries(localRecords, dbRecords)
      : null;
  const target = merged || localRecords;
  const upsertPromises = [];
  for (const [modeKey, record] of Object.entries(target)) {
    if (record.gamesPlayed > 0) {
      upsertPromises.push(
        upsertUserRecord(
          activeUserId,
          modeKey,
          record.maxScore,
          record.bestTime,
          record.gamesPlayed
        )
      );
    }
  }
  await Promise.all(upsertPromises);
  if (merged) {
    setLocalRecords(merged);
    localStorage.setItem("tvrs-local-records", JSON.stringify(merged));
  }
}

export function calculateUpdatedRecord({ currentRecord, finalScore, timeSpent, hardcore }) {
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

  return { updatedRecord, nextMaxScore, nextBestTime, nextGamesPlayed, isNewBestRun };
}

export function updateLocalScoresAndHistory({
  activeUserId,
  gameMode,
  finalScore,
  timeSpent,
  hardcore,
  lastScores,
  setLastScores,
  localGameHistory,
  setLocalGameHistory,
}) {
  const modeHistory = (Object.hasOwn(lastScores, gameMode) && lastScores[gameMode]) || [];
  const nextScores = { ...lastScores, [gameMode]: [...modeHistory, finalScore].slice(-3) };
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
}

export async function syncGameRecordToSupabase({
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
}) {
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
  } else if (upsertedProfileData && upsertedProfileData.username !== updatedProfile.username) {
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
