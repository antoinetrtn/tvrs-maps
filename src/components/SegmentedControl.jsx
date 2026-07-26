import React from "react";

/**
 * SegmentedControl — single source for all "toggle groups" in header/panels.
 * Replaces duplicated .settings-segmented-switch, .panel-tab, .panel-tabs-header etc.
 * Guarantees identical look + behavior everywhere → no more drift (#4).
 *
 * Usage:
 *   <SegmentedControl
 *     options={[{value: 'global', label: 'Global'}, {value:'personal', label:'Personnel'}]}
 *     value={active}
 *     onChange={setActive}
 *   />
 */
export default function SegmentedControl({
  options = [],
  value,
  onChange,
  className = "",
  size = "md",
}) {
  return (
    <div className={`segmented-control segmented-${size} ${className}`}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`segmented-opt ${isActive ? "active" : ""}`}
            onClick={() => !opt.disabled && onChange && onChange(opt.value)}
            aria-pressed={isActive}
            disabled={opt.disabled || undefined}
            title={opt.title || undefined}
          >
            {opt.icon}
            <span className="segmented-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
