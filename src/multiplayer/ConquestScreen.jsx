import "./ConquestScreen.css";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { countryDataMap } from "../data/gameData";
import ConquestEnd from "./ConquestEnd.jsx";
import ConquestHud from "./ConquestHud.jsx";
import ConquestLobby from "./ConquestLobby.jsx";
import {
  buildConquestOverlay,
  deriveMatchPhase,
  remainingMs,
  shieldedCountryIds,
  stealLockouts,
} from "./conquestLogic";

const TICK_MS = 250;

/**
 * « Conquête » 1v1 overlay. Owns no globe: it reports owner colours through
 * `onOverlayChange` so App can paint the shared globe.
 */
const ConquestScreen = ({
  lang,
  conquest,
  onExit,
  onOverlayChange,
  onFocusCountry,
  countryClickRef,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const { match, players, claims, clockOffset } = conquest;
  const phase = deriveMatchPhase(match, now, clockOffset);

  useEffect(() => {
    if (phase !== "live" && phase !== "countdown") return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  const { refresh } = conquest;
  useEffect(() => {
    // The server closes the match on the first request after ends_at.
    if (phase === "finished" && match?.status === "live") refresh();
  }, [phase, match?.status, refresh]);

  // String key: the overlay (and thus globe recolouring) only changes when the
  // set of shielded countries changes, not on every clock tick.
  const shieldKey = shieldedCountryIds(claims, now, clockOffset).join("|");
  const lockouts = stealLockouts({ ...conquest, rules: match?.rules }, now, clockOffset);
  const lockKey = lockouts.map((lock) => lock.id).join("|");
  const overlay = useMemo(
    () =>
      buildConquestOverlay(
        claims,
        players,
        shieldKey ? shieldKey.split("|") : [],
        lockKey ? lockKey.split("|") : []
      ),
    [claims, players, shieldKey, lockKey]
  );
  useEffect(() => {
    onOverlayChange(overlay);
  }, [overlay, onOverlayChange]);

  const countryName = useCallback(
    (id) => {
      const data = countryDataMap[id];
      if (!data) return id;
      return lang === "fr" ? data.name_fr || data.name_en || id : data.name_en || id;
    },
    [lang]
  );

  const exit = useCallback(() => {
    conquest.leave();
    onExit();
  }, [conquest, onExit]);

  const target = phase === "countdown" ? match?.started_at : match?.ends_at;
  const clockMs = target ? remainingMs(target, now, clockOffset) : 0;

  return (
    <div className="conquest-overlay">
      {(phase === "idle" || phase === "lobby") && (
        <ConquestLobby lang={lang} conquest={conquest} onBack={exit} />
      )}
      {(phase === "countdown" || phase === "live") && (
        <ConquestHud
          lang={lang}
          conquest={conquest}
          phase={phase}
          clockMs={clockMs}
          lockouts={lockouts}
          countryName={countryName}
          onFocusCountry={onFocusCountry}
          countryClickRef={countryClickRef}
        />
      )}
      {phase === "finished" && <ConquestEnd lang={lang} conquest={conquest} onExit={exit} />}
    </div>
  );
};

export default ConquestScreen;
