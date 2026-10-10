import "./ConquestScreen.css";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { isConquestEnabled } from "./conquestConfig";
import ConquestScreen from "./ConquestScreen.jsx";
import { useConquestMatch } from "./useConquestMatch";

const noop = () => {};
const EMPTY_FOUND = [];
const FOCUS_HOLD_MS = 2500;

/**
 * Wires the « Conquête » mode into App: entry callback (null while the flag is
 * off, so the home button stays hidden), globe overrides and the overlay.
 */
export function useConquestLayer({
  currentScreen,
  setCurrentScreen,
  lang,
  userProfile,
  sessionView,
}) {
  const enabled = isConquestEnabled();
  const active = enabled && currentScreen === "conquest";
  const [overlay, setOverlay] = useState(null);
  const [focusCountry, setFocusCountry] = useState(null);
  const conquest = useConquestMatch({
    lang,
    displayName: (userProfile?.username || "Explorer").slice(0, 30),
  });

  const open = useCallback(() => setCurrentScreen("conquest"), [setCurrentScreen]);
  const exit = useCallback(() => {
    setOverlay(null);
    setFocusCountry(null);
    setCurrentScreen("home");
  }, [setCurrentScreen]);

  // Feed click / capture: briefly select the country so the camera centres it,
  // then release the selection so the owner colour shows again.
  useEffect(() => {
    if (!focusCountry) return undefined;
    const id = setTimeout(() => setFocusCountry(null), FOCUS_HOLD_MS);
    return () => clearTimeout(id);
  }, [focusCountry]);

  const view = useMemo(() => {
    if (!active) return sessionView;
    return {
      ...sessionView,
      showHud: false,
      showEndScreen: false,
      gamePanelOpen: false,
      globeProps: {
        ...sessionView.globeProps,
        mode: "countries",
        foundList: EMPTY_FOUND,
        selectedCountry: focusCountry,
        onCountrySelect: noop,
        isHomeScreen: false,
        isEndScreen: false,
        conquestOverlay: overlay,
      },
    };
  }, [active, sessionView, overlay, focusCountry]);

  const screen = active ? (
    <ConquestScreen
      lang={lang}
      conquest={conquest}
      onExit={exit}
      onOverlayChange={setOverlay}
      onFocusCountry={setFocusCountry}
    />
  ) : null;

  return { open: enabled ? open : null, sessionView: view, screen };
}
