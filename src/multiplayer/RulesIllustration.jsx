import "./RulesIllustration.css";

import { useEffect, useMemo, useRef, useState } from "react";

import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { buildLetterPaths, MAP_ASCII, MAP_COLS, MAP_ROWS } from "./rulesIllustrationMap";

const DEFAULT_LABELS = {
  alt: "Aperçu d'une partie de Conquête : deux joueurs se disputent les pays d'une carte du monde.",
  you: "Toi",
  opponent: "Adversaire",
  free: "Libre",
  shielded: "Protégé",
};

function Hud() {
  return (
    <div className="ri-hud">
      <span className="ri-hud-side">
        <span className="ri-dot ri-dot-you" />
        <span className="ri-score">
          <span className="ri-score-before">30</span>
          <span className="ri-score-after">40</span>
        </span>
      </span>
      <span className="ri-timer">10:00</span>
      <span className="ri-hud-side">
        <span className="ri-score ri-score-opponent">20</span>
        <span className="ri-dot ri-dot-opponent" />
      </span>
    </div>
  );
}

function WorldMap({ paths }) {
  return (
    <svg
      className="ri-map"
      viewBox={`2 0 ${MAP_COLS - 3} ${MAP_ROWS}`}
      width="100%"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path className="ri-map-free" d={paths.f} />
      <path className="ri-map-you" d={paths.a} />
      <path className="ri-map-opponent" d={paths.o} />
      <path className="ri-map-you" d={paths.s} />
      <path className="ri-map-captured" d={paths.n} />
      <g className="ri-shield-pulse">
        <rect x="7" y="2" width="4" height="4" className="ri-ring" />
        <rect x="6" y="1" width="6" height="6" className="ri-ring ri-ring-outer" />
      </g>
      <text x="21.2" y="9" textAnchor="end" className="ri-pop-points">
        +10
      </text>
    </svg>
  );
}

function TypingField() {
  return (
    <div className="ri-field">
      <span className="ri-typed">France</span>
      <span className="ri-caret" />
    </div>
  );
}

function IllustrationLegend({ labels }) {
  return (
    <div className="ri-legend">
      <span className="ri-legend-item">
        <span className="ri-swatch ri-swatch-you" aria-hidden="true" />
        <span>{labels.you}</span>
      </span>
      <span className="ri-legend-item">
        <span className="ri-swatch ri-swatch-opponent" aria-hidden="true" />
        <span>{labels.opponent}</span>
      </span>
      <span className="ri-legend-item">
        <span className="ri-swatch ri-swatch-free" aria-hidden="true" />
        <span>{labels.free}</span>
      </span>
      <span className="ri-legend-item">
        <span className="ri-swatch ri-swatch-shielded" aria-hidden="true" />
        <span>{labels.shielded}</span>
      </span>
    </div>
  );
}

export default function RulesIllustration({ labels }) {
  const l = labels || DEFAULT_LABELS;
  const prefersReduced = usePrefersReducedMotion();
  const rootRef = useRef(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const node = rootRef.current;
    if (!node) {
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry?.isIntersecting ?? true);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const paths = useMemo(() => buildLetterPaths(MAP_ASCII), []);
  const isPlaying = inView && !prefersReduced;
  const classNames = [
    "rules-illu",
    isPlaying ? "is-playing" : "",
    prefersReduced ? "is-static" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={classNames} role="img" aria-label={l.alt}>
      <Hud />
      <WorldMap paths={paths} />
      <TypingField />
      <IllustrationLegend labels={l} />
    </div>
  );
}
