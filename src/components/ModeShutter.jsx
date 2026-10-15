import React, { useEffect, useState } from "react";

const BLINDS = Array.from({ length: 6 }, (_, i) => i);
// Last blind: 5 × stagger (40ms) + duration (160ms), plus a frame of margin.
const SHUTTER_MS = 400;

// Last top-level screen that mounted a shutter ("home" | "conquest"). The very
// first mount (app start) has no previous screen, so it never plays.
let lastScreen = null;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

/**
 * Solo ↔ Conquête switch: six blinds start closed over the incoming screen and
 * open top to bottom in steps. Purely decorative (pointer-events: none) and
 * removed after SHUTTER_MS. Rendered by both top-level screens; it only plays
 * when the previous screen was the other one, and never with reduced motion.
 */
const ModeShutter = ({ screen }) => {
  const [playing, setPlaying] = useState(
    () => lastScreen !== null && lastScreen !== screen && !prefersReducedMotion()
  );

  useEffect(() => {
    lastScreen = screen;
    if (!playing) return undefined;
    const id = setTimeout(() => setPlaying(false), SHUTTER_MS);
    return () => clearTimeout(id);
  }, [screen, playing]);

  if (!playing) return null;
  return (
    <div className="mode-shutter" aria-hidden="true" data-testid="mode-shutter">
      {BLINDS.map((i) => (
        <span key={i} className="mode-shutter-blind" style={{ "--i": i }} />
      ))}
    </div>
  );
};

export default ModeShutter;
