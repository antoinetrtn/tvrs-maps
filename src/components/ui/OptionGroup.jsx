import React, { useRef } from "react";

/**
 * OptionGroup — single-choice radio group (language, globe theme…).
 * Roving tabindex: Tab enters on the selected option, arrows move + select.
 */
const OptionGroup = ({ options = [], value, onChange, label, className = "" }) => {
  const refs = useRef([]);
  const enabled = options.filter((o) => !o.disabled);

  const move = (fromValue, dir) => {
    const idx = enabled.findIndex((o) => o.value === fromValue);
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    if (!next) return;
    onChange?.(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };

  const onKeyDown = (e, opt) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(opt.value, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(opt.value, -1);
    }
  };

  return (
    <div className={`ui-options ${className}`} role="radiogroup" aria-label={label}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={opt.disabled || undefined}
            className={`ui-option ${active ? "active" : ""}`}
            onClick={() => onChange?.(opt.value)}
            onKeyDown={(e) => onKeyDown(e, opt)}
          >
            <span className="ui-option-mark" aria-hidden="true" />
            {opt.icon}
            <span className="ui-option-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default OptionGroup;
