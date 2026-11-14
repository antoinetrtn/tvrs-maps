import { useEffect, useRef } from "react";

import { HOME_AUTOROTATE_INTERVAL_MS } from "../config/gameConstants";
import { pickNextAutorotateKey, pickRandomHomeKey } from "../utils/appHelpers";

/**
 * Coordinates the homepage showcase selection with the carousel settle window:
 * - Pauses auto-rotation while the user is browsing cards (`homeMode !== globeHomeMode`)
 *   so an interval tick never races a manual card change or emits a stale layer key.
 * - Selects a valid feature immediately upon entering home or settling on a new mode/layer.
 * - Cleans up its interval on mode changes, screen exit, or unmount.
 */
export function useHomeGlobeShowcase({
  currentScreen,
  homeMode,
  globeHomeMode,
  activeDataMap,
  selectedCountry,
  setSelectedCountry,
  autorotateIntervalMs = HOME_AUTOROTATE_INTERVAL_MS,
}) {
  const isHomeScreenActive = currentScreen === "home";
  const isSettled = isHomeScreenActive && homeMode === globeHomeMode;

  const selectedCountryRef = useRef(selectedCountry);
  selectedCountryRef.current = selectedCountry;

  const wasHomeRef = useRef(false);
  const prevSettledModeRef = useRef(globeHomeMode);
  const prevDataMapRef = useRef(activeDataMap);

  useEffect(() => {
    if (!isHomeScreenActive) {
      wasHomeRef.current = false;
      return undefined;
    }

    if (!isSettled || !activeDataMap) {
      return undefined;
    }

    const enteredHome = !wasHomeRef.current;
    const modeChanged = prevSettledModeRef.current !== globeHomeMode;
    const mapChanged = prevDataMapRef.current !== activeDataMap;
    const currentKey = selectedCountryRef.current;
    const hasValidSelection = Boolean(currentKey && activeDataMap[currentKey]?.lat !== undefined);

    wasHomeRef.current = true;
    prevSettledModeRef.current = globeHomeMode;
    prevDataMapRef.current = activeDataMap;

    if (enteredHome || modeChanged || mapChanged || !hasValidSelection) {
      const initialKey = pickRandomHomeKey(activeDataMap, enteredHome ? null : currentKey);
      if (initialKey) {
        selectedCountryRef.current = initialKey;
        setSelectedCountry(initialKey);
      }
    }

    const interval = setInterval(() => {
      const nextKey = pickNextAutorotateKey(activeDataMap, selectedCountryRef.current);
      if (nextKey) {
        selectedCountryRef.current = nextKey;
        setSelectedCountry(nextKey);
      }
    }, autorotateIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [
    isHomeScreenActive,
    isSettled,
    globeHomeMode,
    activeDataMap,
    autorotateIntervalMs,
    setSelectedCountry,
  ]);
}
