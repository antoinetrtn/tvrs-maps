import { CONQUEST_PLAYER_COLORS } from "../config/designSystem";
import { countryDataMap } from "../data/gameData";

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

/** Ids of countries whose shield is still up (sorted, stable for memo keys). */
export function shieldedCountryIds(claims = [], clientNowMs = Date.now(), offsetMs = 0) {
  return claims
    .filter(
      (claim) => claim.shield_until && remainingMs(claim.shield_until, clientNowMs, offsetMs) > 0
    )
    .map((claim) => claim.country_id)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Globe overlay: owner colour per country, an ink outline for patterned
 * players (colour-blind cue) and a slow ring on shielded countries.
 */
export function buildConquestOverlay(claims = [], players = [], shieldedIds = []) {
  const byUser = {};
  for (const player of players) byUser[player.user_id] = getPaletteEntry(player.color);
  const colors = {};
  const strokes = {};
  for (const claim of claims) {
    const entry = byUser[claim.owner_id];
    if (!entry) continue;
    colors[claim.country_id] = entry.hex;
    if (entry.pattern !== "solid") strokes[claim.country_id] = CONQUEST_PLAYER_COLORS.ink;
  }
  const owners = Object.fromEntries(claims.map((claim) => [claim.country_id, claim.owner_id]));
  const rings = shieldedIds
    .map((id) => ({ id, data: countryDataMap[id], entry: byUser[owners[id]] }))
    .filter(({ data, entry }) => entry && Number.isFinite(data?.lat) && Number.isFinite(data?.lng))
    .map(({ data, entry }) => ({
      lat: data.lat,
      lng: data.lng,
      color: entry.hex,
      maxRadius: 2.4,
      speed: 1.2,
      repeat: 1400,
    }));
  return { colors, strokes, rings };
}

/**
 * What a click on a country means for `userId`: "free" (type it to capture),
 * "mine", "shielded" (owned by an opponent, shield up) or "steal".
 */
export function resolveCountryClick(countryId, claims, userId, clientNowMs, offsetMs) {
  const claim = (claims || []).find((c) => c.country_id === countryId);
  if (!claim) return "free";
  if (claim.owner_id === userId) return "mine";
  if (claim.shield_until && remainingMs(claim.shield_until, clientNowMs, offsetMs || 0) > 0) {
    return "shielded";
  }
  return "steal";
}

/** Sum of continent bonuses per user from the server `bonuses` rows. */
function sumBonuses(bonuses = []) {
  const total = {};
  for (const row of bonuses) total[row.user_id] = (total[row.user_id] || 0) + (row.bonus || 0);
  return total;
}

/** Standings: total (score + continent bonus) desc, then countries, then steals, then join order. */
export function computeStandings(players = [], claims = [], bonuses = []) {
  const held = {};
  for (const claim of claims) held[claim.owner_id] = (held[claim.owner_id] || 0) + 1;
  const bonusByUser = sumBonuses(bonuses);
  return players
    .map((player, joinOrder) => {
      const bonus = bonusByUser[player.user_id] || 0;
      return {
        ...player,
        bonus,
        total: (player.score || 0) + bonus,
        countries: held[player.user_id] || 0,
        joinOrder,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.countries - a.countries ||
        (b.steals || 0) - (a.steals || 0) ||
        a.joinOrder - b.joinOrder
    );
}

/** Winner of a finished match, or null on a perfect tie (same total, countries and steals). */
export function computeWinner(players = [], claims = [], bonuses = []) {
  const standings = computeStandings(players, claims, bonuses);
  if (standings.length === 0) return null;
  const [first, second] = standings;
  const tied =
    second &&
    first.total === second.total &&
    first.countries === second.countries &&
    (first.steals || 0) === (second.steals || 0);
  if (tied) return null;
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
    case "steal": {
      const victim = players.find((player) => player.user_id === event.payload?.victim);
      const from = victim?.display_name || "?";
      return fr
        ? `${who} a volé ${countryName(event.country_id)} à ${from}`
        : `${who} stole ${countryName(event.country_id)} from ${from}`;
    }
    case "steal_fail":
      return fr
        ? `${who} a raté le vol de ${countryName(event.country_id)}`
        : `${who} failed to steal ${countryName(event.country_id)}`;
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
    case "shielded":
      return fr ? `${name} est sous bouclier` : `${name} is shielded`;
    case "cooldown":
      return fr ? `Attends avant de re-voler ${name}` : `Wait before stealing ${name} again`;
    case "penalty":
      return fr ? "Pénalité : 3 s sans saisie" : "Penalty: 3 s lockout";
    case "wrong":
      return fr
        ? `Vol raté sur ${name} (3 s de pénalité)`
        : `Steal failed on ${name} (3 s penalty)`;
    case "expired":
      return fr ? "Défi expiré" : "Challenge expired";
    case "free":
    case "changed":
    case "no_challenge":
      return fr
        ? `${name || "Ce pays"} a changé de mains`
        : `${name || "This country"} changed hands`;
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
