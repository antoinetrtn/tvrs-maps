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

function formatSubmitLabel(isFortify, bonusSeconds, t) {
  if (isFortify) {
    return `${t.fortifyOffer} +${bonusSeconds || 0} s`;
  }
  return t.stealOffer;
}

function formatQuestion({ isKnowledge, isFlag, category, prompt, name, lang, t }) {
  if (isKnowledge) {
    return `${getCategoryLabel(category, lang)} · ${name} — ${prompt}`;
  }
  return `${isFlag ? t.stealFlag : t.stealCapital} ${name} ?`;
}

function formatHeaderText({ isFortify, level, bonusSeconds, question, t }) {
  const levelPrefix = level ? `${t.ladderLevel} ${level} · ` : "";
  if (isFortify) {
    return `${levelPrefix}${t.fortifyTitle} +${bonusSeconds || 0} s · ${question}`;
  }
  return `${levelPrefix}${question}`;
}

// alt = position only: naming the flag would give the answer away.
function buildFlagOptions(options, flagOptionText) {
  return options.map((iso, index) => ({
    value: iso,
    label: "",
    icon: (
      <img
        className="conquest-flag"
        src={`/flags/${iso.toLowerCase()}.svg`}
        alt={`${flagOptionText} ${index + 1}`}
      />
    ),
  }));
}

function buildFormClassName(isFortify, isKnowledge) {
  let className = "conquest-steal";
  if (isFortify) className += " is-fortify";
  if (isKnowledge) className += " is-knowledge";
  return className;
}

function renderStealInput({
  isKnowledge,
  isTyped,
  isFlag,
  challenge,
  value,
  setValue,
  question,
  name,
  flagOptions,
  t,
}) {
  if (isKnowledge && !isTyped) {
    return (
      <React.Suspense fallback={null}>
        <LazyKnowledgeAnswer
          t={t}
          challenge={challenge}
          value={value}
          onChange={setValue}
          label={question}
        />
      </React.Suspense>
    );
  }
  if (isFlag) {
    return (
      <OptionGroup
        className="conquest-flag-options"
        options={flagOptions}
        value={value}
        onChange={setValue}
        label={`${t.stealFlag} ${name}`}
      />
    );
  }
  const placeholderText = isKnowledge ? t.answerPlaceholder : t.stealPlaceholder;
  return (
    <TextField
      variant="outline"
      className="conquest-input"
      value={value}
      placeholder={shieldAutofillText(placeholderText)}
      {...ANSWER_INPUT_PROPS}
      onChange={(e) => setValue(e.target.value)}
    />
  );
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
  const submitLabel = formatSubmitLabel(isFortify, challenge.bonus_seconds, t);
  const question = formatQuestion({
    isKnowledge,
    isFlag,
    category: challenge.category,
    prompt: challenge.prompt,
    name,
    lang,
    t,
  });
  // Only the current level is revealed, never the rest of the chain.
  const headerText = formatHeaderText({
    isFortify,
    level: challenge.level,
    bonusSeconds: challenge.bonus_seconds,
    question,
    t,
  });
  const flagOptions = buildFlagOptions(challenge.options || [], t.flagOption);

  const trimmed = value.trim();
  const formStyle = isFortify && myColor ? { "--my-color": myColor } : undefined;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (trimmed) onAnswer(trimmed);
  };

  return (
    <form
      autoComplete="off"
      className={buildFormClassName(isFortify, isKnowledge)}
      style={formStyle}
      onSubmit={handleSubmit}
    >
      <div className="conquest-steal-header">
        <span className="conquest-label">{headerText}</span>
        <PanelCloseButton label={t.stealCancel} onClick={onCancel} />
      </div>
      {renderStealInput({
        isKnowledge,
        isTyped,
        isFlag,
        challenge,
        value,
        setValue,
        question,
        name,
        flagOptions,
        t,
      })}
      <div className="conquest-actions-row">
        <Button variant="secondary" onClick={onCancel}>
          {t.stealCancel}
        </Button>
        <Button type="submit" variant="primary" disabled={!trimmed}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default ConquestStealPanel;
