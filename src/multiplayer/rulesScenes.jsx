import { PixelText } from "./rulesPixelFont";

export function MatchScene() {
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
        className="rs-match-divider"
        x="31"
        y="6"
        width="1"
        height="18"
        fill="var(--glass-border-strong)"
      />
      <rect
        className="rs-match-player rs-match-player-left"
        x="14"
        y="12"
        width="6"
        height="6"
        fill="var(--accent)"
      />
      <rect
        className="rs-match-player rs-match-player-right"
        x="44"
        y="12"
        width="6"
        height="6"
        fill="var(--text-muted)"
      />
      <PixelText
        text="3"
        x={30}
        y={12}
        fill="var(--text-main)"
        className="rs-match-count rs-match-c3"
      />
      <PixelText
        text="2"
        x={30}
        y={12}
        fill="var(--text-main)"
        className="rs-match-count rs-match-c2"
      />
      <PixelText
        text="1"
        x={30}
        y={12}
        fill="var(--text-main)"
        className="rs-match-count rs-match-c1"
      />
      <rect x="8" y="27" width="48" height="2" fill="var(--glass-border)" />
      <rect className="rs-match-timer" x="8" y="27" width="48" height="2" fill="var(--accent)" />
    </svg>
  );
}

export function CaptureScene() {
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
        x="14"
        y="11"
        width="5"
        height="5"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <rect
        x="24"
        y="11"
        width="5"
        height="5"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <rect
        className="rs-capture-target"
        x="34"
        y="11"
        width="5"
        height="5"
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth="1"
      />
      <rect
        x="44"
        y="11"
        width="5"
        height="5"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <rect
        x="14"
        y="18"
        width="5"
        height="5"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <rect
        x="24"
        y="18"
        width="5"
        height="5"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <rect
        x="34"
        y="18"
        width="5"
        height="5"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <rect
        x="44"
        y="18"
        width="5"
        height="5"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1"
      />
      <PixelText text="+10" x={26} y={0} unit={2} fill="var(--accent)" className="rs-capture-pop" />
      <rect x="18" y="29" width="28" height="1" fill="var(--glass-border-strong)" />
      <rect
        className="rs-capture-type-1"
        x="20"
        y="26"
        width="3"
        height="2"
        fill="var(--text-main)"
      />
      <rect
        className="rs-capture-type-2"
        x="24"
        y="26"
        width="3"
        height="2"
        fill="var(--text-main)"
      />
      <rect
        className="rs-capture-type-3"
        x="28"
        y="26"
        width="3"
        height="2"
        fill="var(--text-main)"
      />
      <rect className="rs-capture-caret" x="20" y="26" width="2" height="2" fill="var(--accent)" />
    </svg>
  );
}

export function ShieldScene() {
  return (
    <svg
      viewBox="0 0 64 32"
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="rules-scene-svg"
    >
      <rect x="29" y="11" width="6" height="6" fill="var(--accent)" />
      <g className="rs-shield-ring">
        <rect
          x="26"
          y="8"
          width="12"
          height="12"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1"
        />
        <rect
          className="rs-shield-outer"
          x="24"
          y="6"
          width="16"
          height="16"
          fill="none"
          stroke="var(--glass-border-strong)"
          strokeWidth="1"
        />
      </g>
      <g className="rs-shield-cursor" fill="var(--text-muted)">
        <rect x="42" y="13" width="2" height="2" />
        <rect x="44" y="12" width="2" height="4" />
        <rect x="46" y="11" width="2" height="6" />
        <rect x="48" y="13" width="3" height="2" />
      </g>
      <rect x="16" y="27" width="32" height="2" fill="var(--glass-border)" />
      <rect className="rs-shield-timer" x="16" y="27" width="32" height="2" fill="var(--accent)" />
    </svg>
  );
}

export function StealScene() {
  return (
    <svg
      viewBox="0 0 64 32"
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="rules-scene-svg"
    >
      <g className="rs-steal-cell">
        <rect x="10" y="13" width="10" height="10" fill="var(--text-muted)" />
        <rect className="rs-steal-wipe" x="10" y="13" width="10" height="10" fill="var(--accent)" />
      </g>
      <g className="rs-steal-cursor" fill="var(--accent)">
        <rect x="16" y="18" width="2" height="5" />
        <rect x="18" y="20" width="2" height="3" />
        <rect x="20" y="22" width="2" height="2" />
      </g>
      <rect x="30" y="6" width="24" height="2" fill="var(--glass-border)" />
      <rect className="rs-steal-bar" x="30" y="6" width="24" height="2" fill="var(--accent)" />
      <rect
        x="30"
        y="12"
        width="6"
        height="4"
        fill="none"
        stroke="var(--glass-border-strong)"
        strokeWidth="1"
        className="rs-steal-flags"
      />
      <rect
        className="rs-steal-flag-picked"
        x="39"
        y="12"
        width="6"
        height="4"
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth="1"
      />
      <rect
        x="48"
        y="12"
        width="6"
        height="4"
        fill="none"
        stroke="var(--glass-border-strong)"
        strokeWidth="1"
        className="rs-steal-flags"
      />
      <rect
        x="30"
        y="19"
        width="6"
        height="4"
        fill="none"
        stroke="var(--glass-border-strong)"
        strokeWidth="1"
        className="rs-steal-flags"
      />
      <rect
        x="39"
        y="19"
        width="6"
        height="4"
        fill="none"
        stroke="var(--glass-border-strong)"
        strokeWidth="1"
        className="rs-steal-flags"
      />
      <rect
        x="48"
        y="19"
        width="6"
        height="4"
        fill="none"
        stroke="var(--glass-border-strong)"
        strokeWidth="1"
        className="rs-steal-flags"
      />
      <PixelText text="+15" x={4} y={0} unit={2} fill="var(--accent)" className="rs-steal-pop" />
    </svg>
  );
}
