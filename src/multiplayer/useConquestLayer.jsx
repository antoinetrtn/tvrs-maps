import "../components/ui/ui.css";
import "./ConquestScreen.css";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ModeShutter from "../components/ModeShutter.jsx";
import { isConquestEnabled } from "./conquestConfig";
import ConquestCursorLayer from "./ConquestCursorLayer.jsx";
import { CONQUEST_FOCUS_HOLD_MS, nextConquestFocus, shouldAutoRelease } from "./conquestFocus";
import { clearConquestParam, readConquestCode } from "./conquestLink";
import ConquestScreen from "./ConquestScreen.jsx";
import { hasStoredConquestMatch, useConquestMatch } from "./useConquestMatch";

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
  const [overlay, setOverlay] = useState(null);
  const [focus, setFocus] = useState(null);
  // The HUD registers what a globe click does (steal / focus the input).
  const countryClickRef = useRef(null);
  const handleCountryClick = useCallback((admin) => {
    if (admin) countryClickRef.current?.(admin);
    else setFocus(null);
  }, []);
  const conquest = useConquestMatch({
    lang,
    displayName: (userProfile?.username || "Explorer").slice(0, 30),
  });

  const open = useCallback(() => setCurrentScreen("conquest"), [setCurrentScreen]);

  // Invite link (?conquest=CODE): open the lobby and auto-join, then clean the URL.
  // With the flag off the parameter is simply dropped.
  const { resume, join } = conquest;
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    const code = readConquestCode();
    if (!code) return;
    resumedRef.current = true;
    if (!enabled) {
      clearConquestParam();
      return;
    }
    open();
    join(code)
      .catch(() => {})
      .finally(() => clearConquestParam());
  }, [enabled, join, open]);

  // Reload / killed tab: reopen the match the player was in.
  useEffect(() => {
    if (resumedRef.current || !enabled || !hasStoredConquestMatch()) return;
    resumedRef.current = true;
    resume()
      .then((ok) => ok && open())
      .catch(() => {});
  }, [enabled, resume, open]);
  const exit = useCallback(() => {
    setOverlay(null);
    setFocus(null);
    setCurrentScreen("home");
  }, [setCurrentScreen]);

  const focusCountry = useCallback(
    (id) => setFocus((prev) => nextConquestFocus(prev, id, { sticky: false })),
    []
  );
  const selectCountry = useCallback(
    (id) => setFocus((prev) => nextConquestFocus(prev, id, { sticky: true })),
    []
  );

  // Transient focus (feed click, lockout, capture result): briefly select the
  // country so the camera centres it, then release it so the owner colour shows again.
  // Sticky selections (user tapped on the globe) stay until tapped again or deselected.
  useEffect(() => {
    if (!shouldAutoRelease(focus)) return undefined;
    const id = setTimeout(() => setFocus(null), CONQUEST_FOCUS_HOLD_MS);
    return () => clearTimeout(id);
  }, [focus]);

  const basePerf = sessionView.globeProps.perfProfile;
  // No country labels during a match: a label shows the flag/capital, which
  // would leak the answer of a steal challenge.
  const perfProfile = useMemo(() => ({ ...basePerf, maxLabels: 0 }), [basePerf]);

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
        selectedCountry: focus?.id || null,
        onCountrySelect: handleCountryClick,
        perfProfile,
        isHomeScreen: false,
        isEndScreen: false,
        conquestOverlay: overlay,
      },
    };
  }, [active, sessionView, overlay, focus, handleCountryClick, perfProfile]);

  const screen = active ? (
    <>
      <ModeShutter screen="conquest" />
      <ConquestCursorLayer
        conquest={conquest}
        countriesData={sessionView.globeProps.countriesData}
        selectedCountryId={focus?.id || null}
      />
      <ConquestScreen
        lang={lang}
        conquest={conquest}
        onExit={exit}
        onOverlayChange={setOverlay}
        onFocusCountry={focusCountry}
        onSelectCountry={selectCountry}
        countryClickRef={countryClickRef}
      />
    </>
  ) : null;

  return { open: enabled ? open : null, sessionView: view, screen };
}
