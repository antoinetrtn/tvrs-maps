import "./ConquestScreen.css";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { countryDataMap } from "../data/gameData";
import ConquestEnd from "./ConquestEnd.jsx";
import ConquestHud from "./ConquestHud.jsx";
import ConquestLobby from "./ConquestLobby.jsx";
import { buildOwnershipColors, deriveMatchPhase, remainingMs } from "./conquestLogic";

const TICK_MS = 250;

/**
 * « Conquête » 1v1 overlay. Owns no globe: it reports owner colours through
 * `onOwnershipChange` so App can paint the shared globe.
 */
const ConquestScreen = ({ lang, conquest, onExit, onOwnershipChange }) => {
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

  const ownershipColors = useMemo(() => buildOwnershipColors(claims, players), [claims, players]);
  useEffect(() => {
    onOwnershipChange(ownershipColors);
  }, [ownershipColors, onOwnershipChange]);

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
          countryName={countryName}
        />
      )}
      {phase === "finished" && <ConquestEnd lang={lang} conquest={conquest} onExit={exit} />}
    </div>
  );
};

export default ConquestScreen;
