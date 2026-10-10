import { useCallback, useEffect, useRef, useState } from "react";

import {
  claimConquestCountry,
  createConquestMatch,
  ensureConquestUser,
  getConquestState,
  joinConquestMatch,
  openConquestChannel,
  requestStealChallenge,
  setConquestReady,
  startConquestMatch,
  stealConquestCountry,
} from "./conquestApi";
import { computeClockOffset, describeRpcError, normalizeRoomCode } from "./conquestLogic";

const RESYNC_INTERVAL_MS = 5000;
const EMPTY_STATE = { match: null, players: [], claims: [], events: [], bonuses: [] };

/** Lobby + live match state for the « Conquête » mode (server authoritative). */
export function useConquestMatch({ lang, displayName }) {
  const [userId, setUserId] = useState(null);
  const [state, setState] = useState(EMPTY_STATE);
  const [clockOffset, setClockOffset] = useState(0);
  const [online, setOnline] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const channelRef = useRef(null);
  const matchIdRef = useRef(null);

  const refresh = useCallback(async () => {
    const matchId = matchIdRef.current;
    if (!matchId) return;
    try {
      const sentAt = Date.now();
      const next = await getConquestState(matchId);
      if (matchIdRef.current !== matchId || !next) return;
      const latency = (Date.now() - sentAt) / 2;
      setClockOffset(computeClockOffset(next.server_now, sentAt + latency));
      setState({
        match: next.match,
        players: next.players || [],
        claims: next.claims || [],
        events: next.events || [],
        bonuses: next.bonuses || [],
      });
    } catch (err) {
      setError(describeRpcError(err, lang));
    }
  }, [lang]);

  const enterMatch = useCallback(
    (match, uid) => {
      matchIdRef.current = match.id;
      channelRef.current?.close();
      channelRef.current = openConquestChannel(match.code, uid, {
        onSync: refresh,
        onPresence: setOnline,
      });
      setState((prev) => ({ ...prev, match }));
      return refresh();
    },
    [refresh]
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
        else if (result?.reason === "wrong") await notifyAndRefresh("steal_fail");
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

  const leave = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;
    matchIdRef.current = null;
    setState(EMPTY_STATE);
    setOnline([]);
    setError("");
  }, []);

  // Safety net: periodic resync (missed broadcasts, server-side timer end).
  const status = state.match?.status;
  useEffect(() => {
    if (!status || status === "finished") return undefined;
    const id = setInterval(refresh, RESYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, refresh]);

  useEffect(() => () => channelRef.current?.close(), []);

  return {
    userId,
    ...state,
    clockOffset,
    online,
    error,
    busy,
    create,
    join,
    setReady,
    start,
    claim,
    requestSteal,
    steal,
    leave,
    refresh,
  };
}
