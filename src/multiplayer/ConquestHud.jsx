import React, { useMemo, useRef, useState } from "react";

import {
  computeStandings,
  describeClaimRefusal,
  formatClock,
  formatFeedEvent,
} from "./conquestLogic";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import ConquestStealPanel from "./ConquestStealPanel.jsx";
import { conquestText } from "./conquestText";

const FEED_SIZE = 6;

const ConquestHud = ({ lang, conquest, phase, clockMs, countryName, onFocusCountry }) => {
  const t = conquestText(lang);
  const { players, claims, events, bonuses, userId } = conquest;
  const [answer, setAnswer] = useState("");
  const [toast, setToast] = useState(null);
  const [stealTarget, setStealTarget] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const pendingRef = useRef(false);
  const standings = useMemo(
    () => computeStandings(players, claims, bonuses),
    [players, claims, bonuses]
  );
  const feed = useMemo(
    () =>
      events
        .slice()
        .reverse()
        .map((event) => ({
          id: event.id,
          countryId: event.country_id,
          text: formatFeedEvent(event, { players, countryName, lang }),
        }))
        .filter((line) => line.text)
        .slice(0, FEED_SIZE),
    [events, players, countryName, lang]
  );
  const refusal = (result) => describeClaimRefusal(result, { players, countryName, lang });

  // Serialises RPCs so a double Enter never sends two attempts.
  const guarded = async (fn) => {
    if (pendingRef.current || phase !== "live") return;
    pendingRef.current = true;
    try {
      await fn();
    } finally {
      pendingRef.current = false;
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const value = answer.trim();
    if (!value) return;
    void guarded(async () => {
      const result = await conquest.claim(value);
      if (!result) return;
      setStealTarget(result.reason === "already_owned" ? result.country_id : null);
      if (result.ok || result.reason === "already_owned") setAnswer("");
      if (result.ok)
        setToast({ ok: true, text: `${countryName(result.country_id)} ${t.captured}` });
      else setToast({ ok: false, text: refusal(result) });
      // Only centre on success: a selected country shows its flag/capital label,
      // which would leak the answer of the steal challenge.
      if (result.ok) onFocusCountry(result.country_id);
    });
  };

  const startSteal = () =>
    void guarded(async () => {
      const result = await conquest.requestSteal(stealTarget);
      setStealTarget(null);
      if (result?.ok) {
        onFocusCountry(null);
        setChallenge(result);
      } else if (result) setToast({ ok: false, text: refusal(result) });
    });

  const answerSteal = (value) =>
    void guarded(async () => {
      const result = await conquest.steal(value);
      setChallenge(null);
      if (result?.ok) setToast({ ok: true, text: `${countryName(result.country_id)} ${t.stole}` });
      else if (result) setToast({ ok: false, text: refusal(result) });
    });

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
                  {player.total} {t.pts} · {player.countries} {t.countries}
                  {player.bonus ? ` · +${player.bonus}` : ""}
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
            <li key={line.id}>
              {line.countryId ? (
                <button
                  type="button"
                  className="conquest-feed-line"
                  disabled={Boolean(challenge || stealTarget)}
                  onClick={() => onFocusCountry(line.countryId)}
                >
                  {line.text}
                </button>
              ) : (
                line.text
              )}
            </li>
          ))}
        </ul>
      </aside>
      <div className="conquest-answer glass-panel">
        {toast && <p className={`conquest-toast ${toast.ok ? "is-ok" : "is-ko"}`}>{toast.text}</p>}
        {stealTarget && !challenge && (
          <button type="button" className="conquest-btn primary small" onClick={startSteal}>
            {t.stealOffer} {countryName(stealTarget)}
          </button>
        )}
        {challenge ? (
          <ConquestStealPanel
            key={`${challenge.country_id}-${challenge.expires_at}`}
            t={t}
            challenge={challenge}
            countryName={countryName}
            onAnswer={answerSteal}
            onCancel={() => setChallenge(null)}
          />
        ) : (
          <form onSubmit={submit}>
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
        )}
      </div>
    </div>
  );
};

export default ConquestHud;
