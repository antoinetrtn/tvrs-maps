import React, { useState } from "react";

import Button from "../components/ui/Button.jsx";
import OptionGroup from "../components/ui/OptionGroup.jsx";
import PanelCloseButton from "../components/ui/PanelCloseButton.jsx";
import TextField from "../components/ui/TextField.jsx";
import { ANSWER_INPUT_PROPS, shieldAutofillText } from "../utils/answerField";
import { getCategoryLabel } from "./knowledge/knowledgeCategories";

// Knowledge steps (ladder levels 3 to 5) only: pixel icons load on demand.
const LazyKnowledgeOptions = React.lazy(() => import("./knowledge/ConquestKnowledgeOptions.jsx"));

/**
 * Escalation challenge (steal or reinforce): ladder level 1 = type the capital,
 * 2 = pick the flag, 3-5 = pick the answer to a knowledge question (tech, nature, music).
 */
const ConquestStealPanel = ({ t, lang, challenge, countryName, onAnswer, onCancel, myColor }) => {
  const [value, setValue] = useState("");
  const name = countryName(challenge.country_id);
  const isFlag = challenge.kind === "flag";
  const isKnowledge = challenge.kind === "knowledge";
  // Same panel for a steal and for reinforcing my own country (+30 s / +1 min).
  const isFortify = challenge.mode === "fortify";
  const submitLabel = isFortify
    ? `${t.fortifyOffer} +${challenge.bonus_seconds || 0} s`
    : t.stealOffer;
  const question = isKnowledge
    ? `${getCategoryLabel(challenge.category, lang)} · ${name} — ${challenge.prompt}`
    : `${isFlag ? t.stealFlag : t.stealCapital} ${name} ?`;
  const headerText = isFortify
    ? `${t.fortifyTitle} +${challenge.bonus_seconds || 0} s · ${question}`
    : question;
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
      {isKnowledge ? (
        <React.Suspense fallback={null}>
          <LazyKnowledgeOptions
            options={challenge.options || []}
            icons={challenge.icons || []}
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
          placeholder={shieldAutofillText(t.stealPlaceholder)}
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
