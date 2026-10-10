import { CONQUEST_PLAYER_COLORS } from "../config/designSystem";

/**
 * Pure helpers for the « Conquête » multiplayer mode (no React, no Supabase).
 * The server stays authoritative; these only shape data for display.
 */

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

/** Player palette (atlas tones) — each entry pairs a colour with a pattern for colour-blind play. */
const CONQUEST_PALETTE = [
  { id: "teal", hex: CONQUEST_PLAYER_COLORS.teal, pattern: "solid" },
  { id: "amber", hex: CONQUEST_PLAYER_COLORS.amber, pattern: "dots" },
  { id: "red", hex: CONQUEST_PLAYER_COLORS.red, pattern: "hatch" },
  { id: "green", hex: CONQUEST_PLAYER_COLORS.green, pattern: "cross" },
];

export const getPaletteEntry = (colorId) =>
  CONQUEST_PALETTE.find((entry) => entry.id === colorId) || CONQUEST_PALETTE[0];

/** Uppercases, strips separators and ambiguous chars; returns "" when not a plausible code. */
export function normalizeRoomCode(raw) {
  const code = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (code.length !== ROOM_CODE_LENGTH) return "";
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return "";
  }
  return code;
}

/** Offset (ms) to add to Date.now() to approximate server time. */
export function computeClockOffset(serverNowIso, clientNowMs) {
  const serverMs = Date.parse(serverNowIso);
  if (!Number.isFinite(serverMs)) return 0;
  return serverMs - clientNowMs;
}

/** Remaining ms before `isoTarget` using the server clock offset; never negative. */
export function remainingMs(isoTarget, clientNowMs, offsetMs = 0) {
  const target = Date.parse(isoTarget);
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, target - (clientNowMs + offsetMs));
}

/** "m:ss" clock for a duration in ms (rounded up so 0:00 means really over). */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Map countryId -> hex colour of its owner, for globe painting. */
export function buildOwnershipColors(claims = [], players = []) {
  const colorByUser = {};
  for (const player of players) colorByUser[player.user_id] = getPaletteEntry(player.color).hex;
  const colors = {};
  for (const claim of claims) {
    const hex = colorByUser[claim.owner_id];
    if (hex) colors[claim.country_id] = hex;
  }
  return colors;
}

/** Standings: score desc, then countries held desc, then earliest joiner. */
export function computeStandings(players = [], claims = []) {
  const held = {};
  for (const claim of claims) held[claim.owner_id] = (held[claim.owner_id] || 0) + 1;
  return players
    .map((player, joinOrder) => ({
      ...player,
      countries: held[player.user_id] || 0,
      joinOrder,
    }))
    .sort(
      (a, b) =>
        (b.score || 0) - (a.score || 0) || b.countries - a.countries || a.joinOrder - b.joinOrder
    );
}

/** Winner of a finished match, or null on a perfect tie (same score and countries). */
export function computeWinner(players = [], claims = []) {
  const standings = computeStandings(players, claims);
  if (standings.length === 0) return null;
  const [first, second] = standings;
  if (second && first.score === second.score && first.countries === second.countries) return null;
  return first;
}

/** Derived phase from server status + clock: lobby | countdown | live | finished. */
export function deriveMatchPhase(match, clientNowMs, offsetMs = 0) {
  if (!match) return "idle";
  if (match.status === "finished") return "finished";
  if (match.status === "lobby") return "lobby";
  if (remainingMs(match.started_at, clientNowMs, offsetMs) > 0) return "countdown";
  if (remainingMs(match.ends_at, clientNowMs, offsetMs) <= 0) return "finished";
  return "live";
}

/** Turns a server event into a feed line, or null when it is not worth showing. */
export function formatFeedEvent(event, { players = [], countryName = (id) => id, lang = "fr" }) {
  const actor = players.find((player) => player.user_id === event.actor_id);
  const who = actor?.display_name || (lang === "fr" ? "Un joueur" : "A player");
  const fr = lang === "fr";
  switch (event.kind) {
    case "capture":
      return fr
        ? `${who} a capturé ${countryName(event.country_id)}`
        : `${who} captured ${countryName(event.country_id)}`;
    case "join":
      return fr ? `${who} a rejoint le salon` : `${who} joined the room`;
    case "start":
      return fr ? "La partie commence !" : "The match begins!";
    case "finish":
      return fr ? "Fin de la partie" : "Match over";
    default:
      return null;
  }
}

/** Human-readable message for a claim_country refusal. */
export function describeClaimRefusal(
  result,
  { players = [], countryName = (id) => id, lang = "fr" }
) {
  const fr = lang === "fr";
  const name = result?.country_id ? countryName(result.country_id) : "";
  switch (result?.reason) {
    case "already_yours":
      return fr ? `${name} est déjà à toi` : `${name} is already yours`;
    case "already_owned": {
      const owner = players.find((player) => player.user_id === result.owner_id);
      const by = owner?.display_name || (fr ? "l'adversaire" : "your opponent");
      return fr ? `${name} est déjà pris par ${by}` : `${name} is already held by ${by}`;
    }
    case "unknown":
      return fr ? "Pays inconnu" : "Unknown country";
    case "not_live":
      return fr ? "La partie n'a pas commencé" : "The match has not started";
    case "finished":
      return fr ? "La partie est terminée" : "The match is over";
    default:
      return fr ? "Réponse refusée" : "Answer rejected";
  }
}

/** Maps RPC error messages to user-facing text. */
export function describeRpcError(error, lang = "fr") {
  const fr = lang === "fr";
  const message = String(error?.message || error || "");
  if (message.includes("match_not_found")) return fr ? "Salon introuvable" : "Room not found";
  if (message.includes("match_full")) return fr ? "Salon complet" : "Room is full";
  if (message.includes("match_already_started"))
    return fr ? "La partie a déjà commencé" : "The match already started";
  if (message.includes("players_not_ready"))
    return fr ? "Tous les joueurs doivent être prêts" : "Every player must be ready";
  if (message.includes("not_host"))
    return fr ? "Seul l'hôte peut lancer" : "Only the host can start";
  return fr ? "Connexion au serveur impossible" : "Could not reach the server";
}
