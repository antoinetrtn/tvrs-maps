import { countryDataMap } from "../data/gameData";
import { buildCursorPayload, conquestCursorStore } from "./conquestCursors";
import { normalizeRoomCode } from "./conquestLogic";
import { markRulesSeen } from "./useConquestRulesAutoOpen";

const PREVIEW_CODE = "TVRS42";
const PREVIEW_DURATION_SEC = 600;

function readPreviewOptions(loc = globalThis.location) {
  try {
    const q = new URLSearchParams(loc?.search || "");
    return {
      phase: (q.get("conquestPreview") || "lobby").trim().toLowerCase(),
      ready: q.get("ready") === "1",
      waiting: q.get("waiting") === "1",
      urgent: q.get("urgent") === "1",
      empty: q.get("empty") === "1",
      lockout: q.get("lockout") === "1",
      rules: q.get("rules") === "1",
      rematch: q.get("rematch") === "1",
      fortify: q.get("fortify") === "1",
      error: q.get("error") || "",
    };
  } catch {
    return {
      phase: "lobby",
      ready: false,
      waiting: false,
      urgent: false,
      empty: false,
      lockout: false,
      rules: false,
      rematch: false,
      fortify: false,
      error: "",
    };
  }
}

function computePreviewStartedAt(phase, baseMs) {
  if (phase === "lobby") return null;
  const offset = phase === "countdown" ? 4000 : -205000;
  return new Date(baseMs + offset).toISOString();
}

function computePreviewEndsAt(phase, baseMs, urgent) {
  if (phase === "lobby") return null;
  if (phase === "finished") return new Date(baseMs - 5000).toISOString();
  const offset = urgent ? 90000 : 395000;
  return new Date(baseMs + offset).toISOString();
}

function computePreviewStatus(phase) {
  if (phase === "lobby") return "lobby";
  if (phase === "finished") return "finished";
  return "live";
}

function computePreviewResult(isFinished) {
  if (!isFinished) return null;
  return {
    winner: "me",
    elo: {
      me: { delta: 16, after: 1048 },
      opp: { delta: -16, after: 984 },
    },
  };
}

function buildPreviewMatch(phase, baseMs, urgent, rematch = false) {
  if (phase === "idle" || phase === "home") return null;
  const isFinished = phase === "finished";

  return {
    id: "preview-match",
    code: PREVIEW_CODE,
    host_id: "me",
    region: "world",
    rules: { steal_fail_cooldown_seconds: 20 },
    max_players: 2,
    duration_seconds: PREVIEW_DURATION_SEC,
    status: computePreviewStatus(phase),
    started_at: computePreviewStartedAt(phase, baseMs),
    ends_at: computePreviewEndsAt(phase, baseMs, urgent),
    rematch_id: isFinished && rematch ? "preview-rematch-lobby" : null,
    result: computePreviewResult(isFinished),
  };
}

function buildPreviewPlayers(phase, displayName, opts) {
  const meReady = phase !== "lobby" || opts.ready;
  const list = [
    {
      user_id: "me",
      display_name: displayName || "antoine",
      color: "teal",
      pattern: "solid",
      score: phase === "lobby" ? 0 : 30,
      steals: phase === "lobby" ? 0 : 1,
      ready: meReady,
    },
  ];
  if (!opts.waiting) {
    list.push({
      user_id: "opp",
      display_name: "lea_k",
      color: "amber",
      pattern: "dots",
      score: phase === "lobby" ? 0 : 20,
      steals: 0,
      ready: true,
    });
  }
  return list;
}

const foldName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Preview answer → canonical country id (accepts French or English names, accents optional). */
export function resolvePreviewCountry(answer) {
  const key = foldName(answer);
  if (!key) return null;
  for (const [id, data] of Object.entries(countryDataMap)) {
    if (key === foldName(id) || key === foldName(data.name_en) || key === foldName(data.name_fr)) {
      return id;
    }
  }
  return null;
}

function buildPreviewClaims(phase, baseMs, empty) {
  if (empty || phase === "idle" || phase === "home" || phase === "lobby") return [];
  return [
    {
      country_id: "France",
      owner_id: "me",
      fortify_level: 1,
      shield_until: new Date(baseMs + 48000).toISOString(),
    },
    {
      country_id: "Germany",
      owner_id: "opp",
      fortify_level: 0,
      shield_until: new Date(baseMs + 12000).toISOString(),
    },
    {
      country_id: "Italy",
      owner_id: "opp",
      fortify_level: 0,
      shield_until: new Date(baseMs + 4000).toISOString(),
    },
    { country_id: "Spain", owner_id: "me", fortify_level: 0, shield_until: null },
    { country_id: "Portugal", owner_id: "me", fortify_level: 0, shield_until: null },
    { country_id: "Poland", owner_id: "opp", fortify_level: 0, shield_until: null },
    { country_id: "Egypt", owner_id: "opp", fortify_level: 0, shield_until: null },
    { country_id: "India", owner_id: "opp", fortify_level: 0, shield_until: null },
  ];
}

function buildPreviewEvents(phase, baseMs, empty, lockout) {
  if (empty || phase === "idle" || phase === "home" || phase === "lobby") return [];
  const isoAgo = (sec) => new Date(baseMs - sec * 1000).toISOString();
  const list = [
    { id: 1, kind: "capture", actor_id: "me", country_id: "France", created_at: isoAgo(120) },
    { id: 2, kind: "capture", actor_id: "opp", country_id: "Germany", created_at: isoAgo(95) },
    { id: 3, kind: "capture", actor_id: "me", country_id: "Spain", created_at: isoAgo(70) },
    { id: 4, kind: "capture", actor_id: "opp", country_id: "Italy", created_at: isoAgo(45) },
    { id: 5, kind: "capture", actor_id: "me", country_id: "Portugal", created_at: isoAgo(22) },
  ];
  if (lockout) {
    list.push({
      id: 6,
      kind: "steal_fail",
      actor_id: "me",
      country_id: "Germany",
      created_at: isoAgo(5),
    });
  }
  return list;
}

export function getPreviewConquestLeaderboard() {
  return {
    top: [
      {
        rank: 1,
        user_id: "p1",
        display_name: "atlas_one",
        elo: 1184,
        wins: 18,
        losses: 4,
        draws: 1,
        steals: 27,
      },
      {
        rank: 2,
        user_id: "me",
        display_name: "antoine",
        elo: 1048,
        wins: 9,
        losses: 3,
        draws: 1,
        steals: 14,
      },
      {
        rank: 3,
        user_id: "opp",
        display_name: "lea_k",
        elo: 984,
        wins: 6,
        losses: 5,
        draws: 0,
        steals: 9,
      },
    ],
    me: {
      rank: 2,
      user_id: "me",
      display_name: "antoine",
      elo: 1048,
      wins: 9,
      losses: 3,
      draws: 1,
      steals: 14,
    },
  };
}

/**
 * Local in-memory Conquest controller for `?conquestPreview=lobby|live|finished|idle`.
 * Never imported in production builds (guarded by `import.meta.env.DEV`).
 */
export function createConquestPreview({
  phase: rawPhase,
  displayName = "antoine",
  loc = globalThis.location,
  onChange,
} = {}) {
  const opts = readPreviewOptions(loc);
  const initialPhase = rawPhase || opts.phase || "lobby";
  if (!opts.rules) markRulesSeen();

  const baseMs = Date.now();
  let currentPhase = initialPhase === "home" ? "lobby" : initialPhase;
  let activeFortifyCountry = null;
  let state = {
    userId: "me",
    match: buildPreviewMatch(currentPhase, baseMs, opts.urgent, opts.rematch),
    players: buildPreviewPlayers(currentPhase, displayName, opts),
    claims: buildPreviewClaims(currentPhase, baseMs, opts.empty),
    events: buildPreviewEvents(currentPhase, baseMs, opts.empty, opts.lockout),
    bonuses: currentPhase === "finished" ? [{ user_id: "me", continent: "Europe", bonus: 5 }] : [],
    clockOffset: 0,
    online: ["me", "opp"],
    realtimeUp: true,
    error: opts.error,
    busy: false,
  };

  // Opponent cursor wanders between its countries (wire format via buildCursorPayload,
  // so it goes through the same sanitizer as real realtime messages).
  const cursorStops = [
    { lat: 51.1657, lng: 10.4515, country: "Germany" },
    { lat: 52.07, lng: 19.48, country: "Poland" },
    { lat: 42.8, lng: 12.6, country: "Italy" },
  ];
  let cursorStep = 0;
  const updateOpponentCursor = () => {
    if (currentPhase === "live") {
      const stop = cursorStops[cursorStep++ % cursorStops.length];
      conquestCursorStore.receive(buildCursorPayload("opp", stop), {
        selfId: "me",
        playerIds: new Set(["me", "opp"]),
        now: Date.now(),
      });
    }
  };
  updateOpponentCursor();
  const cursorTimer = setInterval(updateOpponentCursor, 2000);

  const emit = (patch) => {
    state = { ...state, ...patch };
    onChange?.(getSnapshot());
  };

  const setPhase = (nextPhase, extra = {}) => {
    currentPhase = nextPhase;
    const now = Date.now();
    if (nextPhase !== "live") conquestCursorStore.clear();
    else updateOpponentCursor();
    emit({
      match: buildPreviewMatch(nextPhase, now, opts.urgent, opts.rematch),
      players: buildPreviewPlayers(nextPhase, displayName, opts),
      claims: buildPreviewClaims(nextPhase, now, opts.empty),
      events: buildPreviewEvents(nextPhase, now, opts.empty, opts.lockout),
      bonuses: nextPhase === "finished" ? [{ user_id: "me", continent: "Europe", bonus: 5 }] : [],
      error: "",
      ...extra,
    });
  };

  const actions = {
    create: async () => setPhase("lobby"),
    join: async (rawCode) => {
      const code = normalizeRoomCode(rawCode);
      if (!code) {
        emit({ error: "Salon introuvable" });
        return null;
      }
      const match = { ...buildPreviewMatch("lobby", Date.now(), false, opts.rematch), code };
      setPhase("lobby", { match });
      return match;
    },
    resume: async () => false,
    setReady: async (ready) => {
      const players = state.players.map((p) => (p.user_id === "me" ? { ...p, ready } : p));
      emit({ players });
    },
    start: async () => setPhase("live"),
    claim: async (answer) => {
      const val = String(answer || "").trim();
      if (!val) return null;
      const countryId = resolvePreviewCountry(val);
      if (!countryId) return { ok: false, reason: "wrong" };
      const owned = state.claims.find((c) => c.owner_id !== "me" && c.country_id === countryId);
      if (owned) {
        return {
          ok: false,
          reason: "already_owned",
          country_id: owned.country_id,
          owner_id: owned.owner_id,
        };
      }
      const nextClaims = [...state.claims, { country_id: countryId, owner_id: "me" }];
      const nextEvents = [
        ...state.events,
        {
          id: state.events.length + 1,
          kind: "capture",
          actor_id: "me",
          country_id: countryId,
          created_at: new Date().toISOString(),
        },
      ];
      const nextPlayers = state.players.map((p) =>
        p.user_id === "me" ? { ...p, score: (p.score || 0) + 10 } : p
      );
      emit({ claims: nextClaims, events: nextEvents, players: nextPlayers });
      return { ok: true, country_id: countryId };
    },
    requestSteal: async (countryId) => ({
      ok: true,
      country_id: countryId,
      kind: "capital",
      expires_at: new Date(Date.now() + 20000).toISOString(),
    }),
    steal: async () => ({ ok: true, country_id: "Germany" }),
    cancelSteal: async () => null,
    requestFortify: async (countryId) => {
      activeFortifyCountry = countryId;
      const claim = state.claims.find((c) => c.country_id === countryId);
      const lvl = Number(claim?.fortify_level) || 0;
      const bonus = lvl === 0 ? 30 : 60;
      return {
        ok: true,
        country_id: countryId,
        mode: "fortify",
        kind: lvl === 0 ? "flag" : "capital",
        options: ["FR", "ES", "DE", "IT"],
        bonus_seconds: bonus,
        expires_at: new Date(Date.now() + 20000).toISOString(),
      };
    },
    fortify: async () => {
      const countryId = activeFortifyCountry || "France";
      const now = Date.now();
      const nextClaims = state.claims.map((c) => {
        if (c.country_id !== countryId) return c;
        const curLvl = Number(c.fortify_level) || 0;
        const nextLvl = Math.min(2, curLvl + 1);
        const bonusMs = (nextLvl === 1 ? 30 : 60) * 1000;
        const curUntil = c.shield_until ? new Date(c.shield_until).getTime() : now;
        const nextUntil = new Date(Math.max(now, curUntil) + bonusMs).toISOString();
        return { ...c, fortify_level: nextLvl, shield_until: nextUntil };
      });
      emit({ claims: nextClaims });
      return { ok: true, country_id: countryId };
    },
    cancelFortify: async () => null,
    countryTimeline: async (countryId) => ({
      country_id: countryId,
      locked: Boolean(state.claims.find((c) => c.country_id === countryId)?.locked),
      events: state.events.filter((e) => e.country_id === countryId),
    }),
    rematch: async () => {
      setPhase("lobby");
      const players = state.players.map((p) => ({ ...p, ready: true }));
      emit({ players });
      return state.match;
    },
    leave: () => {
      clearInterval(cursorTimer);
      conquestCursorStore.clear();
      setPhase("idle");
    },
    refresh: async () => {},
    sendCursor: () => {},
  };

  function getSnapshot() {
    return { ...state, ...actions };
  }

  return { getSnapshot, setPhase };
}
