import React, { useMemo, useRef, useState } from "react";

import {
  computeStandings,
  describeClaimRefusal,
  formatClock,
  formatFeedEvent,
} from "./conquestLogic";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import { conquestText } from "./conquestText";

const FEED_SIZE = 6;

const ConquestHud = ({ lang, conquest, phase, clockMs, countryName }) => {
  const t = conquestText(lang);
  const { players, claims, events, userId } = conquest;
  const [answer, setAnswer] = useState("");
  const [toast, setToast] = useState(null);
  const pendingRef = useRef(false);
  const standings = useMemo(() => computeStandings(players, claims), [players, claims]);
  const feed = useMemo(
    () =>
      events
        .slice()
        .reverse()
        .map((event) => ({
          id: event.id,
          text: formatFeedEvent(event, { players, countryName, lang }),
        }))
        .filter((line) => line.text)
        .slice(0, FEED_SIZE),
    [events, players, countryName, lang]
  );

  const submit = async (e) => {
    e.preventDefault();
    const value = answer.trim();
    if (!value || pendingRef.current || phase !== "live") return;
    pendingRef.current = true;
    const result = await conquest.claim(value);
    pendingRef.current = false;
    if (result?.ok) {
      setAnswer("");
      setToast({ ok: true, text: `${countryName(result.country_id)} ${t.captured}` });
    } else if (result) {
      setToast({ ok: false, text: describeClaimRefusal(result, { players, countryName, lang }) });
    }
  };

  return (
    <div className="conquest-hud">
      <div className="conquest-hud-top glass-panel">
        <span className={`conquest-timer ${clockMs <= 120000 ? "is-urgent" : ""}`}>
          {phase === "countdown"
            ? `${t.countdown} ${Math.ceil(clockMs / 1000)}`
            : formatClock(clockMs)}
        </span>
        <ol className="conquest-scoreboard">
          {standings.map((player) => (
            <li key={player.user_id}>
              <ConquestPlayerChip player={player} tag={player.user_id === userId ? t.you : null}>
                <span className="conquest-score">
                  {player.score} {t.pts} · {player.countries} {t.countries}
                </span>
              </ConquestPlayerChip>
            </li>
          ))}
        </ol>
      </div>
      <aside className="conquest-feed glass-panel" aria-live="polite">
        <span className="conquest-label">{t.feed}</span>
        <ul>
          {feed.map((line) => (
            <li key={line.id}>{line.text}</li>
          ))}
        </ul>
      </aside>
      <form className="conquest-answer glass-panel" onSubmit={submit}>
        {toast && <p className={`conquest-toast ${toast.ok ? "is-ok" : "is-ko"}`}>{toast.text}</p>}
        <input
          className="conquest-input"
          value={answer}
          disabled={phase !== "live"}
          placeholder={t.inputPlaceholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </form>
    </div>
  );
};

export default ConquestHud;
