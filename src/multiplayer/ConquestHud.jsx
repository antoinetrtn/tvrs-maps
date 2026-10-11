import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  computeStandings,
  describeClaimRefusal,
  formatClock,
  formatFeedEvent,
  resolveCountryClick,
} from "./conquestLogic";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import ConquestStealPanel from "./ConquestStealPanel.jsx";
import { conquestText } from "./conquestText";

const FEED_SIZE = 6;

const ConquestHud = ({
  lang,
  conquest,
  phase,
  clockMs,
  lockouts = [],
  countryName,
  onFocusCountry,
  countryClickRef,
}) => {
  const t = conquestText(lang);
  const { players, claims, events, bonuses, userId, clockOffset } = conquest;
  const [answer, setAnswer] = useState("");
  const [toast, setToast] = useState(null);
  const [stealTarget, setStealTarget] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const pendingRef = useRef(false);
  const inputRef = useRef(null);
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

  // Serialises RPCs so a double Enter / double click never sends two attempts.
  const guarded = async (fn) => {
    if (pendingRef.current || phase !== "live") return;
    pendingRef.current = true;
    try {
      await fn();
    } finally {
      pendingRef.current = false;
    }
  };

  const openSteal = (countryId) =>
    guarded(async () => {
      const result = await conquest.requestSteal(countryId);
      setStealTarget(null);
      if (result?.ok) setChallenge(result);
      else if (result) setToast({ ok: false, text: refusal(result) });
    });

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
      if (result.country_id) onFocusCountry(result.country_id);
    });
  };

  const answerSteal = (value) =>
    guarded(async () => {
      const result = await conquest.steal(value);
      setChallenge(null);
      if (result?.ok) setToast({ ok: true, text: `${countryName(result.country_id)} ${t.stole}` });
      else if (result) setToast({ ok: false, text: refusal(result) });
    });

  // Abandoning counts as a failed attempt on the server (no free reroll).
  const cancelSteal = () =>
    guarded(async () => {
      const result = await conquest.cancelSteal();
      setChallenge(null);
      if (result) setToast({ ok: false, text: refusal(result) });
    });

  // Globe click: centre the country, then steal / prompt / inform.
  const handleCountryClick = (countryId) => {
    if (phase !== "live" || challenge) return;
    onFocusCountry(countryId);
    const action = resolveCountryClick(countryId, claims, userId, Date.now(), clockOffset);
    if (action === "steal") {
      void openSteal(countryId);
    } else if (action === "free") {
      setToast({ ok: true, text: t.clickFree });
      inputRef.current?.focus();
    } else {
      const reason = action === "mine" ? "already_yours" : "shielded";
      setToast({ ok: false, text: refusal({ reason, country_id: countryId }) });
    }
  };
  useEffect(() => {
    countryClickRef.current = handleCountryClick;
    return () => {
      countryClickRef.current = null;
    };
  });

  return (
    <div className="conquest-hud">
      <div className="conquest-hud-top conquest-surface">
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
      <aside className="conquest-feed conquest-surface" aria-live="polite">
        <span className="conquest-label">{t.feed}</span>
        <ul>
          {feed.map((line) => (
            <li key={line.id}>
              {line.countryId ? (
                <button
                  type="button"
                  className="conquest-feed-line"
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
      <div className="conquest-answer conquest-surface">
        {lockouts.length > 0 && (
          <ul className="conquest-lockouts" aria-live="polite">
            {lockouts.map((lock) => (
              <li key={lock.id}>
                <button
                  type="button"
                  className="conquest-lockout"
                  onClick={() => onFocusCountry(lock.id)}
                >
                  <span className="conquest-lockout-name">{countryName(lock.id)}</span>
                  <span>{t.lockedFor}</span>
                  <span className="conquest-lockout-time">{Math.ceil(lock.ms / 1000)} s</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {toast && <p className={`conquest-toast ${toast.ok ? "is-ok" : "is-ko"}`}>{toast.text}</p>}
        {stealTarget && !challenge && (
          <button type="button" className="btn-primary" onClick={() => openSteal(stealTarget)}>
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
            onCancel={cancelSteal}
          />
        ) : (
          <form onSubmit={submit}>
            <input
              ref={inputRef}
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
