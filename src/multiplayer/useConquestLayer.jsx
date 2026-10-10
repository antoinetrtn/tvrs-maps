import "./ConquestScreen.css";

import React, { useCallback, useMemo, useState } from "react";

import { isConquestEnabled } from "./conquestConfig";
import ConquestScreen from "./ConquestScreen.jsx";
import { useConquestMatch } from "./useConquestMatch";

const noop = () => {};
const EMPTY_FOUND = [];

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
  const [ownershipColors, setOwnershipColors] = useState(null);
  const conquest = useConquestMatch({
    lang,
    displayName: (userProfile?.username || "Explorer").slice(0, 30),
  });

  const open = useCallback(() => setCurrentScreen("conquest"), [setCurrentScreen]);
  const exit = useCallback(() => {
    setOwnershipColors(null);
    setCurrentScreen("home");
  }, [setCurrentScreen]);

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
        selectedCountry: null,
        onCountrySelect: noop,
        isHomeScreen: false,
        isEndScreen: false,
        ownershipColors,
      },
    };
  }, [active, sessionView, ownershipColors]);

  const screen = active ? (
    <ConquestScreen
      lang={lang}
      conquest={conquest}
      onExit={exit}
      onOwnershipChange={setOwnershipColors}
    />
  ) : null;

  return { open: enabled ? open : null, sessionView: view, screen };
}
