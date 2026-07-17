import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== "YOUR_SUPABASE_URL" &&
  supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY"
);

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

/**
 * Fetches user profile by ID.
 */
export async function getProfile(profileId) {
  if (!isSupabaseConfigured) return { data: null, error: new Error("Service non configuré") };
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .single();
    return { data, error };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Checks if a username is already taken by another profile.
 */
export async function isUsernameTaken(username, excludeProfileId = null) {
  if (!isSupabaseConfigured) return false;
  try {
    let query = supabase.from("profiles").select("id").eq("username", username);

    if (excludeProfileId) {
      query = query.filter("id", "neq", excludeProfileId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data.length > 0;
  } catch (err) {
    console.error("Erreur lors de la vérification du pseudo :", err);
    return false;
  }
}

/**
 * Creates or updates the user profile.
 */
export async function upsertProfile(
  profileId,
  username,
  avatarId,
  avatarColor,
  xp = 0,
  level = 1,
  unlockedBadges = []
) {
  if (!isSupabaseConfigured) return { data: null, error: new Error("Service non configuré") };
  try {
    const payload = {
      id: profileId,
      username,
      avatar_id: avatarId,
      avatar_color: avatarColor,
      xp,
      level,
      unlocked_badges: unlockedBadges,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("profiles").upsert(payload).select().single();

    return { data, error };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Submits a score entry to the global leaderboard.
 */
export async function submitLeaderboardScore(
  profileId,
  gameMode,
  score,
  timeSpentSeconds,
  hardcore = false
) {
  if (!isSupabaseConfigured) return { data: null, error: new Error("Service non configuré") };
  try {
    const insertRow = (row) => supabase.from("leaderboards").insert(row).select();
    const row = {
      profile_id: profileId,
      game_mode: gameMode,
      score,
      time_spent_seconds: timeSpentSeconds,
      hardcore,
    };
    let { data, error } = await insertRow(row);
    // Graceful fallback while the hardcore migration is not deployed yet.
    if (isMissingHardcoreColumn(error)) {
      const { hardcore: _hc, ...legacyRow } = row;
      ({ data, error } = await insertRow(legacyRow));
    }

    return { data, error };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Fetches global leaderboard scores for a given game mode.
 * Returns the top scores, including player profile info.
 */
/** True when the DB predates the hardcore migration (column not deployed yet). */
function isMissingHardcoreColumn(error) {
  return Boolean(error) && /hardcore/i.test(error.message || "");
}

export async function getLeaderboard(gameMode, limit = 50) {
  if (!isSupabaseConfigured) return { data: [], error: new Error("Service non configuré") };
  try {
    const fetchWith = (columns) =>
      supabase
        .from("user_records")
        .select(columns)
        .eq("game_mode", gameMode)
        .gt("max_score", 0)
        // Sort by max_score descending first, then best_time_seconds ascending (lower is better)
        .order("max_score", { ascending: false })
        .order("best_time_seconds", { ascending: true, nullsFirst: false })
        .limit(limit);

    const COLUMNS = `
        id,
        max_score,
        best_time_seconds,
        hardcore,
        profiles (
          id,
          username,
          avatar_id,
          avatar_color
        )
      `;
    let { data, error } = await fetchWith(COLUMNS);
    // Graceful fallback while the hardcore migration is not deployed yet.
    if (isMissingHardcoreColumn(error)) {
      ({ data, error } = await fetchWith(COLUMNS.replace("hardcore,", "")));
    }

    const mappedData = data
      ? data.map((row) => ({
          id: row.id,
          score: row.max_score,
          time_spent_seconds: row.best_time_seconds,
          hardcore: Boolean(row.hardcore),
          profiles: row.profiles,
        }))
      : [];

    return { data: mappedData, error };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

/**
 * Fetches the game history (all games played) for a specific profile.
 */
export async function getUserHistory(profileId, gameMode = null, limit = 50) {
  if (!isSupabaseConfigured) return { data: [], error: new Error("Service non configuré") };
  try {
    const fetchWith = (columns) => {
      let query = supabase.from("leaderboards").select(columns).eq("profile_id", profileId);
      if (gameMode) {
        query = query.eq("game_mode", gameMode);
      }
      return query.order("created_at", { ascending: false }).limit(limit);
    };

    const COLUMNS = `
        id,
        score,
        time_spent_seconds,
        created_at,
        game_mode,
        hardcore
      `;
    let { data, error } = await fetchWith(COLUMNS);
    // Graceful fallback while the hardcore migration is not deployed yet.
    if (isMissingHardcoreColumn(error)) {
      ({ data, error } = await fetchWith(COLUMNS.replace(",\n        hardcore", "")));
    }

    return { data, error };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

/**
 * Fetches the user records for a profile from database.
 */
export async function getUserRecords(profileId) {
  if (!isSupabaseConfigured) return { data: [], error: new Error("Service non configuré") };
  try {
    const { data, error } = await supabase
      .from("user_records")
      .select("*")
      .eq("profile_id", profileId);
    return { data, error };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

/**
 * Synchronizes local stats to Supabase by upserting records.
 */
export async function upsertUserRecord(
  profileId,
  gameMode,
  maxScore,
  bestTimeSeconds,
  gamesPlayed,
  hardcore = null
) {
  if (!isSupabaseConfigured) return { data: null, error: new Error("Service non configuré") };
  try {
    const payload = {
      profile_id: profileId,
      game_mode: gameMode,
      max_score: maxScore,
      games_played: gamesPlayed,
      updated_at: new Date().toISOString(),
    };
    if (bestTimeSeconds !== null) {
      payload.best_time_seconds = bestTimeSeconds;
    }
    // Only stamped when the best run changed — null keeps the stored flag.
    if (hardcore !== null) {
      payload.hardcore = hardcore;
    }
    const upsertRow = (row) =>
      supabase
        .from("user_records")
        .upsert(row, { onConflict: "profile_id,game_mode" })
        .select()
        .single();
    let { data, error } = await upsertRow(payload);
    // Graceful fallback while the hardcore migration is not deployed yet.
    if (isMissingHardcoreColumn(error)) {
      const { hardcore: _hc, ...legacyPayload } = payload;
      ({ data, error } = await upsertRow(legacyPayload));
    }
    return { data, error };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Supabase Auth Functions
 */

export async function signUpWithEmail(email, password) {
  if (!isSupabaseConfigured) return { data: null, error: new Error("Supabase non configuré") };
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured) return { data: null, error: new Error("Supabase non configuré") };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) return { data: null, error: new Error("Supabase non configuré") };
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function signOut() {
  if (!isSupabaseConfigured) return { error: new Error("Supabase non configuré") };
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (err) {
    return { error: err };
  }
}
