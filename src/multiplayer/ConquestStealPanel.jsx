import React, { useState } from "react";

import Button from "../components/ui/Button.jsx";
import OptionGroup from "../components/ui/OptionGroup.jsx";
import PanelCloseButton from "../components/ui/PanelCloseButton.jsx";
import TextField from "../components/ui/TextField.jsx";
import { ANSWER_INPUT_PROPS, shieldAutofillText } from "../utils/answerField";
import { getCategoryLabel } from "./knowledge/knowledgeCategories";

// Knowledge choice / slider / ordering answers load on demand (pixel icons).
const LazyKnowledgeAnswer = React.lazy(() => import("./knowledge/ConquestKnowledgeAnswer.jsx"));

/** First value of a challenge: slider midpoint, shuffled order, empty otherwise. */
function initialValue(challenge) {
  if (challenge.kind !== "knowledge") return "";
  if (challenge.answer_type === "order") return JSON.stringify(challenge.options || []);
  if (challenge.answer_type === "number") {
    const min = Number(challenge.min) || 0;
    const step = Number(challenge.step) || 1;
    const mid = min + Math.round((Number(challenge.max) - min) / 2 / step) * step;
    return String(mid);
  }
  return "";
}

/**
 * Escalation challenge (steal or reinforce). Only the current level of the country's
 * chain is shown: capital (typed), flag (pick), or a knowledge question whose answer
 * component depends on the question (typed text, choice grid, slider, ordering).
 */
const ConquestStealPanel = ({ t, lang, challenge, countryName, onAnswer, onCancel, myColor }) => {
  const [value, setValue] = useState(() => initialValue(challenge));
  const name = countryName(challenge.country_id);
  const isFlag = challenge.kind === "flag";
  const isKnowledge = challenge.kind === "knowledge";
  // Typed knowledge answers reuse the capital input (same fuzzy rule server-side).
  const isTyped = !isFlag && (!isKnowledge || challenge.answer_type === "text");
  // Same panel for a steal and for reinforcing my own country (+30 s / +1 min).
  const isFortify = challenge.mode === "fortify";
  const submitLabel = isFortify
    ? `${t.fortifyOffer} +${challenge.bonus_seconds || 0} s`
    : t.stealOffer;
  const question = isKnowledge
    ? `${getCategoryLabel(challenge.category, lang)} · ${name} — ${challenge.prompt}`
    : `${isFlag ? t.stealFlag : t.stealCapital} ${name} ?`;
  // Only the current level is revealed, never the rest of the chain.
  const level = challenge.level ? `${t.ladderLevel} ${challenge.level} · ` : "";
  const headerText = isFortify
    ? `${level}${t.fortifyTitle} +${challenge.bonus_seconds || 0} s · ${question}`
    : `${level}${question}`;
  // alt = position only: naming the flag would give the answer away.
  const flagOptions = (challenge.options || []).map((iso, index) => ({
    value: iso,
    label: "",
    icon: (
      <img
        className="conquest-flag"
        src={`/flags/${iso.toLowerCase()}.svg`}
        alt={`${t.flagOption} ${index + 1}`}
      />
    ),
  }));

  return (
    <form
      autoComplete="off"
      className={`conquest-steal${isFortify ? " is-fortify" : ""}`}
      style={isFortify && myColor ? { "--my-color": myColor } : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onAnswer(value.trim());
      }}
    >
      <div className="conquest-steal-header">
        <span className="conquest-label">{headerText}</span>
        <PanelCloseButton label={t.stealCancel} onClick={onCancel} />
      </div>
      {isKnowledge && !isTyped ? (
        <React.Suspense fallback={null}>
          <LazyKnowledgeAnswer
            t={t}
            challenge={challenge}
            value={value}
            onChange={setValue}
            label={question}
          />
        </React.Suspense>
      ) : isFlag ? (
        <OptionGroup
          className="conquest-flag-options"
          options={flagOptions}
          value={value}
          onChange={setValue}
          label={`${t.stealFlag} ${name}`}
        />
      ) : (
        <TextField
          variant="outline"
          className="conquest-input"
          value={value}
          placeholder={shieldAutofillText(isKnowledge ? t.answerPlaceholder : t.stealPlaceholder)}
          {...ANSWER_INPUT_PROPS}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <div className="conquest-actions-row">
        <Button variant="secondary" onClick={onCancel}>
          {t.stealCancel}
        </Button>
        <Button type="submit" variant="primary" disabled={!value.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default ConquestStealPanel;
