import "./RulesIllustration.css";

import { useCallback, useEffect, useRef, useState } from "react";

import { CONQUEST_PLAYER_COLORS } from "../config/designSystem";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { getConquestRulesText } from "./conquestRulesText";

/** The demo video shows the real "teal" player colour: the legend uses the same source. */
const FRAME_STYLE = { "--ri-you": CONQUEST_PLAYER_COLORS.teal };

const WEBM_SRC = "/conquest-demo/conquete-demo.webm";
const MP4_SRC = "/conquest-demo/conquete-demo.mp4";
const POSTER_SRC = "/conquest-demo/conquete-demo-poster.webp";

const BEAT_KEYS = ["capture", "opponent", "steal", "end"];
const STEAL_BEAT_INDEX = 2;

const DEFAULT_LABELS = getConquestRulesText("fr").illustration;
const DEFAULT_CAPTIONS = DEFAULT_LABELS.captions;

function getBeatIndex(time) {
  if (!Number.isFinite(time) || time < 4.2) {
    return 0;
  }
  if (time < 6.6) {
    return 1;
  }
  if (time < 10.2) {
    return 2;
  }
  return 3;
}

function safePlay(video) {
  if (!video || typeof video.play !== "function") {
    return;
  }
  try {
    const promise = video.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {});
    }
  } catch {}
}

function safePause(video) {
  if (!video || typeof video.pause !== "function") {
    return;
  }
  try {
    video.pause();
  } catch {}
}

export default function RulesIllustration({ labels }) {
  const l = labels ? { ...DEFAULT_LABELS, ...labels } : DEFAULT_LABELS;
  const captions = l.captions ? { ...DEFAULT_CAPTIONS, ...l.captions } : DEFAULT_CAPTIONS;
  const prefersReduced = usePrefersReducedMotion();
  const rootRef = useRef(null);
  const videoRef = useRef(null);

  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");
  const [hasEntered, setHasEntered] = useState(() => typeof IntersectionObserver === "undefined");
  const [docHidden, setDocHidden] = useState(
    () => typeof document !== "undefined" && document.hidden === true
  );
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (prefersReduced) {
      return undefined;
    }
    if (typeof IntersectionObserver === "undefined") {
      setHasEntered(true);
      setInView(true);
      return undefined;
    }
    const node = rootRef.current;
    if (!node) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        setInView(visible);
        if (visible) {
          setHasEntered(true);
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [prefersReduced]);

  useEffect(() => {
    if (prefersReduced || typeof document === "undefined") {
      return undefined;
    }
    const handleVisibility = () => {
      setDocHidden(document.hidden === true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [prefersReduced]);

  const isPlaying = !prefersReduced && inView && !docHidden;

  useEffect(() => {
    if (prefersReduced || !hasEntered) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (isPlaying) {
      safePlay(video);
    } else {
      safePause(video);
    }
  }, [isPlaying, hasEntered, prefersReduced]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const nextBeat = getBeatIndex(video.currentTime);
    setBeat((prev) => (prev === nextBeat ? prev : nextBeat));
  }, []);

  const activeBeat = prefersReduced ? STEAL_BEAT_INDEX : beat;
  const classNames = [
    "rules-illu",
    isPlaying ? "is-playing" : "",
    prefersReduced ? "is-static" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure
      ref={rootRef}
      className={classNames}
      style={FRAME_STYLE}
      role="img" // NOSONAR
      aria-label={l.alt}
    >
      <div className="ri-legend" aria-hidden="true">
        <span className="ri-legend-item">
          <span className="ri-swatch ri-swatch-you" />
          <span>{l.you}</span>
        </span>
        <span className="ri-legend-item ri-legend-item-opponent">
          <span>{l.opponent}</span>
          <span className="ri-swatch ri-swatch-opponent" />
        </span>
      </div>

      <div className="ri-frame" aria-hidden="true">
        {prefersReduced ? (
          <img className="ri-media" src={POSTER_SRC} alt="" aria-hidden="true" />
        ) : (
          <video
            ref={videoRef}
            className="ri-media"
            muted
            loop
            playsInline
            preload="metadata"
            poster={POSTER_SRC}
            aria-hidden="true"
            tabIndex={-1}
            onTimeUpdate={handleTimeUpdate}
          >
            {hasEntered && (
              <>
                <source src={WEBM_SRC} type="video/webm" />
                <source src={MP4_SRC} type="video/mp4" />
              </>
            )}
          </video>
        )}
      </div>

      <figcaption className="ri-footer" aria-hidden="true">
        <div className="ri-captions">
          {BEAT_KEYS.map((key, idx) => (
            <span key={key} className={`ri-cap${idx === activeBeat ? " is-active" : ""}`}>
              {captions[key]}
            </span>
          ))}
        </div>
        <div className="ri-steps">
          {BEAT_KEYS.map((key, idx) => {
            const filled = prefersReduced || idx <= activeBeat;
            return <span key={key} className={`ri-step${filled ? " is-filled" : ""}`} />;
          })}
        </div>
      </figcaption>
    </figure>
  );
}
