import { useCallback, useMemo } from "react";

import { DEFAULT_LEARN_SUB_MODE } from "../config/gameConfig";
import { BREAKPOINTS } from "../config/gameConstants";

export function useGameDataPanelState({
  currentScreen,
  mode,
  viewport,
  learnSubMode = DEFAULT_LEARN_SUB_MODE,
  showLearnPanel,
  showInfoModal,
  showResultsTable,
  activeDataMap,
  isGameOver,
  setShowLearnPanel,
  setShowInfoModal,
  setShowResultsTable,
  setShowEndScreen,
  setSelectedCountry,
  resetNavigationTrail,
  setPopupError,
}) {
  const isMobileViewport = viewport.width < BREAKPOINTS.desktop;

  const isPanelOpen = useMemo(() => {
    if (currentScreen !== "game") return false;
    if (mode === "learn") {
      return isMobileViewport ? showLearnPanel : true;
    }
    return showInfoModal || showResultsTable;
  }, [currentScreen, mode, isMobileViewport, showLearnPanel, showInfoModal, showResultsTable]);

  const panelDataMap = activeDataMap;
  const panelMode = mode === "learn" ? learnSubMode : mode;

  const closePanel = useCallback(
    ({ keepEndScreenHidden = false } = {}) => {
      setShowLearnPanel(false);
      setShowInfoModal(false);
      setShowResultsTable(false);
      if (isGameOver && !keepEndScreenHidden) setShowEndScreen(true);
    },
    [isGameOver, setShowEndScreen, setShowInfoModal, setShowLearnPanel, setShowResultsTable]
  );

  const handlePanelSelect = useCallback(
    (key) => {
      setSelectedCountry(key);
      resetNavigationTrail(key);
      setPopupError(false);
      if (isMobileViewport && key) {
        closePanel({ keepEndScreenHidden: true });
      }
    },
    [resetNavigationTrail, setPopupError, setSelectedCountry, isMobileViewport, closePanel]
  );

  return {
    isMobileViewport,
    isPanelOpen,
    panelDataMap,
    panelMode,
    closePanel,
    handlePanelSelect,
  };
}
