import "./App.css";

import React, { useCallback, useEffect, useRef, useState } from "react";

import AchievementStack from "./components/AchievementStack.jsx";
import GameSessionView from "./components/GameSessionView.jsx";
import GeoDataStatus from "./components/GeoDataStatus.jsx";
import { getHomeGeoMode, getHomeLearnSubMode, HOME_CONQUEST_KEY } from "./components/homeModes";
import HomeScreen from "./components/HomeScreen.jsx";
import { ToastViewport } from "./components/ui/Toast.jsx";
import { isValidLearnSubMode } from "./config/gameConfig";
import {
  DEFAULT_GAME_DURATION_SEC,
  DEFAULT_MODE,
  HOME_AUTOROTATE_INTERVAL_MS,
  HOME_GLOBE_SETTLE_MS,
  STORAGE_KEYS,
} from "./config/gameConstants";
import { useTranslation } from "./config/i18n";
import { countryDataMap } from "./data/gameData";
import useAchievementToasts from "./hooks/useAchievementToasts.jsx";
import { useAppTheme } from "./hooks/useAppTheme";
import { useCountrySelectHandler } from "./hooks/useCountrySelectHandler";
import { useCountryStatsRecorder } from "./hooks/useCountryStatsRecorder";
import { useGameDataPanelState } from "./hooks/useGameDataPanelState";
import { useGameSession } from "./hooks/useGameSession";
import { useGameSessionProps } from "./hooks/useGameSessionProps";
import { useGeoData } from "./hooks/useGeoData";
import { useHudAnswerHandler } from "./hooks/useHudAnswerHandler";
import useMountedOnce from "./hooks/useMountedOnce";
import { usePerfProfile } from "./hooks/usePerfProfile";
import useScreenExit, { EXIT_MS } from "./hooks/useScreenExit";
import useScreenGlitch from "./hooks/useScreenGlitch";
import useSettledValue from "./hooks/useSettledValue";
import { useTrainingRun } from "./hooks/useTrainingRun";
import { useUserProfile } from "./hooks/useUserProfile";
import { useViewport } from "./hooks/useViewport";
import { isGuestLaunch } from "./multiplayer/conquestLink";
import { useConquestLayer } from "./multiplayer/useConquestLayer.jsx";
import { isSupabaseConfigured } from "./services/supabaseClient";
import { secureRandomInt } from "./utils/secureRandom";

const AuthModal = React.lazy(() => import("./components/AuthModal.jsx"));
const ConfirmationModal = React.lazy(() => import("./components/ConfirmationModal.jsx"));

function App() {
  const [currentScreen, setCurrentScreen] = useState("home");
  const { showHome, homeExiting } = useScreenExit(currentScreen, EXIT_MS);

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
  const [homeMode, setHomeMode] = useState(HOME_CONQUEST_KEY);
  const prevActiveDataMapRef = useRef(null);
  // Globe layer for the home screen: follows the carousel only once it settles.
  const isHomeScreenActive = currentScreen === "home";
  const globeHomeMode = useSettledValue(homeMode, HOME_GLOBE_SETTLE_MS, isHomeScreenActive);
  const prevHomeModeRef = useRef(globeHomeMode);

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
  const isScreenGlitching = useScreenGlitch(currentScreen);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const authMounted = useMountedOnce(showAuthModal);

  const { addAchievementToQueue, achievements, dismissAchievement } = useAchievementToasts();
  if (import.meta.env.DEV) globalThis.__TVRS_PUSH_ACHIEVEMENT__ = addAchievementToQueue;

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

  useEffect(() => {
    if (isSupabaseConfigured && session === null) {
      if (!isGuestLaunch()) setShowAuthModal(true); // guest mode or Conquête invite link
    } else if (session) {
      setShowAuthModal(false);
    }
  }, [session]);

  const handleGuest = useCallback(() => {
    localStorage.setItem("tvrs-guest-mode", "true");
    setShowAuthModal(false);
  }, []);
  const { viewport, isKeyboardMode } = useViewport();
  const { appStyle } = useAppTheme(viewport?.width); // unified theme + document CSS vars
  const {
    countriesData,
    departmentsData,
    usStatesData,
    activeDataMap,
    allCountryKeys,
    totalPossible,
    geoStatus,
  } = useGeoData({
    mode: currentScreen === "home" ? getHomeGeoMode(globeHomeMode) : mode,
    learnSubMode: currentScreen === "home" ? getHomeLearnSubMode(globeHomeMode) : learnSubMode,
  });

  if (
    currentScreen === "home" &&
    (activeDataMap !== prevActiveDataMapRef.current || globeHomeMode !== prevHomeModeRef.current)
  ) {
    prevActiveDataMapRef.current = activeDataMap;
    prevHomeModeRef.current = globeHomeMode;
    if (activeDataMap) {
      const keys = Object.keys(activeDataMap).filter((k) => activeDataMap[k]?.lat !== undefined);
      if (keys.length > 0) {
        const index = secureRandomInt(0, keys.length);
        setSelectedCountry(keys[index]);
      }
    }
  }

  const { trainingPool, setTrainingPool, clearTraining, sessionKeys, sessionTotal } =
    useTrainingRun({ allCountryKeys, totalPossible });

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
    allCountryKeys: sessionKeys,
    totalPossible: sessionTotal,
    trainingPool,
    gameDuration,
    lang,
    userProfile,
    setUserProfile,
    localRecords,
    session,
    updateGameRecord,
    addAchievementToQueue,
    t,
    selectedCountry,
    setSelectedCountry,
    activeDataMap,
    extInputRef,
    effectiveKeyboardMode: isKeyboardMode,
    globeFeedbackApplierRef,
    hardcoreMode,
  });

  useCountryStatsRecorder({
    mode,
    profileId: userProfile?.id,
    currentScreen,
    selectedCountry,
    foundList,
    isPlaying,
    isGameOver,
    popupError,
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
    (selectedMode, subMode, pool = null) => {
      resetGame(selectedMode);
      setMode(selectedMode);
      setTrainingPool(pool?.length ? pool : null); // entraînement ciblé : 1re cible = la moins maîtrisée
      if (pool?.length) setSelectedCountry(pool[0]);
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
    [resetGame, extInputRef, setTrainingPool]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__TVRS_START_GAME__ = startGame;
    }
  }, [startGame]);

  const goHome = useCallback(() => {
    resetGame(DEFAULT_MODE);
    clearTraining();
    setSelectedCountry(null);
    setMode(DEFAULT_MODE);
    setHomeMode(HOME_CONQUEST_KEY);
    setShowLearnPanel(false);
    setLearnSearchQuery("");
    setShowInfoModal(false);
    setShowResultsTable(false);
    setCurrentScreen("home");
  }, [resetGame, setSelectedCountry, clearTraining]);

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
  }, [currentScreen, activeDataMap, globeHomeMode]);

  const handleCustomConfirm = (message, action) =>
    setConfirmState({
      message,
      onConfirm: () => {
        action();
        setConfirmState(null);
      },
    });

  const perfProfile = usePerfProfile(viewport.width);

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
    totalPossible: sessionTotal,
    trainingPool,
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
    viewport,
    isKeyboardMode,
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
    homeMode: getHomeGeoMode(globeHomeMode),
  });

  const cq = useConquestLayer({ currentScreen, setCurrentScreen, lang, userProfile, sessionView });
  const panicActive = isPlaying && !isGameOver && timeLeft > 0 && timeLeft <= 30;

  return (
    <div
      className={`app-container ${isScreenGlitching ? "glitch-active" : ""} ${isPanelOpen ? "data-panel-open" : ""}`}
      style={appStyle}
    >
      {(panicActive || lifeLostFlash) && (
        <div className={`panic-vignette-overlay${panicActive ? "" : " life-lost"}`} />
      )}
      {showHome ? (
        <HomeScreen
          onStartGame={startGame}

          lang={lang}
          setLang={setLang}
          gameDuration={gameDuration}
          setGameDuration={setGameDuration}
          hardcoreMode={hardcoreMode}
          setHardcoreMode={setHardcoreMode}
          peacefulMode={peacefulMode}
          setPeacefulMode={setPeacefulMode}
          topExplorers={topExplorers}
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          localRecords={localRecords}
          localGameHistory={localGameHistory}
          session={session}
          onOpenAuth={() => setShowAuthModal(true)}
          homeMode={homeMode}
          setHomeMode={setHomeMode}
          onOpenConquest={cq.open}
          exiting={homeExiting}
        />
      ) : null}
      <GameSessionView
        {...cq.sessionView}
        isMobileViewport={isMobileViewport}
        closePanel={closePanel}
      />
      {cq.screen}
      {confirmState && (
        <React.Suspense fallback={null}>
          <ConfirmationModal
            message={confirmState.message}
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(null)}

            lang={lang}
          />
        </React.Suspense>
      )}

      <ToastViewport />
      <AchievementStack achievements={achievements} onDismiss={dismissAchievement} />
      <GeoDataStatus status={geoStatus.status} onRetry={geoStatus.retry} lang={lang} />
      {authMounted && (
        <React.Suspense fallback={null}>
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onGuest={handleGuest}
            lang={lang}
          />
        </React.Suspense>
      )}
    </div>
  );
}

export default App;
