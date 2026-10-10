import { useCallback, useEffect, useRef, useState } from "react";

import {
  cancelStealChallenge,
  claimConquestCountry,
  createConquestMatch,
  ensureConquestUser,
  getConquestState,
  getExistingConquestUser,
  getMyActiveConquestMatch,
  joinConquestMatch,
  leaveConquestMatch,
  openConquestChannel,
  requestStealChallenge,
  setConquestReady,
  startConquestMatch,
  stealConquestCountry,
} from "./conquestApi";
import {
  computeClockOffset,
  describeRpcError,
  isStaleState,
  normalizeRoomCode,
  pickClockOffset,
} from "./conquestLogic";

/** Fast resync while Realtime is down, slow safety net once subscribed. */
const RESYNC_DEGRADED_MS = 5000;
const RESYNC_REALTIME_MS = 15000;
const SYNC_DEBOUNCE_MS = 250;
const CLOCK_SAMPLES = 5;
export const CONQUEST_STORAGE_KEY = "tvrs-conquest-match";
const EMPTY_STATE = { match: null, players: [], claims: [], events: [], bonuses: [], version: 0 };

const storage = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(CONQUEST_STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  },
  write(match) {
    try {
      localStorage.setItem(
        CONQUEST_STORAGE_KEY,
        JSON.stringify({ id: match.id, code: match.code })
      );
    } catch {
      /* private mode: resume simply won't be offered */
    }
  },
  clear() {
    try {
      localStorage.removeItem(CONQUEST_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** True when a match was in progress before the last reload. */
export const hasStoredConquestMatch = () => Boolean(storage.read()?.id);

/** Lobby + live match state for the « Conquête » mode (server authoritative). */
export function useConquestMatch({ lang, displayName }) {
  const [userId, setUserId] = useState(null);
  const [state, setState] = useState(EMPTY_STATE);
  const [clockOffset, setClockOffset] = useState(0);
  const [online, setOnline] = useState([]);
  const [realtimeUp, setRealtimeUp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const channelRef = useRef(null);
  const matchIdRef = useRef(null);
  const stateRef = useRef(EMPTY_STATE);
  const clockSamplesRef = useRef([]);
  const syncTimerRef = useRef(null);

  const applyState = useCallback((next) => {
    if (isStaleState(stateRef.current, next)) return; // out-of-order reply
    stateRef.current = next;
    setState(next);
  }, []);

  const refresh = useCallback(async () => {
    const matchId = matchIdRef.current;
    if (!matchId) return;
    try {
      const sentAt = Date.now();
      const next = await getConquestState(matchId);
      if (matchIdRef.current !== matchId || !next) return;
      const latency = (Date.now() - sentAt) / 2;
      const samples = [
        ...clockSamplesRef.current,
        { offset: computeClockOffset(next.server_now, sentAt + latency), latency },
      ].slice(-CLOCK_SAMPLES);
      clockSamplesRef.current = samples;
      setClockOffset(pickClockOffset(samples));
      applyState({
        match: next.match,
        players: next.players || [],
        claims: next.claims || [],
        events: next.events || [],
        bonuses: next.bonuses || [],
        version: next.version ?? 0,
      });
    } catch (err) {
      setError(describeRpcError(err, lang));
    }
  }, [lang, applyState]);

  // Broadcast bursts (or a spammer on the room code) collapse into one fetch.
  const scheduleRefresh = useCallback(() => {
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(refresh, SYNC_DEBOUNCE_MS);
  }, [refresh]);

  const openChannel = useCallback(
    (match, uid) => {
      channelRef.current?.close();
      setRealtimeUp(false);
      channelRef.current = openConquestChannel(match.code, uid, {
        onSync: scheduleRefresh,
        onPresence: setOnline,
        onStatus: (status) => setRealtimeUp(status === "SUBSCRIBED"),
      });
    },
    [scheduleRefresh]
  );

  const enterMatch = useCallback(
    (match, uid) => {
      matchIdRef.current = match.id;
      clockSamplesRef.current = [];
      stateRef.current = { ...EMPTY_STATE, match };
      storage.write(match);
      openChannel(match, uid);
      setState(stateRef.current);
      return refresh();
    },
    [refresh, openChannel]
  );

  const run = useCallback(
    async (action) => {
      setBusy(true);
      setError("");
      try {
        return await action();
      } catch (err) {
        setError(describeRpcError(err, lang));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [lang]
  );

  const create = useCallback(
    () =>
      run(async () => {
        const uid = await ensureConquestUser();
        setUserId(uid);
        const match = await createConquestMatch(displayName, "teal");
        await enterMatch(match, uid);
      }),
    [run, displayName, enterMatch]
  );

  const join = useCallback(
    (rawCode) =>
      run(async () => {
        const code = normalizeRoomCode(rawCode);
        if (!code) throw new Error("match_not_found");
        const uid = await ensureConquestUser();
        setUserId(uid);
        const match = await joinConquestMatch(code, displayName, "amber", "red");
        await enterMatch(match, uid);
        channelRef.current?.notify({ kind: "join" });
      }),
    [run, displayName, enterMatch]
  );

  /** Re-enters the lobby/live match after a reload. Resolves to true on success. */
  const resume = useCallback(async () => {
    if (!hasStoredConquestMatch()) return false;
    try {
      const uid = await getExistingConquestUser();
      const match = uid ? await getMyActiveConquestMatch() : null;
      if (!match) {
        storage.clear();
        return false;
      }
      setUserId(uid);
      await enterMatch(match, uid);
      return true;
    } catch {
      storage.clear();
      return false;
    }
  }, [enterMatch]);

  const notifyAndRefresh = useCallback(
    async (kind) => {
      channelRef.current?.notify({ kind });
      await refresh();
    },
    [refresh]
  );

  const setReady = useCallback(
    (ready) =>
      run(async () => {
        await setConquestReady(matchIdRef.current, ready);
        await notifyAndRefresh("ready");
      }),
    [run, notifyAndRefresh]
  );

  const start = useCallback(
    () =>
      run(async () => {
        await startConquestMatch(matchIdRef.current);
        await notifyAndRefresh("start");
      }),
    [run, notifyAndRefresh]
  );

  /** Runs a game RPC; resolves to the server verdict ({ ok, reason, country_id, ... }). */
  const callGame = useCallback(
    async (rpcCall, kind) => {
      if (!matchIdRef.current) return null;
      try {
        const result = await rpcCall(matchIdRef.current);
        if (result?.ok && kind) await notifyAndRefresh(kind);
        else if (result?.penalty_until) await notifyAndRefresh("steal_fail");
        else if (result && !result.ok) await refresh();
        return result;
      } catch (err) {
        setError(describeRpcError(err, lang));
        return null;
      }
    },
    [lang, notifyAndRefresh, refresh]
  );

  const claim = useCallback(
    (answer) => callGame((id) => claimConquestCountry(id, answer), "capture"),
    [callGame]
  );
  const requestSteal = useCallback(
    (countryId) => callGame((id) => requestStealChallenge(id, countryId), null),
    [callGame]
  );
  const steal = useCallback(
    (answer) => callGame((id) => stealConquestCountry(id, answer), "steal"),
    [callGame]
  );
  const cancelSteal = useCallback(
    () => callGame((id) => cancelStealChallenge(id), null),
    [callGame]
  );

  const reset = useCallback(() => {
    clearTimeout(syncTimerRef.current);
    channelRef.current?.close();
    channelRef.current = null;
    matchIdRef.current = null;
    stateRef.current = EMPTY_STATE;
    storage.clear();
    setState(EMPTY_STATE);
    setOnline([]);
    setError("");
  }, []);

  /** Leaves on the server too (lobby: host handover; live: forfeit), then resets. */
  const leave = useCallback(() => {
    const matchId = matchIdRef.current;
    const status = stateRef.current.match?.status;
    if (matchId && status !== "finished") {
      channelRef.current?.notify({ kind: "leave" });
      leaveConquestMatch(matchId).catch(() => {});
    }
    reset();
  }, [reset]);

  // Safety net: periodic resync (missed broadcasts, server-side timer end).
  const status = state.match?.status;
  useEffect(() => {
    if (!status || status === "finished") return undefined;
    const id = setInterval(refresh, realtimeUp ? RESYNC_REALTIME_MS : RESYNC_DEGRADED_MS);
    return () => clearInterval(id);
  }, [status, refresh, realtimeUp]);

  // Back from a sleeping tab / network loss: resync now and revive the channel.
  useEffect(() => {
    if (!status || status === "finished") return undefined;
    const wake = () => {
      if (document.visibilityState === "hidden") return;
      refresh();
      const match = stateRef.current.match;
      if (!realtimeUp && match && userId) openChannel(match, userId);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [status, refresh, realtimeUp, openChannel, userId]);

  // A finished match no longer needs resuming.
  useEffect(() => {
    if (status === "finished") storage.clear();
  }, [status]);

  useEffect(
    () => () => {
      clearTimeout(syncTimerRef.current);
      channelRef.current?.close();
    },
    []
  );

  return {
    userId,
    ...state,
    clockOffset,
    online,
    realtimeUp,
    error,
    busy,
    create,
    join,
    resume,
    setReady,
    start,
    claim,
    requestSteal,
    steal,
    cancelSteal,
    leave,
    refresh,
  };
}
