import "./ConquestHud.css";
import "./ConquestLockouts.css";

import React, { useEffect, useMemo, useRef, useState } from "react";

import Button from "../components/ui/Button.jsx";
import PanelCloseButton from "../components/ui/PanelCloseButton.jsx";
import TextField from "../components/ui/TextField";
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

// Per-country history panel, loaded on first open.
const LazyCountryTimeline = React.lazy(() => import("./ConquestCountryTimeline.jsx"));
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

  // Answer result: the question's Wikipedia source is offered only now, never before.
  const resultToast = (res, message) => {
    const lock = res.ok && res.locked ? ` · ${t.lockedNow}` : "";
    const source = res.source_url;
    showToast({
      message: `${message}${lock}`,
      tone: res.ok ? "success" : "error",
      duration: source ? 8000 : 4000,
      actionLabel: source ? `ⓘ ${t.questionSource}` : undefined,
      onAction: source ? () => window.open(source, "_blank", "noopener,noreferrer") : undefined,
    });
  };

  const answerSteal = (val) =>
    guarded(async () => {
      if (challenge?.mode === "fortify") {
        const res = await conquest.fortify(val);
        setChallenge(null);
        if (!res) return;
        resultToast(
          res,
          res.ok
            ? `${countryName(res.country_id)} ${t.fortified} +${res.bonus_seconds} s`
            : refusal({ ...res, mode: "fortify" })
        );
        return;
      }
      const res = await conquest.steal(val);
      setChallenge(null);
      if (res)
        resultToast(res, res.ok ? `${countryName(res.country_id)} ${t.stole}` : refusal(res));
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
  openTimeline,
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
    } else if (action === "locked") {
      openTimeline(countryId);
    } else {
      showToast({
        message: refusal({ reason: "shielded", country_id: countryId }),
        tone: "error",
        actionLabel: t.timelineTitle,
        onAction: () => openTimeline(countryId),
      });
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
  lang,
  timeline,
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
    {timeline && !challenge ? (
      <React.Suspense fallback={null}>
        <LazyCountryTimeline t={t} lang={lang} {...timeline} />
      </React.Suspense>
    ) : null}
    {challenge ? (
      <ConquestStealPanel
        key={`${challenge.country_id}-${challenge.expires_at}`}
        t={t}
        lang={lang}
        challenge={challenge}
        countryName={countryName}
        onAnswer={answerSteal}
        onCancel={cancelSteal}
        myColor={myColor}
      />
    ) : (
      <form onSubmit={submit} autoComplete="off">
        <TextField
          variant="bare"
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
  const [timelineCountry, setTimelineCountry] = useState(null);

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
    openTimeline: conquest.countryTimeline ? setTimelineCountry : () => {},
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
        lang={lang}
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
        timeline={
          timelineCountry && {
            countryId: timelineCountry,
            title: countryName(timelineCountry),
            load: conquest.countryTimeline,
            describe: (event) =>
              event.kind === "fortify"
                ? `${players.find((p) => p.user_id === event.actor_id)?.display_name || "?"} ${t.timelineFortified}`
                : formatFeedEvent(event, { players, countryName, lang }),
            colorOf: (id) => getPaletteEntry(players.find((p) => p.user_id === id)?.color)?.hex,
            close: (
              <PanelCloseButton label={t.stealCancel} onClick={() => setTimelineCountry(null)} />
            ),
          }
        }
      />
    </div>
  );
};

export default ConquestHud;
