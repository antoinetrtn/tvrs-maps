import "./AccentPicker.css";

import React from "react";

import { ACCENT_PRESETS } from "../config/accentPresets";
import Pressable from "./ui/Pressable";

/** Accent swatches: pick one of the curated presets (persisted by useAppTheme). */
const AccentPicker = ({ lang = "fr", accent, setAccent, label }) => (
  <div className="accent-swatches" role="radiogroup" aria-label={label}>
    {Object.entries(ACCENT_PRESETS).map(([id, preset]) => {
      const name = preset.label[lang] || preset.label.en;
      const isActive = id === accent;
      return (
        <Pressable
          key={id}
          type="button"
          role="radio"
          aria-checked={isActive}
          aria-label={name}
          className={`accent-swatch ${isActive ? "active" : ""}`}
          style={{ "--swatch": preset.accent }}
          onClick={() => setAccent?.(id)}
          title={name}
        >
          <span className="accent-swatch-chip" aria-hidden="true" />
          <span className="accent-swatch-label">{name}</span>
        </Pressable>
      );
    })}
  </div>
);

export default AccentPicker;
