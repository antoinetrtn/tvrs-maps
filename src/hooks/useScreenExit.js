import { useEffect, useState } from "react";

import { EXIT_MS } from "../config/gameConstants";
import { prefersReducedMotion } from "./usePrefersReducedMotion";

export { EXIT_MS };

/**
 * Two-step home -> game transition: the home screen stays mounted (and the
 * caller makes it inert) for `exitMs` while it plays its exit, then unmounts.
 * Other switches (Conquête, back to home) are not staged. No staging at all
 * with prefers-reduced-motion. The visual-only delay never blocks game logic.
 */
export default function useScreenExit(currentScreen, exitMs = EXIT_MS) {
  const [prevScreen, setPrevScreen] = useState(currentScreen);
  const [exiting, setExiting] = useState(false);

  // Derived during render so the home never unmounts for a frame before the exit starts.
  if (prevScreen !== currentScreen) {
    setPrevScreen(currentScreen);
    setExiting(prevScreen === "home" && currentScreen === "game" && !prefersReducedMotion());
  }

  useEffect(() => {
    if (!exiting) return undefined;
    const id = setTimeout(() => setExiting(false), exitMs);
    return () => clearTimeout(id);
  }, [exiting, exitMs]);

  const homeExiting = exiting && currentScreen !== "home";
  return { showHome: currentScreen === "home" || homeExiting, homeExiting };
}
