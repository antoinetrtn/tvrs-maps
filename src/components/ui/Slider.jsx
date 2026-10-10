import { Minus, Plus } from "pixelarticons/react";
import React, { useId } from "react";

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Slider — pixel range input with optional −/+ steppers and a value readout.
 * Native <input type="range"> underneath: arrow keys, PageUp/Down, Home/End and
 * touch dragging all work out of the box and are announced by screen readers.
 */
const Slider = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  formatValue = (v) => String(v),
  decrementLabel = "−",
  incrementLabel = "+",
  showSteppers = true,
  className = "",
}) => {
  const id = useId();
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const set = (v) => onChange?.(clamp(v, min, max));

  return (
    <div className={`ui-slider ${className}`} style={{ "--fill": `${pct}%` }}>
      <div className="ui-slider-head">
        {label && (
          <label className="ui-slider-label" htmlFor={id}>
            {label}
          </label>
        )}
        <output className="ui-slider-value" htmlFor={id} aria-live="polite">
          {formatValue(value)}
        </output>
      </div>
      <div className="ui-slider-body">
        {showSteppers && (
          <button
            type="button"
            className="ui-icon-step"
            aria-label={decrementLabel}
            title={decrementLabel}
            disabled={value <= min}
            onClick={() => set(value - step)}
          >
            <Minus width={16} height={16} />
          </button>
        )}
        <input
          id={id}
          type="range"
          className="ui-slider-input"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={formatValue(value)}
          onChange={(e) => set(Number(e.target.value))}
        />
        {showSteppers && (
          <button
            type="button"
            className="ui-icon-step"
            aria-label={incrementLabel}
            title={incrementLabel}
            disabled={value >= max}
            onClick={() => set(value + step)}
          >
            <Plus width={16} height={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Slider;
