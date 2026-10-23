import "./RulesIllustration.css";

import { useEffect, useMemo, useRef, useState } from "react";

import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { buildLetterPaths, MAP_ASCII, MAP_COLS, MAP_ROWS } from "./rulesIllustrationMap";

const DEFAULT_CAPTIONS = {
  select: "Sélectionne",
  name: "Nomme",
  captured: "Capturé +10",
  opponent: "Tour adverse",
  steal: "Vole +15",
  end: "Fin du chrono",
};

const DEFAULT_LABELS = {
  alt: "Déroulement d'un match de Conquête 1v1 : sélection et capture d'un pays (+10), tour adverse (+10), vol par défi avec bouclier (+15) et victoire 25 à 10 à la fin du chrono.",
  you: "TOI",
  opponent: "ADV",
  country: "France",
  captions: DEFAULT_CAPTIONS,
};

function Hud({ labels }) {
  return (
    <div className="ri-hud">
      <div className="ri-player ri-player-you">
        <span className="ri-legend-item">
          <span className="ri-swatch ri-swatch-you" aria-hidden="true" />
          <span className="ri-player-tag">{labels.you}</span>
        </span>
        <span className="ri-score-group" aria-hidden="true">
          <span className="ri-score ri-score-you">
            <span className="ri-score-you-0">0</span>
            <span className="ri-score-you-10">10</span>
            <span className="ri-score-you-25">25</span>
          </span>
          <span className="ri-delta ri-delta-you">
            <span className="ri-delta-you-10">+10</span>
            <span className="ri-delta-you-15">+15</span>
          </span>
        </span>
        <span className="ri-win-mark" aria-hidden="true" />
        <span className="ri-win-line" aria-hidden="true" />
      </div>

      <div className="ri-timer-track" aria-hidden="true">
        <div className="ri-timer-fill" />
      </div>

      <div className="ri-player ri-player-adv">
        <span className="ri-score-group" aria-hidden="true">
          <span className="ri-score ri-score-adv">
            <span className="ri-score-adv-0">0</span>
            <span className="ri-score-adv-10">10</span>
          </span>
          <span className="ri-delta ri-delta-adv">
            <span className="ri-delta-adv-10">+10</span>
          </span>
        </span>
        <span className="ri-legend-item">
          <span className="ri-player-tag">{labels.opponent}</span>
          <span className="ri-swatch ri-swatch-opponent" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function WorldMap({ paths }) {
  return (
    <svg
      className="ri-map"
      viewBox={`2 0 ${MAP_COLS - 4} ${MAP_ROWS}`}
      width="100%"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <defs>
        <pattern id="ri-adv-pattern" width="1" height="1" patternUnits="userSpaceOnUse">
          <rect width="1" height="1" className="ri-adv-cell-base" />
          <rect x="0.25" y="0.25" width="0.5" height="0.5" className="ri-adv-cell-cut" />
        </pattern>
      </defs>

      <path className="ri-map-neutral" d={paths.all} />
      <path className="ri-map-you" d={paths.a} />
      <path className="ri-map-steal-adv" d={paths.s} />
      <path className="ri-map-steal-you" d={paths.s} />

      <rect x="21.5" y="3.5" width="5" height="4" className="ri-select ri-select-you" />
      <rect x="31.5" y="3.5" width="5" height="4" className="ri-select ri-select-adv" />
      <rect x="31.5" y="3.5" width="5" height="4" className="ri-select ri-select-steal" />

      <g className="ri-shield">
        <rect x="32.8" y="4.3" width="2.4" height="2.4" className="ri-shield-plate" />
        <rect x="33.5" y="5" width="1" height="1" className="ri-shield-core" />
      </g>
    </svg>
  );
}

function FooterBar({ labels }) {
  const c = labels.captions || DEFAULT_CAPTIONS;
  const country = labels.country || DEFAULT_LABELS.country;

  return (
    <div className="ri-footer" aria-hidden="true">
      <div className="ri-captions">
        <span className="ri-cap ri-cap-select">{c.select}</span>
        <span className="ri-cap ri-cap-name">{c.name}</span>
        <span className="ri-cap ri-cap-captured">{c.captured}</span>
        <span className="ri-cap ri-cap-opponent">{c.opponent}</span>
        <span className="ri-cap ri-cap-steal">{c.steal}</span>
        <span className="ri-cap ri-cap-end">{c.end}</span>
      </div>

      <div className="ri-action-slot">
        <div className="ri-field">
          <span className="ri-typed">{country}</span>
          <span className="ri-caret" />
        </div>
        <div className="ri-quiz">
          <span className="ri-quiz-cell" />
          <span className="ri-quiz-cell">
            <span className="ri-quiz-pick" />
          </span>
          <span className="ri-quiz-cell" />
          <span className="ri-quiz-cell" />
          <span className="ri-quiz-cell" />
          <span className="ri-quiz-cell" />
        </div>
      </div>

      <div className="ri-steps">
        <span className="ri-step ri-step-1" />
        <span className="ri-step ri-step-2" />
        <span className="ri-step ri-step-3" />
        <span className="ri-step ri-step-4" />
        <span className="ri-step ri-step-5" />
      </div>
    </div>
  );
}

export default function RulesIllustration({ labels }) {
  const l = labels ? { ...DEFAULT_LABELS, ...labels } : DEFAULT_LABELS;
  const prefersReduced = usePrefersReducedMotion();
  const rootRef = useRef(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
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
      <Hud labels={l} />
      <WorldMap paths={paths} />
      <FooterBar labels={l} />
    </div>
  );
}
