import React, { useState } from "react";

import Button from "../components/ui/Button.jsx";
import OptionGroup from "../components/ui/OptionGroup.jsx";
import TextField from "../components/ui/TextField.jsx";

/** Harder steal challenge: type the capital, or pick the right flag among four. */
const ConquestStealPanel = ({ t, challenge, countryName, onAnswer, onCancel }) => {
  const [value, setValue] = useState("");
  const name = countryName(challenge.country_id);
  const isFlag = challenge.kind === "flag";
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
      className="conquest-steal"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onAnswer(value.trim());
      }}
    >
      <span className="conquest-label">
        {isFlag ? t.stealFlag : t.stealCapital} {name} ?
      </span>
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
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <div className="conquest-actions-row">
        <Button variant="secondary" onClick={onCancel}>
          {t.stealCancel}
        </Button>
        <Button type="submit" variant="primary" disabled={!value.trim()}>
          {t.stealOffer}
        </Button>
      </div>
    </form>
  );
};

export default ConquestStealPanel;
