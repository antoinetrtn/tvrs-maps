import React from "react";

/** Switch — pixel on/off toggle (role="switch"). Space/Enter toggle natively. */
const Switch = ({ checked = false, onChange, label, id, disabled = false, className = "" }) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className={`ui-switch ${checked ? "is-on" : ""} ${className}`}
    onClick={() => onChange?.(!checked)}
  >
    <span className="ui-switch-knob" aria-hidden="true" />
  </button>
);

export default Switch;
