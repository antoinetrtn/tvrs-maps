import { useMemo, useCallback } from "react";
import { countryDataMap } from "../data/gameData";
import { buildLearnExtraEntries } from "../utils/utils";
import { BREAKPOINTS } from "../config/gameConstants";

export function useGameDataPanelState({
  currentScreen,
  mode,
  viewport,
  learnToggles,
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
  const {
    showRivers: learnShowRivers,
    showMountains: learnShowMountains,
    showDepartments: learnShowDepartments,
  } = learnToggles;

  const isMobileViewport = viewport.width < BREAKPOINTS.desktop;

  const isPanelOpen = useMemo(() => {
    if (currentScreen !== "game") return false;
    if (mode === "learn") {
      return isMobileViewport ? showLearnPanel : true;
    }
    return showInfoModal || showResultsTable;
  }, [
    currentScreen,
    mode,
    isMobileViewport,
    showLearnPanel,
    showInfoModal,
    showResultsTable,
  ]);

  const learnExtraEntries = useMemo(
    () =>
      buildLearnExtraEntries(
        mode,
        learnShowDepartments,
        learnShowRivers,
        learnShowMountains,
      ),
    [mode, learnShowDepartments, learnShowRivers, learnShowMountains],
  );

  const panelDataMap =
    mode === "learn" && !learnShowDepartments ? countryDataMap : activeDataMap;
  const panelMode =
    mode === "learn" && learnShowDepartments ? "departments" : mode;

  const closePanel = useCallback(() => {
    setShowLearnPanel(false);
    setShowInfoModal(false);
    setShowResultsTable(false);
    if (isGameOver) setShowEndScreen(true);
  }, [isGameOver, setShowEndScreen, setShowInfoModal, setShowLearnPanel, setShowResultsTable]);

  const handlePanelSelect = useCallback(
    (key) => {
      setSelectedCountry(key);
      resetNavigationTrail(key);
      setPopupError(false);
    },
    [resetNavigationTrail, setPopupError, setSelectedCountry],
  );

  return {
    isMobileViewport,
    isPanelOpen,
    learnExtraEntries,
    panelDataMap,
    panelMode,
    closePanel,
    handlePanelSelect,
    learnShowDepartments,
  };
}