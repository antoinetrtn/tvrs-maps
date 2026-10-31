import "./AnswerSuggestionList.css";

import React from "react";

import { shieldAutofillText } from "../utils/answerField";

function handleOptionKeyDown(e, idx, onSelect) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onSelect(idx);
  }
}

const AnswerSuggestionList = ({
  id = "answer-suggestions-list",
  suggestions = [],
  activeIndex = -1,
  onSelect,
  t,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div
      id={id}
      role="listbox"
      tabIndex={-1}
      aria-label={shieldAutofillText(t ? t("quiz_answer") : "Réponse du quiz")}
      className="suggestions-list animation-fade-in"
      onMouseDown={(e) => e.preventDefault()}
    >
      {suggestions.map((s, idx) => {
        const isSelected = idx === activeIndex;
        const optionId = `${id}-opt-${idx}`;
        const isFound = Boolean(s.found);

        return (
          <div
            key={s.key || `${s.display}-${idx}`}
            role="option"
            id={optionId}
            tabIndex={-1}
            aria-selected={isSelected ? "true" : "false"}
            data-found={isFound ? "true" : undefined}
            className={`suggestion-item ${isSelected ? "is-selected" : ""} ${isFound ? "is-found" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(idx)}
            onKeyDown={(e) => handleOptionKeyDown(e, idx, onSelect)}
          >
            <span className="sug-left">
              <span className="sug-text">{s.display}</span>
              {s.subtext && <small className="sug-sub">({s.subtext})</small>}
            </span>
            {isFound && (
              <span className="sug-found-badge">
                <span aria-hidden="true" className="sug-check">
                  ✓
                </span>
                <span className="sr-only">({t ? t("suggestion_found") : "trouvé"})</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(AnswerSuggestionList);
