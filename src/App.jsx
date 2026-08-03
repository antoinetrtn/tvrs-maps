import "./App.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AchievementToast from "./components/AchievementToast.jsx";
import AuthModal from "./components/AuthModal.jsx";
import ConfirmationModal from "./components/ConfirmationModal.jsx";
import GameSessionView from "./components/GameSessionView.jsx";
import HomeScreen from "./components/HomeScreen.jsx";
import { isValidLearnSubMode } from "./config/gameConfig";
import {
  BREAKPOINTS,
  DEFAULT_GAME_DURATION_SEC,
  DEFAULT_MODE,
  HOME_AUTOROTATE_INTERVAL_MS,
  PERFORMANCE,
  SCREEN_TRANSITION_MS,
  STORAGE_KEYS,
} from "./config/gameConstants";
import { useTranslation } from "./config/i18n";
import { countryDataMap } from "./data/gameData";
import { useAppTheme } from "./hooks/useAppTheme";
import { useCountrySelectHandler } from "./hooks/useCountrySelectHandler";
import { useGameDataPanelState } from "./hooks/useGameDataPanelState";
import { useGameSession } from "./hooks/useGameSession";
import { useGameSessionProps } from "./hooks/useGameSessionProps";
import { useGeoData } from "./hooks/useGeoData";
import { useHudAnswerHandler } from "./hooks/useHudAnswerHandler";
import { useUserProfile } from "./hooks/useUserProfile";
import { useViewport } from "./hooks/useViewport";
import { isSupabaseConfigured } from "./services/supabaseClient";

function App() {
  const [currentScreen, setCurrentScreen] = useState("home");

  const {
    session,
    userProfile,
    setUserProfile,
    localRecords,
    topExplorers,
    updateGameRecord,
    lastScores,
    localGameHistory,
  } = useUserProfile();

  const [mode, setMode] = useState(DEFAULT_MODE);
  const [gameDuration, setGameDuration] = useState(DEFAULT_GAME_DURATION_SEC);
  const [lang, setLang] = useState("fr");
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [homeMode, setHomeMode] = useState("countries");
  const prevActiveDataMapRef = useRef(null);
  const prevHomeModeRef = useRef(homeMode);

  const [peacefulMode, setPeacefulModeRaw] = useState(() => {
    try {
      const p = localStorage.getItem(STORAGE_KEYS.peacefulMode);
      if (p !== null) return p === "true";
      const h = localStorage.getItem(STORAGE_KEYS.hardcoreMode);
      if (h !== null) return h === "false";
    } catch {}
    return false;
  });

  const setPeacefulMode = useCallback((value) => {
    setPeacefulModeRaw(value);
    try {
      localStorage.setItem(STORAGE_KEYS.peacefulMode, String(value));
      localStorage.setItem(STORAGE_KEYS.hardcoreMode, String(!value));
    } catch {}
  }, []);

  const hardcoreMode = !peacefulMode;
  const setHardcoreMode = useCallback((value) => setPeacefulMode(!value), [setPeacefulMode]);

  const [showResultsTable, setShowResultsTable] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [isScreenGlitching, setIsScreenGlitching] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [achievementQueue, setAchievementQueue] = useState([]);
  const activeAchievement = achievementQueue[0] || null;
  const addAchievementToQueue = useCallback((a) => setAchievementQueue((prev) => [...prev, a]), []);
  const handleCloseAchievement = useCallback(
    () => setAchievementQueue((prev) => prev.slice(1)),
    []
  );

  const [learnSubMode, setLearnSubMode] = useState("countries");
  const [showLearnPanel, setShowLearnPanel] = useState(false);
  const [learnSearchQuery, setLearnSearchQuery] = useState("");

  const onLearnSubModeChange = useCallback(
    (subMode) => {
      if (!isValidLearnSubMode(subMode)) return;
      setLearnSubMode(subMode);
      setSelectedCountry(null);
      setLearnSearchQuery("");
    },
    [setSelectedCountry]
  );

  const t = useTranslation(lang);
  const extInputRef = useRef(null);
  const globeFeedbackApplierRef = useRef(null);
  const prevScreenRef = useRef(currentScreen);

  useEffect(() => {
    if (prevScreenRef.current !== currentScreen) {
      const isEnteringGame = currentScreen === "game" && prevScreenRef.current === "home";
      prevScreenRef.current = currentScreen;
      if (isEnteringGame) {
        setIsScreenGlitching(true);
        const timer = setTimeout(() => setIsScreenGlitching(false), SCREEN_TRANSITION_MS);
        return () => clearTimeout(timer);
      }
    }
  }, [currentScreen, showResultsTable]);

  useEffect(() => {
    if (isSupabaseConfigured && session === null) {
      if (localStorage.getItem("tvrs-guest-mode") !== "true") setShowAuthModal(true);
    } else if (session) {
      setShowAuthModal(false);
    }
  }, [session]);

  const handleGuest = useCallback(() => {
    localStorage.setItem("tvrs-guest-mode", "true");
    setShowAuthModal(false);
  }, []);

  const { viewport, isKeyboardMode } = useViewport();
  // Theme state + document-level CSS variables (extracted, see useAppTheme).
  const { theme, setTheme, globeTheme, setGlobeTheme, appStyle } = useAppTheme(viewport?.width);
  const {
    countriesData,
    departmentsData,
    usStatesData,
    activeDataMap,
    allCountryKeys,
    totalPossible,
  } = useGeoData({
    mode: currentScreen === "home" ? homeMode : mode,
    learnSubMode:
      currentScreen === "home" ? (homeMode === "capitals" ? "countries" : homeMode) : learnSubMode,
  });

  if (
    currentScreen === "home" &&
    (activeDataMap !== prevActiveDataMapRef.current || homeMode !== prevHomeModeRef.current)
  ) {
    prevActiveDataMapRef.current = activeDataMap;
    prevHomeModeRef.current = homeMode;
    if (activeDataMap) {
      const keys = Object.keys(activeDataMap).filter((k) => activeDataMap[k]?.lat !== undefined);
      if (keys.length > 0) {
        const index = Math.floor(Math.random() * keys.length);
        setSelectedCountry(keys[index]);
      }
    }
  }

  const {
    foundList,
    score,
    isPlaying,
    isGameOver,
    showEndScreen,
    setShowEndScreen,
    timeLeft,
    popupSuccess,
    popupError,
    popupWarning,
    setPopupError,
    setPopupWarning,
    isNewPB,
    xpResult,
    handleInput,
    specificCountryGuess,
    handleSearch,
    stopGame,
    resetGame,
    navigateFocus,
    resetNavigationTrail,
    globeFeedbackRef,
    livesLeft,
    isHardcoreRun,
    mistakes,
  } = useGameSession({
    mode,
    allCountryKeys,
    totalPossible,
    gameDuration,
    lang,
    userProfile,
    setUserProfile,
    localRecords,
    session,
    updateGameRecord,
    addAchievementToQueue,
    t,
    globeTheme,
    theme,
    selectedCountry,
    setSelectedCountry,
    activeDataMap,
    extInputRef,
    effectiveKeyboardMode: isKeyboardMode,
    globeFeedbackApplierRef,
    hardcoreMode,
  });

  // Transient red flash when a life is lost (wrong answer in game modes)
  const [lifeLostFlash, setLifeLostFlash] = useState(false);
  useEffect(() => {
    if (mistakes === 0) return undefined; // no flash on mount or resetGame
    setLifeLostFlash(true);
    const timeoutId = setTimeout(() => setLifeLostFlash(false), 1000);
    return () => clearTimeout(timeoutId);
  }, [mistakes]);

  const preserveInputFocus = useCallback(() => {
    if (mode === "learn") return;
    const input = extInputRef.current;
    if (!input) return;
    if (document.activeElement !== input) {
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
    }
  }, [mode]);

  const startGame = useCallback(
    (selectedMode, subMode) => {
      resetGame(selectedMode);
      setMode(selectedMode);
      if (selectedMode === "learn" && subMode) {
        setLearnSubMode(subMode);
      }
      setLearnSearchQuery("");
      setShowLearnPanel(false);
      setShowInfoModal(false);
      setShowResultsTable(false);
      setCurrentScreen("game");

      const refocus = () => {
        const input = extInputRef.current;
        if (input && document.activeElement !== input) {
          try {
            input.focus({ preventScroll: true });
          } catch {
            input.focus();
          }
        }
      };
      refocus();
      [50, 150, 300].forEach((ms) => setTimeout(refocus, ms));
    },
    [resetGame, extInputRef]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__TVRS_START_GAME__ = startGame;
    }
  }, [startGame]);

  const goHome = useCallback(() => {
    resetGame(DEFAULT_MODE);
    setSelectedCountry(null);
    setMode(DEFAULT_MODE);
    setHomeMode("countries");
    setShowLearnPanel(false);
    setLearnSearchQuery("");
    setShowInfoModal(false);
    setShowResultsTable(false);
    setCurrentScreen("home");
  }, [resetGame, setSelectedCountry]);

  useEffect(() => {
    if (currentScreen === "home") {
      setSelectedCountry(null);
    }
  }, [currentScreen]);

  useEffect(() => {
    if (currentScreen !== "home" || !activeDataMap) {
      return;
    }

    const interval = setInterval(() => {
      const freshKeys = Object.keys(activeDataMap).filter(
        (k) => activeDataMap[k]?.lat !== undefined
      );
      if (freshKeys.length === 0) return;
      const nextIndex = Math.floor(Math.random() * freshKeys.length);
      setSelectedCountry(freshKeys[nextIndex]);
    }, HOME_AUTOROTATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [currentScreen, activeDataMap, homeMode]);

  const handleCustomConfirm = (message, action) =>
    setConfirmState({
      message,
      onConfirm: () => {
        action();
        setConfirmState(null);
      },
    });

  const perfProfile = useMemo(() => {
    const isMobile = viewport.width < BREAKPOINTS.mobile;
    const isTablet = viewport.width >= BREAKPOINTS.mobile && viewport.width < BREAKPOINTS.desktop;
    const tier = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";
    const devicePixelRatio = window.devicePixelRatio || 1;
    const pixelRatio = Math.min(devicePixelRatio, PERFORMANCE.maxPixelRatio[tier]);
    return {
      isMobile,
      isTablet,
      pixelRatio,
      antialias: !isMobile,
      enableAutoRotate: true,
      enablePointerInteraction: true,
      maxLabels: PERFORMANCE.maxLabels[tier],
      showAtmosphere: true,
      useImageTextures: false,
      cullOffscreenCountries: isMobile,
      polygonCapCurvatureResolution: PERFORMANCE.polygonCapCurvatureResolution[tier],
    };
  }, [viewport.width]);

  const { isMobileViewport, isPanelOpen, panelDataMap, panelMode, closePanel, handlePanelSelect } =
    useGameDataPanelState({
      currentScreen,
      mode,
      viewport,
      learnSubMode,
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
    });

  useEffect(() => {
    if (mode === "learn" && selectedCountry && !activeDataMap[selectedCountry]) {
      setSelectedCountry(null);
    }
  }, [learnSubMode, mode, selectedCountry, activeDataMap, setSelectedCountry]);

  const handleHudEnter = useHudAnswerHandler({
    mode,
    selectedCountry,
    handleSearch,
    specificCountryGuess,
    handleInput,
    setPopupError,
    setPopupWarning,
  });

  const handleCountrySelect = useCountrySelectHandler({
    selectedCountry,
    setSelectedCountry,
    resetNavigationTrail,
    setPopupError,
    extInputRef,
    isLearnMode: mode === "learn",
    onAfterSelect: (key) => {
      if (mode === "learn" && isMobileViewport && key) {
        setShowLearnPanel(true);
      }
    },
  });

  const sessionView = useGameSessionProps({
    mode,
    goHome,
    lang,
    score,
    totalPossible,
    timeLeft,
    handleHudEnter,
    isPlaying,
    isGameOver,
    handleCustomConfirm,
    stopGame,
    t,
    setShowInfoModal,
    selectedCountry,
    setSelectedCountry,
    resetNavigationTrail,
    navigateFocus,
    popupError,
    popupWarning,
    popupSuccess,
    extInputRef,
    foundList,
    activeDataMap,
    theme,
    viewport,
    isKeyboardMode,
    globeTheme,
    learnSubMode,
    onLearnSubModeChange,
    learnSearchQuery,
    setLearnSearchQuery,
    setShowLearnPanel,
    showLearnPanel,
    isMobileViewport,
    countriesData,
    departmentsData,
    usStatesData,
    handleCountrySelect,
    perfProfile,
    currentScreen,
    showEndScreen,
    preserveInputFocus,
    countryDataMap,
    setShowEndScreen,
    setShowResultsTable,
    lastScores,
    localRecords,
    isNewPB,
    xpResult,
    isPanelOpen,
    closePanel,
    panelDataMap,
    handlePanelSelect,
    panelMode,
    showResultsTable,
    globeFeedbackRef,
    globeFeedbackApplierRef,
    livesLeft,
    isHardcoreRun,
    homeMode,
  });

  const panicActive = isPlaying && !isGameOver && timeLeft > 0 && timeLeft <= 30;

  return (
    <div
      className={`app-container ${theme} ${isScreenGlitching ? "glitch-active" : ""} ${isPanelOpen ? "data-panel-open" : ""}`}
      data-theme={theme}
      style={appStyle}
    >
      {(panicActive || lifeLostFlash) && (
        <div className={`panic-vignette-overlay${panicActive ? "" : " life-lost"}`} />
      )}
      {currentScreen === "home" ? (
        <HomeScreen
          onStartGame={startGame}
          theme={theme}
          setTheme={setTheme}
          lang={lang}
          setLang={setLang}
          gameDuration={gameDuration}
          setGameDuration={setGameDuration}
          hardcoreMode={hardcoreMode}
          setHardcoreMode={setHardcoreMode}
          peacefulMode={peacefulMode}
          setPeacefulMode={setPeacefulMode}
          globeTheme={globeTheme}
          setGlobeTheme={setGlobeTheme}
          topExplorers={topExplorers}
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          localRecords={localRecords}
          localGameHistory={localGameHistory}
          session={session}
          onOpenAuth={() => setShowAuthModal(true)}
          homeMode={homeMode}
          setHomeMode={setHomeMode}
        />
      ) : null}
      <GameSessionView
        {...sessionView}
        isMobileViewport={isMobileViewport}
        closePanel={closePanel}
      />
      {confirmState && (
        <ConfirmationModal
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
          theme={theme}
          lang={lang}
        />
      )}

      {activeAchievement && (
        <AchievementToast
          title={activeAchievement.title}
          message={activeAchievement.message}
          invaderId={activeAchievement.invaderId}
          color={activeAchievement.color}
          onClose={handleCloseAchievement}
        />
      )}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onGuest={handleGuest}
        lang={lang}
        theme={theme}
      />
    </div>
  );
}

export default App;
