import { supabase } from "../services/supabaseClient";

/** Returns the current auth user id, signing in anonymously for guests. */
export async function ensureConquestUser() {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user?.id) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return anon.user.id;
}

async function rpc(name, params) {
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

export const getConquestState = (matchId) => rpc("conquest_get_state", { p_match_id: matchId });

/**
 * Realtime room: Presence for the lobby (who is connected) and Broadcast to
 * tell the other players to resync after any validated server write.
 */
export function openConquestChannel(code, userId, { onSync, onPresence }) {
  const channel = supabase.channel(`conquest:${code}`, {
    config: { presence: { key: userId }, broadcast: { self: false } },
  });
  channel
    .on("broadcast", { event: "sync" }, (message) => onSync(message?.payload || {}))
    .on("presence", { event: "sync" }, () => onPresence(Object.keys(channel.presenceState())))
    .subscribe((status) => {
      if (status === "SUBSCRIBED") channel.track({ online_at: new Date().toISOString() });
    });
  return {
    notify: (payload = {}) => channel.send({ type: "broadcast", event: "sync", payload }),
    close: () => supabase.removeChannel(channel),
  };
}
