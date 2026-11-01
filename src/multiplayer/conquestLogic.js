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

/**
 * Keeps the offset measured with the lowest latency among the last samples
 * ({ offset, latency }), so one slow response does not make the timer jump.
 */
export function pickClockOffset(samples = []) {
  if (samples.length === 0) return 0;
  return samples.reduce(
    (best, sample) => (sample.latency < best.latency ? sample : best),
    samples[0]
  ).offset;
}

/** True when `next` state is older than what is already shown (out-of-order reply). */
export function isStaleState(current, next) {
  if (!current?.match || !next?.match || current.match.id !== next.match.id) return false;
  return (next.version ?? 0) < (current.version ?? 0);
}

/**
 * Elo change of `userId` stored in the server result, or null when the match
 * was not rated (guest, forfeit during the countdown…).
 */
export function eloChange(result, userId) {
  const entry = result?.elo?.[userId];
  if (!entry) return null;
  return { delta: entry.delta, after: entry.after };
}

/** "+16" / "-8" / "±0". */
export function formatEloDelta(delta) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "±0";
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
/**
 * Countries greyed out for me after a failed steal: the server refuses a new
 * steal on that country for `steal_fail_cooldown_seconds` (20 s) and blocks
 * me entirely until my `penalty_until`. Returns [{ id, ms }] still running.
 */
export function stealLockouts(
  { events = [], players = [], userId, rules } = {},
  clientNowMs = Date.now(),
  offsetMs = 0
) {
  const cooldownMs = (Number(rules?.steal_fail_cooldown_seconds) || 20) * 1000;
  const me = players.find((player) => player.user_id === userId);
  const penaltyMs = me?.penalty_until ? remainingMs(me.penalty_until, clientNowMs, offsetMs) : 0;
  const latest = {};
  for (const event of events) {
    if (event.kind !== "steal_fail" || event.actor_id !== userId || !event.country_id) continue;
    const endsAt = new Date(event.created_at).getTime() + cooldownMs;
    latest[event.country_id] = Math.max(latest[event.country_id] || 0, endsAt);
  }
  return Object.entries(latest)
    .map(([id, endsAt]) => ({
      id,
      ms: Math.max(remainingMs(new Date(endsAt).toISOString(), clientNowMs, offsetMs), penaltyMs),
    }))
    .filter((lock) => lock.ms > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildConquestOverlay(claims = [], players = [], shieldedIds = [], lockedIds = []) {
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
  for (const id of lockedIds) colors[id] = CONQUEST_PLAYER_COLORS.locked;
  // Unclaimed countries share one neutral tone (never a player colour).
  return { colors, strokes, rings, neutral: CONQUEST_PLAYER_COLORS.neutral };
}

/**
 * What a click on a country means for `userId`: "free" (type it to capture),
 * "mine", "shielded" (owned by an opponent, shield up) or "steal".
 */
export function resolveCountryClick(countryId, claims, userId, clientNowMs, offsetMs) {
  const claim = (claims || []).find((c) => c.country_id === countryId);
  if (!claim) return "free";
  if (claim.locked) return "locked";
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
export function computeWinner(players = [], claims = [], bonuses = [], result = null) {
  // Server result (stored at close / forfeit) wins over the local recomputation.
  if (result && "winner" in result) {
    return players.find((player) => player.user_id === result.winner) || null;
  }
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

const FEED_EVENT_FORMATTERS = {
  capture: (event, { who, country, fr }) =>
    fr ? `${who} a capturé ${country}` : `${who} captured ${country}`,
  steal: (event, { who, country, fr, players }) => {
    const victim = players.find((player) => player.user_id === event.payload?.victim);
    const from = victim?.display_name || "?";
    return fr ? `${who} a volé ${country} à ${from}` : `${who} stole ${country} from ${from}`;
  },
  lock: (event, { who, country, fr }) =>
    fr ? `${country} reste à ${who} pour de bon` : `${country} stays with ${who} for good`,
  steal_fail: (event, { who, country, fr }) =>
    fr ? `${who} a raté le vol de ${country}` : `${who} failed to steal ${country}`,
  join: (event, { who, fr }) => (fr ? `${who} a rejoint le salon` : `${who} joined the room`),
  start: (event, { fr }) => (fr ? "La partie commence !" : "The match begins!"),
  finish: (event, { fr }) => (fr ? "Fin de la partie" : "Match over"),
  leave: (event, { who, fr }) => (fr ? `${who} a quitté le salon` : `${who} left the room`),
  forfeit: (event, { who, fr }) => (fr ? `${who} a abandonné la partie` : `${who} forfeited`),
};

/** Turns a server event into a feed line, or null when it is not worth showing. */
export function formatFeedEvent(event, { players = [], countryName = (id) => id, lang = "fr" }) {
  const kind = event?.kind;
  if (!Object.hasOwn(FEED_EVENT_FORMATTERS, kind)) return null;
  const formatter = FEED_EVENT_FORMATTERS[kind];
  const actor = players.find((player) => player.user_id === event.actor_id);
  const fr = lang === "fr";
  const who = actor?.display_name || (fr ? "Un joueur" : "A player");
  const country = countryName(event.country_id);
  return formatter(event, { who, country, fr, players });
}

const formatChangedRefusal = (name, fr) =>
  fr ? `${name || "Ce pays"} a changé de mains` : `${name || "This country"} changed hands`;

const CLAIM_REFUSAL_HANDLERS = {
  already_yours: ({ name, fr }) => (fr ? `${name} est déjà à toi` : `${name} is already yours`),
  already_owned: ({ name, fr, players, result }) => {
    const owner = players.find((player) => player.user_id === result.owner_id);
    const by = owner?.display_name || (fr ? "l'adversaire" : "your opponent");
    return fr ? `${name} est déjà pris par ${by}` : `${name} is already held by ${by}`;
  },
  unknown: ({ fr }) => (fr ? "Pays inconnu" : "Unknown country"),
  shielded: ({ name, fr }) => (fr ? `${name} est sous bouclier` : `${name} is shielded`),
  locked: ({ name, fr }) =>
    fr
      ? `${name} est verrouillé : plus de questions, il reste à son propriétaire`
      : `${name} is locked: no questions left, it stays with its owner`,
  cooldown: ({ name, fr }) =>
    fr ? `Attends avant de re-voler ${name}` : `Wait before stealing ${name} again`,
  penalty: ({ fr }) => (fr ? "Pénalité en cours, patiente un instant" : "Penalty: wait a moment"),
  wrong: ({ name, fr }) =>
    fr ? `Vol raté sur ${name} (pénalité)` : `Steal failed on ${name} (penalty)`,
  abandoned: ({ fr }) =>
    fr ? "Vol abandonné : compte comme un échec" : "Steal abandoned: counts as a failure",
  rate_limited: ({ fr }) => (fr ? "Trop rapide, réessaie" : "Too fast, try again"),
  expired: ({ fr }) => (fr ? "Défi expiré" : "Challenge expired"),
  free: ({ name, fr }) => formatChangedRefusal(name, fr),
  changed: ({ name, fr }) => formatChangedRefusal(name, fr),
  no_challenge: ({ name, fr }) => formatChangedRefusal(name, fr),
  not_live: ({ fr }) => (fr ? "La partie n'a pas commencé" : "The match has not started"),
  finished: ({ fr }) => (fr ? "La partie est terminée" : "The match is over"),
};

/** Human-readable message for a claim_country refusal. */
export function describeClaimRefusal(
  result,
  { players = [], countryName = (id) => id, lang = "fr" }
) {
  const fr = lang === "fr";
  const name = result?.country_id ? countryName(result.country_id) : "";
  if (result?.mode === "fortify") {
    const fortify = describeFortifyRefusal(result.reason, name, fr);
    if (fortify) return fortify;
  }
  const reason = result?.reason;
  if (Object.hasOwn(CLAIM_REFUSAL_HANDLERS, reason)) {
    return CLAIM_REFUSAL_HANDLERS[reason]({ name, fr, players, result });
  }
  return fr ? "Réponse refusée" : "Answer rejected";
}

function describeFortifyRefusal(reason, name, fr) {
  switch (reason) {
    case "wrong":
      return fr ? `Renfort raté sur ${name}` : `Reinforcement failed on ${name}`;
    case "cooldown":
      return fr ? `Attends avant de renforcer ${name}` : `Wait before reinforcing ${name}`;
    case "max_fortified":
      return fr ? `${name} est déjà au maximum` : `${name} is already fully reinforced`;
    case "not_yours":
    case "changed":
      return fr
        ? `${name || "Ce pays"} n'est plus à toi`
        : `${name || "This country"} is no longer yours`;
    default:
      return null;
  }
}

/** Fortify steps (server rules mirror): step 1 → +30 s, step 2 → +60 s. */
/**
 * Running shields for the globe countdown: [{ id, ms, level, mine, ownerId }],
 * soonest first. `level` = fortify steps done (0 after a capture).
 */
export function shieldCountdowns(
  claims = [],
  userId = null,
  clientNowMs = Date.now(),
  offsetMs = 0
) {
  return claims
    .map((claim) => ({
      id: claim.country_id,
      ownerId: claim.owner_id,
      mine: claim.owner_id === userId,
      level: Number(claim.fortify_level) || 0,
      ms: claim.shield_until ? remainingMs(claim.shield_until, clientNowMs, offsetMs) : 0,
    }))
    .filter((shield) => shield.ms > 0)
    .sort((a, b) => a.ms - b.ms || a.id.localeCompare(b.id));
}

/** Seconds label for a shield countdown: "1:05" above a minute, "42" below. */
export function formatShieldSeconds(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return String(total);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * End-screen rematch state: "offer" (no rematch yet), "join" (an opponent
 * already opened one — joining makes me ready), or null when not finished.
 */
export function rematchState(match) {
  if (match?.status !== "finished") return null;
  return match.rematch_id ? "join" : "offer";
}

const RPC_ERROR_PATTERNS = [
  { match: ["match_not_found"], fr: "Salon introuvable", en: "Room not found" },
  { match: ["match_full"], fr: "Salon complet", en: "Room is full" },
  {
    match: ["match_expired", "match_finished"],
    fr: "Ce salon a expiré",
    en: "This room has expired",
  },
  {
    match: ["match_already_started"],
    fr: "La partie a déjà commencé",
    en: "The match already started",
  },
  {
    match: ["players_not_ready"],
    fr: "Tous les joueurs doivent être prêts",
    en: "Every player must be ready",
  },
  {
    match: ["match_not_finished"],
    fr: "La partie n'est pas terminée",
    en: "The match is not over yet",
  },
  // RPC missing on the server: the migration is not applied yet.
  {
    match: ["Could not find the function", "PGRST202"],
    fr: "Fonction pas encore disponible sur le serveur",
    en: "Not available on the server yet",
  },
  { match: ["not_host"], fr: "Seul l'hôte peut lancer", en: "Only the host can start" },
];

function findRpcErrorMatch(message) {
  return RPC_ERROR_PATTERNS.find((pattern) => pattern.match.some((sub) => message.includes(sub)));
}

/** Maps RPC error messages to user-facing text. */
export function describeRpcError(error, lang = "fr") {
  const fr = lang === "fr";
  const message = String(error?.message || error || "");
  const pattern = findRpcErrorMatch(message);
  if (pattern) return fr ? pattern.fr : pattern.en;
  return fr ? "Connexion au serveur impossible" : "Could not reach the server";
}
