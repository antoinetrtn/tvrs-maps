import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * SegmentedControl — single source for all "toggle groups" in header/panels.
 * Replaces duplicated .settings-segmented-switch, .panel-tab, .panel-tabs-header etc.
 * Guarantees identical look + behavior everywhere → no more drift (#4).
 *
 * The active-tab plate is one indicator that jumps tab to tab in steps (see
 * motion.css). It is measured from the active button; until a real width is
 * measured (first paint, jsdom) the active button paints its own plate, so the
 * control never renders without one.
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
  const rootRef = useRef(null);
  const [plate, setPlate] = useState(null);
  const [snapping, setSnapping] = useState(false);

  const measure = useCallback(() => {
    const active = rootRef.current?.querySelector(".segmented-opt.active");
    if (!active || active.offsetWidth === 0) {
      setPlate(null);
      return;
    }
    const next = {
      x: active.offsetLeft,
      y: active.offsetTop,
      w: active.offsetWidth,
      h: active.offsetHeight,
    };
    setPlate((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
        ? prev
        : next
    );
  }, []);

  useLayoutEffect(measure, [measure, value, options.length]);

  // Re-measure when the control is resized (fonts, language, viewport).
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !rootRef.current) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [measure]);

  // Transitions are enabled one frame after the first measure so the plate
  // appears on the active tab instead of sliding in from the corner.
  const hasPlate = plate !== null;
  useEffect(() => {
    if (!hasPlate) return undefined;
    const id = requestAnimationFrame(() => setSnapping(true));
    return () => cancelAnimationFrame(id);
  }, [hasPlate]);

  const plateStyle = plate && {
    "--seg-x": `${plate.x}px`,
    "--seg-y": `${plate.y}px`,
    "--seg-w": `${plate.w}px`,
    "--seg-h": `${plate.h}px`,
  };
  const stateClass = `${plate ? "has-indicator" : ""} ${snapping ? "is-snapping" : ""}`;

  return (
    <div
      ref={rootRef}
      className={`segmented-control segmented-${size} ${stateClass} ${className}`}
      style={plateStyle || undefined}
    >
      {plate && <span className="segmented-indicator" aria-hidden="true" />}
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
