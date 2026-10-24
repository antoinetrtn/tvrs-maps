import "./ConquestHud.css";
import "./ConquestLockouts.css";

import React, { useEffect, useMemo, useRef, useState } from "react";

import Button from "../components/ui/Button.jsx";
import { showToast } from "../components/ui/Toast.jsx";
import {
  ANSWER_INPUT_PROPS,
  focusAnswerInputSafely,
  shieldAutofillText,
} from "../utils/answerField";
import { HudFeed, HudTopBar } from "./ConquestHudParts.jsx";
import {
  computeStandings,
  describeClaimRefusal,
  formatFeedEvent,
  getPaletteEntry,
  resolveCountryClick,
} from "./conquestLogic";
import ConquestStealPanel from "./ConquestStealPanel.jsx";
import { conquestText } from "./conquestText";

const FEED_SIZE = 3;

const useConquestFeed = (events, players, countryName, lang) =>
  useMemo(
    () =>
      events
        .slice()
        .reverse()
        .map((event) => {
          const actor = players.find((p) => p.user_id === event.actor_id);
          const actorColor = actor ? getPaletteEntry(actor.color)?.hex : null;
          return {
            id: event.id,
            countryId: event.country_id,
            actorColor,
            text: formatFeedEvent(event, { players, countryName, lang }),
          };
        })
        .filter((line) => line.text)
        .slice(0, FEED_SIZE),
    [events, players, countryName, lang]
  );

function useConquestActions({
  conquest,
  phase,
  countryName,
  lang,
  t,
  onFocusCountry,
  answer,
  setAnswer,
}) {
  const [stealTarget, setStealTarget] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const pendingRef = useRef(false);

  const refusal = (res) =>
    describeClaimRefusal(res, { players: conquest.players, countryName, lang });

  const guarded = async (fn) => {
    if (pendingRef.current || phase !== "live") return;
    pendingRef.current = true;
    try {
      await fn();
    } finally {
      pendingRef.current = false;
    }
  };

  const openSteal = (cid) =>
    guarded(async () => {
      const res = await conquest.requestSteal(cid);
      setStealTarget(null);
      if (res?.ok) setChallenge({ ...res, mode: "steal" });
      else if (res) showToast({ message: refusal(res), tone: "error" });
    });

  // Re-click on my own country: reinforcement challenge (flag or capital).
  const openFortify = (cid) =>
    guarded(async () => {
      if (!conquest.requestFortify) return;
      const res = await conquest.requestFortify(cid);
      if (res?.ok) setChallenge({ ...res, mode: "fortify" });
      else if (res) showToast({ message: refusal({ ...res, mode: "fortify" }), tone: "error" });
    });

  const submit = (e) => {
    e.preventDefault();
    const val = answer.trim();
    if (!val) return;
    void guarded(async () => {
      const res = await conquest.claim(val);
      if (!res) return;
      setStealTarget(res.reason === "already_owned" ? res.country_id : null);
      if (res.ok || res.reason === "already_owned") setAnswer("");
      if (res.ok) {
        showToast({ message: `${countryName(res.country_id)} ${t.captured}`, tone: "success" });
      } else {
        showToast({ message: refusal(res), tone: "error" });
      }
      if (res.country_id) onFocusCountry(res.country_id);
    });
  };

  const answerSteal = (val) =>
    guarded(async () => {
      if (challenge?.mode === "fortify") {
        const res = await conquest.fortify(val);
        setChallenge(null);
        if (res?.ok) {
          const message = `${countryName(res.country_id)} ${t.fortified} +${res.bonus_seconds} s`;
          showToast({ message, tone: "success" });
        } else if (res) showToast({ message: refusal({ ...res, mode: "fortify" }), tone: "error" });
        return;
      }
      const res = await conquest.steal(val);
      setChallenge(null);
      if (res?.ok) {
        showToast({ message: `${countryName(res.country_id)} ${t.stole}`, tone: "success" });
      } else if (res) {
        showToast({ message: refusal(res), tone: "error" });
      }
    });

  const cancelSteal = () =>
    guarded(async () => {
      if (challenge?.mode === "fortify") {
        setChallenge(null);
        await conquest.cancelFortify?.();
        return;
      }
      const res = await conquest.cancelSteal();
      setChallenge(null);
      if (res) showToast({ message: refusal(res), tone: "error" });
    });

  return { stealTarget, challenge, openSteal, openFortify, submit, answerSteal, cancelSteal };
}

function useCountryClickHandler({
  phase,
  challenge,
  claims,
  userId,
  clockOffset,
  countryClickRef,
  onSelectCountry,
  openSteal,
  openFortify,
  countryName,
  lang,
  players,
  t,
  inputRef,
}) {
  const refusal = (res) => describeClaimRefusal(res, { players, countryName, lang });

  const handleCountryClick = (countryId) => {
    if (phase !== "live" || challenge) return;
    onSelectCountry(countryId);
    const action = resolveCountryClick(countryId, claims, userId, Date.now(), clockOffset);
    if (action === "steal") {
      void openSteal(countryId);
    } else if (action === "free") {
      showToast({ message: t.clickFree, tone: "success" });
      focusAnswerInputSafely(inputRef);
    } else if (action === "mine") {
      void openFortify(countryId);
    } else {
      const reason = "shielded";
      showToast({ message: refusal({ reason, country_id: countryId }), tone: "error" });
    }
  };

  useEffect(() => {
    countryClickRef.current = handleCountryClick;
    return () => {
      countryClickRef.current = null;
    };
  });
}

const HudAnswer = ({
  challenge,
  lockouts,
  stealTarget,
  countryName,
  t,
  openSteal,
  answerSteal,
  cancelSteal,
  submit,
  inputRef,
  answer,
  setAnswer,
  phase,
  onFocusCountry,
  myColor,
}) => (
  <div className={`conquest-answer ${challenge ? "conquest-surface has-challenge" : ""}`}>
    {lockouts.length > 0 && (
      <ul className="conquest-lockouts" aria-live="polite">
        {lockouts.map((lock) => (
          <li key={lock.id}>
            <Button
              variant="secondary"
              size="sm"
              className="conquest-lockout"
              onClick={() => onFocusCountry(lock.id)}
            >
              <span className="conquest-lockout-name">{countryName(lock.id)}</span>
              <span>{t.lockedFor}</span>
              <span className="conquest-lockout-time">{Math.ceil(lock.ms / 1000)} s</span>
            </Button>
          </li>
        ))}
      </ul>
    )}
    {stealTarget && !challenge && (
      <Button variant="primary" onClick={() => openSteal(stealTarget)}>
        {t.stealOffer} {countryName(stealTarget)}
      </Button>
    )}
    {challenge ? (
      <ConquestStealPanel
        key={`${challenge.country_id}-${challenge.expires_at}`}
        t={t}
        challenge={challenge}
        countryName={countryName}
        onAnswer={answerSteal}
        onCancel={cancelSteal}
        myColor={myColor}
      />
    ) : (
      <form onSubmit={submit} autoComplete="off">
        <input
          ref={inputRef}
          {...ANSWER_INPUT_PROPS}
          className="conquest-input"
          value={answer}
          disabled={phase !== "live"}
          placeholder={t.inputPlaceholder}
          aria-label={shieldAutofillText(t.inputPlaceholder)}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </form>
    )}
  </div>
);

const ConquestHud = ({
  lang,
  conquest,
  phase,
  clockMs,
  lockouts = [],
  countryName,
  onFocusCountry,
  onSelectCountry,
  countryClickRef,
}) => {
  const t = conquestText(lang);
  const { players, claims, events, bonuses, userId, clockOffset } = conquest;
  const [answer, setAnswer] = useState("");
  const inputRef = useRef(null);

  const standings = useMemo(
    () => computeStandings(players, claims, bonuses),
    [players, claims, bonuses]
  );
  const feed = useConquestFeed(events, players, countryName, lang);
  const { stealTarget, challenge, openSteal, openFortify, submit, answerSteal, cancelSteal } =
    useConquestActions({
      conquest,
      phase,
      countryName,
      lang,
      t,
      onFocusCountry,
      answer,
      setAnswer,
    });

  useCountryClickHandler({
    phase,
    challenge,
    claims,
    userId,
    clockOffset,
    countryClickRef,
    onSelectCountry,
    openSteal,
    openFortify,
    countryName,
    lang,
    players,
    t,
    inputRef,
  });

  const myPlayer = players?.find((p) => p.user_id === userId);
  const myColor = myPlayer ? getPaletteEntry(myPlayer.color)?.hex : undefined;

  return (
    <div className="conquest-hud">
      <HudTopBar standings={standings} userId={userId} phase={phase} clockMs={clockMs} t={t} />
      <HudFeed feed={feed} onFocusCountry={onFocusCountry} t={t} />
      <HudAnswer
        challenge={challenge}
        lockouts={lockouts}
        stealTarget={stealTarget}
        countryName={countryName}
        t={t}
        openSteal={openSteal}
        answerSteal={answerSteal}
        cancelSteal={cancelSteal}
        submit={submit}
        inputRef={inputRef}
        answer={answer}
        setAnswer={setAnswer}
        phase={phase}
        onFocusCountry={onFocusCountry}
        myColor={myColor}
      />
    </div>
  );
};

export default ConquestHud;
