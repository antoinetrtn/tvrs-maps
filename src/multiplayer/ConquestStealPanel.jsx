import React, { useState } from "react";

/** Harder steal challenge: type the capital, or pick the right flag among four. */
const ConquestStealPanel = ({ t, challenge, countryName, onAnswer, onCancel }) => {
  const [value, setValue] = useState("");
  const name = countryName(challenge.country_id);
  const isFlag = challenge.kind === "flag";
  return (
    <div className="conquest-steal">
      <span className="conquest-label">
        {isFlag ? t.stealFlag : t.stealCapital} {name} ?
      </span>
      {isFlag ? (
        <div className="conquest-flag-options">
          {challenge.options.map((iso) => (
            <button
              key={iso}
              type="button"
              className="conquest-flag-option"
              onClick={() => onAnswer(iso)}
            >
              <img src={`/flags/${iso.toLowerCase()}.svg`} alt="" loading="eager" />
            </button>
          ))}
        </div>
      ) : (
        <form
          className="conquest-join-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onAnswer(value.trim());
          }}
        >
          <input
            className="conquest-input"
            value={value}
            placeholder={t.stealPlaceholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className="conquest-btn primary">
            {t.stealOffer}
          </button>
        </form>
      )}
      <button type="button" className="conquest-btn ghost small" onClick={onCancel}>
        {t.stealCancel}
      </button>
    </div>
  );
};

export default ConquestStealPanel;
