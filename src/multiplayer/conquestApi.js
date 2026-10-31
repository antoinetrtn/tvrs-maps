import { getSupabase } from "../services/supabaseClient";

/** Returns the current auth user id, signing in anonymously for guests. */
export async function ensureConquestUser() {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user?.id) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return anon.user.id;
}

/** Current auth user id without creating an anonymous account (resume path). */
export async function getExistingConquestUser() {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

async function rpc(name, params) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

export const createConquestMatch = (displayName, color) =>
  rpc("conquest_create_match", { p_display_name: displayName, p_color: color, p_pattern: null });

export const joinConquestMatch = (code, displayName, color, fallbackColor) =>
  rpc("conquest_join_match", {
    p_code: code,
    p_display_name: displayName,
    p_color: color,
    p_pattern: null,
    p_fallback_color: fallbackColor,
  });

export const setConquestReady = (matchId, ready) =>
  rpc("conquest_set_ready", { p_match_id: matchId, p_ready: ready });

export const startConquestMatch = (matchId) => rpc("conquest_start_match", { p_match_id: matchId });

export const claimConquestCountry = (matchId, answer) =>
  rpc("claim_country", { p_match_id: matchId, p_answer: answer });

export const requestStealChallenge = (matchId, countryId) =>
  rpc("conquest_steal_challenge", { p_match_id: matchId, p_country_id: countryId });

export const stealConquestCountry = (matchId, answer) =>
  rpc("steal_country", { p_match_id: matchId, p_answer: answer });

export const cancelStealChallenge = (matchId) =>
  rpc("conquest_cancel_steal", { p_match_id: matchId });

export const requestFortifyChallenge = (matchId, countryId) =>
  rpc("conquest_fortify_challenge", { p_match_id: matchId, p_country_id: countryId });

export const fortifyConquestCountry = (matchId, answer) =>
  rpc("conquest_fortify", { p_match_id: matchId, p_answer: answer });

export const cancelFortifyChallenge = (matchId) =>
  rpc("conquest_cancel_fortify", { p_match_id: matchId });

/** Rematch from the end screen: creates or joins the linked lobby, already ready. */
export const rematchConquestMatch = (matchId) => rpc("conquest_rematch", { p_match_id: matchId });

export const leaveConquestMatch = (matchId) => rpc("conquest_leave_match", { p_match_id: matchId });

/** Latest lobby/live match of the current user, or null. */
export async function getMyActiveConquestMatch() {
  const match = await rpc("conquest_my_active_match", {});
  return match?.id ? match : null;
}

/** Public Elo board: { top: [...], me: {...} | null }. */
export const getConquestLeaderboard = (limit = 50) =>
  rpc("conquest_leaderboard", { p_limit: limit });

export const getConquestState = (matchId) => rpc("conquest_get_state", { p_match_id: matchId });

/**
 * Realtime room: Presence for the lobby (who is connected) and Broadcast to
 * tell the other players to resync after any validated server write.
 */
export function openConquestChannel(code, userId, { onSync, onPresence, onStatus, onCursor }) {
  let activeClient = null;
  let channel = null;
  let closed = false;

  const ready = getSupabase()
    .then((supabase) => {
      if (closed || !supabase) return null;
      activeClient = supabase;
      channel = supabase.channel(`conquest:${code}`, {
        config: { presence: { key: userId }, broadcast: { self: false } },
      });
      channel
        .on("broadcast", { event: "sync" }, (message) => onSync(message?.payload || {}))
        .on("presence", { event: "sync" }, () => onPresence(Object.keys(channel.presenceState())))
        // Spatial cursors: ephemeral camera positions, never persisted.
        .on("broadcast", { event: "cursor" }, (message) => onCursor?.(message?.payload || {}))
        .subscribe((status) => {
          onStatus?.(status);
          if (status === "SUBSCRIBED") channel.track({ online_at: new Date().toISOString() });
        });
      return channel;
    })
    .catch(() => null);

  const send = (event, payload) =>
    channel
      ? channel.send({ type: "broadcast", event, payload })
      : ready.then((ch) => ch?.send({ type: "broadcast", event, payload }));

  return {
    notify: (payload = {}) => send("sync", payload),
    sendCursor: (payload) => send("cursor", payload),
    close: () => {
      closed = true;
      if (activeClient && channel) activeClient.removeChannel(channel);
    },
  };
}
