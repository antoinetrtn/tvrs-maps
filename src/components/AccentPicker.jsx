import "./AccentPicker.css";

import React from "react";

import { ACCENT_PRESETS } from "../config/accentPresets";

/** Settings card: pick one of the curated accent presets (persisted by useAppTheme). */
const AccentPicker = ({ lang = "fr", accent, setAccent, label }) => (
  <div className="settings-card glass-panel">
    <div className="settings-card-header">
      <span className="section-label">{label}</span>
    </div>
    <div className="accent-swatches" role="radiogroup" aria-label={label}>
      {Object.entries(ACCENT_PRESETS).map(([id, preset]) => {
        const name = preset.label[lang] || preset.label.en;
        const isActive = id === accent;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`accent-swatch ${isActive ? "active" : ""}`}
            style={{ "--swatch": preset.accent }}
            onClick={() => setAccent?.(id)}
            title={name}
          >
            <span className="accent-swatch-chip" aria-hidden="true" />
            <span className="accent-swatch-label">{name}</span>
          </button>
        );
      })}
    </div>
  </div>
);

export default AccentPicker;
