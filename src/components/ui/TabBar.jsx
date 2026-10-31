import "./TabBar.css";

import React, { useRef } from "react";

import { useTabBarIndicator, useTabBarScroll } from "./useTabBarScroll";

function getNextOption(options, currentVal, step) {
  const enabled = options.filter((o) => !o.disabled);
  if (enabled.length === 0) return null;
  const currentIdx = enabled.findIndex((o) => o.value === currentVal);
  const baseIdx = currentIdx === -1 ? 0 : currentIdx;
  const targetIdx = (baseIdx + step + enabled.length) % enabled.length;
  return enabled[targetIdx];
}

function getEdgeOption(options, isStart) {
  const enabled = options.filter((o) => !o.disabled);
  if (enabled.length === 0) return null;
  return isStart ? enabled[0] : enabled[enabled.length - 1];
}

function TabButton({ opt, index, active, idPrefix, buttonRefs, onChange, onKeyDown }) {
  return (
    <button
      ref={(el) => (buttonRefs.current[index] = el)}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      id={idPrefix ? `${idPrefix}-tab-${opt.value}` : undefined}
      aria-controls={idPrefix ? `${idPrefix}-panel-${opt.value}` : undefined}
      title={opt.title || undefined}
      className={`tab-bar-tab ${active ? "active" : ""}`.trim()}
      disabled={opt.disabled || undefined}
      onClick={() => !opt.disabled && onChange?.(opt.value)}
      onKeyDown={(e) => onKeyDown(e, opt)}
    >
      {opt.icon}
      <span className="tab-bar-label">{opt.label}</span>
    </button>
  );
}

export default function TabBar({
  options = [],
  value,
  onChange,
  level = 1,
  label,
  className = "",
  idPrefix,
}) {
  const trackRef = useRef(null);
  const buttonRefs = useRef([]);

  const { hasOverflowStart, hasOverflowEnd } = useTabBarScroll({
    trackRef,
    value,
    options,
  });

  const { plate, snapping } = useTabBarIndicator({
    trackRef,
    value,
    options,
    level,
  });

  const handleKeyDown = (e, opt) => {
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      next = getNextOption(options, opt.value, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      next = getNextOption(options, opt.value, -1);
    } else if (e.key === "Home") {
      e.preventDefault();
      next = getEdgeOption(options, true);
    } else if (e.key === "End") {
      e.preventDefault();
      next = getEdgeOption(options, false);
    }

    if (next) {
      onChange?.(next.value);
      const targetIdx = options.indexOf(next);
      buttonRefs.current[targetIdx]?.focus();
    }
  };

  const plateStyle = plate
    ? {
        "--tab-x": `${plate.x}px`,
        "--tab-y": `${plate.y}px`,
        "--tab-w": `${plate.w}px`,
        "--tab-h": `${plate.h}px`,
      }
    : undefined;

  const trackStateClass = `${plate ? "has-indicator" : ""} ${snapping ? "is-snapping" : ""}`.trim();

  return (
    <div
      className={`tab-bar tab-bar-l${level} ${className}`.trim()}
      data-overflow-start={hasOverflowStart ? "true" : undefined}
      data-overflow-end={hasOverflowEnd ? "true" : undefined}
    >
      <div
        role="tablist"
        aria-label={label}
        className={`tab-bar-track ${trackStateClass}`.trim()}
        style={plateStyle}
        ref={trackRef}
      >
        {level === 1 && plate && <span className="tab-bar-indicator" aria-hidden="true" />}
        {options.map((opt, i) => (
          <TabButton
            key={opt.value}
            opt={opt}
            index={i}
            active={opt.value === value}
            idPrefix={idPrefix}
            buttonRefs={buttonRefs}
            onChange={onChange}
            onKeyDown={handleKeyDown}
          />
        ))}
      </div>
    </div>
  );
}
