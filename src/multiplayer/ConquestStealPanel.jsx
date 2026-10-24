import React, { useState } from "react";

import Button from "../components/ui/Button.jsx";
import OptionGroup from "../components/ui/OptionGroup.jsx";
import PanelCloseButton from "../components/ui/PanelCloseButton.jsx";
import TextField from "../components/ui/TextField.jsx";
import { ANSWER_INPUT_PROPS } from "../utils/answerField";

/** Harder steal challenge: type the capital, or pick the right flag among four. */
const ConquestStealPanel = ({ t, challenge, countryName, onAnswer, onCancel, myColor }) => {
  const [value, setValue] = useState("");
  const name = countryName(challenge.country_id);
  const isFlag = challenge.kind === "flag";
  // Same panel for a steal and for reinforcing my own country (+30 s / +1 min).
  const isFortify = challenge.mode === "fortify";
  const submitLabel = isFortify
    ? `${t.fortifyOffer} +${challenge.bonus_seconds || 0} s`
    : t.stealOffer;
  const question = `${isFlag ? t.stealFlag : t.stealCapital} ${name} ?`;
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
      {isFlag ? (
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
          placeholder={t.stealPlaceholder}
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
