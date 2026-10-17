import { PixelText } from "./rulesPixelFont";

export function FailedStealScene() {
  return (
    <svg
      viewBox="0 0 64 32"
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="rules-scene-svg"
    >
      <defs>
        <pattern id="rs-hatch-pattern" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="2" height="2" fill="var(--bg-color)" />
          <rect x="2" y="2" width="2" height="2" fill="var(--bg-color)" />
        </pattern>
      </defs>
      <g className="rs-failed-cell">
        <rect x="10" y="10" width="12" height="12" fill="var(--text-muted)" />
        <rect
          className="rs-failed-hatch"
          x="10"
          y="10"
          width="12"
          height="12"
          fill="url(#rs-hatch-pattern)"
        />
      </g>
      <g className="rs-failed-cursor" fill="var(--accent)">
        <rect x="16" y="16" width="2" height="5" />
        <rect x="18" y="18" width="2" height="3" />
        <rect x="20" y="20" width="2" height="2" />
      </g>
      <g className="rs-failed-x" fill="var(--error)">
        <rect x="13" y="13" width="2" height="2" />
        <rect x="17" y="13" width="2" height="2" />
        <rect x="15" y="15" width="2" height="2" />
        <rect x="13" y="17" width="2" height="2" />
        <rect x="17" y="17" width="2" height="2" />
      </g>
      <rect x="28" y="9" width="24" height="2" fill="var(--glass-border)" />
      <rect x="28" y="13" width="24" height="2" fill="var(--glass-border)" />
      <rect x="28" y="17" width="24" height="2" fill="var(--glass-border)" />
      <rect x="28" y="21" width="24" height="2" fill="var(--glass-border)" />
      <rect className="rs-failed-bar-1" x="28" y="9" width="3" height="2" fill="var(--error)" />
      <rect className="rs-failed-bar-2" x="28" y="13" width="6" height="2" fill="var(--error)" />
      <rect className="rs-failed-bar-3" x="28" y="17" width="12" height="2" fill="var(--error)" />
      <rect className="rs-failed-bar-4" x="28" y="21" width="24" height="2" fill="var(--error)" />
      <PixelText text="s" x={54} y={18} fill="var(--error)" className="rs-failed-s" />
    </svg>
  );
}

export function BonusScene() {
  return (
    <svg
      viewBox="0 0 64 32"
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="rules-scene-svg"
    >
      <rect
        className="rs-bonus-frame"
        x="10"
        y="7"
        width="28"
        height="18"
        fill="none"
        stroke="var(--glass-border-strong)"
        strokeWidth="1"
      />
      <rect
        className="rs-bonus-cell-1"
        x="13"
        y="9"
        width="6"
        height="6"
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth="1"
      />
      <rect
        className="rs-bonus-cell-2"
        x="21"
        y="9"
        width="6"
        height="6"
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth="1"
      />
      <rect
        className="rs-bonus-cell-3"
        x="29"
        y="9"
        width="6"
        height="6"
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth="1"
      />
      <rect
        x="13"
        y="17"
        width="6"
        height="6"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <rect
        x="21"
        y="17"
        width="6"
        height="6"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <rect
        x="29"
        y="17"
        width="6"
        height="6"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <PixelText text="+50" x={40} y={11} unit={2} fill="var(--accent)" className="rs-bonus-pop" />
    </svg>
  );
}

export function EndScene() {
  return (
    <svg
      viewBox="0 0 64 32"
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="rules-scene-svg"
    >
      <rect x="12" y="4" width="40" height="2" fill="var(--glass-border)" />
      <rect className="rs-end-timer" x="12" y="4" width="40" height="2" fill="var(--text-main)" />
      <rect x="12" y="27" width="40" height="1" fill="var(--glass-border-strong)" />
      <rect
        className="rs-end-col-accent"
        x="22"
        y="11"
        width="10"
        height="16"
        fill="var(--accent)"
      />
      <rect
        className="rs-end-col-muted"
        x="34"
        y="17"
        width="10"
        height="10"
        fill="var(--text-muted)"
      />
      <rect className="rs-end-marker" x="25" y="7" width="4" height="4" fill="var(--accent)" />
    </svg>
  );
}

export function EloScene() {
  return (
    <svg
      viewBox="0 0 64 32"
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="rules-scene-svg"
    >
      <PixelText text="1000" x={4} y={22} fill="var(--text-muted)" className="rs-elo-start" />
      <g className="rs-elo-chart" fill="var(--text-main)">
        <rect x="21" y="24" width="6" height="1" />
        <rect x="27" y="21" width="1" height="4" />
        <rect x="27" y="21" width="6" height="1" />
        <rect x="33" y="18" width="1" height="4" />
        <rect x="33" y="18" width="6" height="1" />
        <rect x="39" y="15" width="1" height="4" />
        <rect x="39" y="15" width="6" height="1" />
        <rect x="45" y="12" width="1" height="4" />
        <rect x="45" y="12" width="6" height="1" />
      </g>
      <rect className="rs-elo-hop-stem" x="50" y="8" width="1" height="4" fill="var(--accent)" />
      <rect className="rs-elo-marker" x="49" y="11" width="3" height="3" fill="var(--accent)" />
    </svg>
  );
}
