import { useEffect, useRef, useState } from "react";

import { SCREEN_TRANSITION_MS } from "../config/gameConstants";

/** True for SCREEN_TRANSITION_MS after the switch home -> game (drives `.glitch-active`). */
export default function useScreenGlitch(currentScreen) {
  const [glitching, setGlitching] = useState(false);
  const prevScreenRef = useRef(currentScreen);

  useEffect(() => {
    const wasHome = prevScreenRef.current === "home";
    prevScreenRef.current = currentScreen;
    if (!(wasHome && currentScreen === "game")) return undefined;
    setGlitching(true);
    const timer = setTimeout(() => setGlitching(false), SCREEN_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [currentScreen]);

  return glitching;
}
