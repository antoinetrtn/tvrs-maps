import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import HomeScreen from "./components/HomeScreen.jsx";
import GameSessionView from "./components/GameSessionView.jsx";
import ConfirmationModal from "./components/ConfirmationModal.jsx";
import { useGameDataPanelState } from "./hooks/useGameDataPanelState";
import { useHudAnswerHandler } from "./hooks/useHudAnswerHandler";
import { useCountrySelectHandler } from "./hooks/useCountrySelectHandler";
import { useGameSessionProps } from "./hooks/useGameSessionProps";

import "./App.css";
import { countryDataMap } from "./data/gameData";
import { useTranslation } from "./config/i18n";
import { useUserProfile } from "./hooks/useUserProfile";
import {
  getThemeCssVariables,
  GLOBE_THEME_IDS,
  DEFAULT_GLOBE_THEME,
} from "./config/designSystem";
import AchievementToast from "./components/AchievementToast.jsx";
import AuthModal from "./components/AuthModal.jsx";
import {
  DEFAULT_MODE,
  DEFAULT_GAME_DURATION_SEC,
  HOME_AUTOROTATE_INTERVAL_MS,
  BREAKPOINTS,
  STORAGE_KEYS,
  PERFORMANCE,
} from "./config/gameConstants";
import { isValidLearnSubMode } from "./config/gameConfig";
import { isSupabaseConfigured } from "./services/supabaseClient";

import { useViewport } from "./hooks/useViewport";
import { useGeoData } from "./hooks/useGeoData";
import { useGameSession } from "./hooks/useGameSession";

function App() {
  const [currentScreen, setCurrentScreen] = useState("home");

  const {
    session,
    userProfile,
    setUserProfile,
    localRecords,
    topExplorers,
    updateGameRecord,
    lastScores
  } = useUserProfile();

  const [mode, setMode] = useState(DEFAULT_MODE);
  const [gameDuration, setGameDuration] = useState(DEFAULT_GAME_DURATION_SEC);
  const [lang, setLang] = useState("fr");
  const [selectedCountry, setSelectedCountry] = useState(null);

  const [showResultsTable, setShowResultsTable] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [isScreenGlitching, setIsScreenGlitching] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [achievementQueue, setAchievementQueue] = useState([]);
  const activeAchievement = achievementQueue[0] || null;
  const addAchievementToQueue = useCallback((achievement) => {
    setAchievementQueue((prev) => [...prev, achievement]);
  }, []);
  const handleCloseAchievement = useCallback(() => {
    setAchievementQueue((prev) => prev.slice(1));
  }, []);

  const [theme, setTheme] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.globeTheme);
      if (!cached || cached === "blackout") return "dark";
    } catch (_) {}
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "dark";
  });

  const [globeTheme, setGlobeThemeRaw] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.globeTheme);
      if (cached && GLOBE_THEME_IDS.includes(cached)) return cached;
    } catch (_) {}
    return DEFAULT_GLOBE_THEME;
  });

  const setGlobeTheme = useCallback(
    (t) => {
      setGlobeThemeRaw(t);
      if (t === "blackout") {
        setTheme("dark");
      }
      try {
        localStorage.setItem(STORAGE_KEYS.globeTheme, t);
      } catch (_) {}
    },
    [setTheme],
  );

  const [learnSubMode, setLearnSubMode] = useState("countries");
  const [showLearnPanel, setShowLearnPanel] = useState(false);
  const [learnSearchQuery, setLearnSearchQuery] = useState("");

  const onLearnSubModeChange = useCallback((subMode) => {
    if (!isValidLearnSubMode(subMode)) return;
    setLearnSubMode(subMode);
    setSelectedCountry(null);
    setLearnSearchQuery("");
  }, [setSelectedCountry]);

  const t = useTranslation(lang);
  const extInputRef = useRef(null);
  const globeFeedbackApplierRef = useRef(null);
  const prevScreenRef = useRef(currentScreen);

  useEffect(() => {
    const isGoingHome = currentScreen === "home" && prevScreenRef.current !== "home";
    prevScreenRef.current = currentScreen;

    if (isGoingHome) {
      return;
    }

    setIsScreenGlitching(true);
    const timer = setTimeout(() => setIsScreenGlitching(false), 220);
    return () => clearTimeout(timer);
  }, [currentScreen, showResultsTable]);

  useEffect(() => {
    if (isSupabaseConfigured && session === null) {
      const isGuest = localStorage.getItem("tvrs-guest-mode") === "true";
      if (!isGuest) {
        setShowAuthModal(true);
      }
    } else if (session) {
      setShowAuthModal(false);
    }
  }, [session]);

  const handleGuest = useCallback(() => {
    localStorage.setItem("tvrs-guest-mode", "true");
    setShowAuthModal(false);
  }, []);

  const { viewport, isKeyboardMode } = useViewport();
  const {
    countriesData,
    departmentsData,
    activeDataMap,
    allCountryKeys,
    totalPossible,
  } = useGeoData({ mode, learnSubMode });

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
  });

  const preserveInputFocus = useCallback(() => {
    const input = extInputRef.current;
    if (!input) return;
    if (document.activeElement !== input) {
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
    }
  }, []);

  const startGame = useCallback(
    (selectedMode) => {
      resetGame(selectedMode);
      setMode(selectedMode);
      setLearnSearchQuery("");
      setShowLearnPanel(false);
      setShowInfoModal(false);
      setShowResultsTable(false);
      setCurrentScreen("game");
    },
    [resetGame],
  );

  const goHome = useCallback(() => {
    resetGame(DEFAULT_MODE);
    setMode(DEFAULT_MODE);
    setShowLearnPanel(false);
    setLearnSearchQuery("");
    setShowInfoModal(false);
    setShowResultsTable(false);
    setCurrentScreen("home");
  }, [resetGame]);

  useEffect(() => {
    if (currentScreen === "home") {
      setSelectedCountry(null);
    }
  }, [currentScreen]);

  useEffect(() => {
    if (currentScreen !== "home" || !countryDataMap) {
      return;
    }

    const keys = Object.keys(countryDataMap).filter(
      (k) => countryDataMap[k]?.lat !== undefined,
    );
    if (keys.length === 0) return;

    let index = Math.floor(Math.random() * keys.length);
    setSelectedCountry(keys[index]);

    const interval = setInterval(() => {
      index = Math.floor(Math.random() * keys.length);
      setSelectedCountry(keys[index]);
    }, HOME_AUTOROTATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      setSelectedCountry(null);
    };
  }, [currentScreen]);

  const handleCustomConfirm = (msg, action) => {
    setConfirmState({
      message: msg,
      onConfirm: () => {
        action();
        setConfirmState(null);
      },
    });
  };

  const perfProfile = useMemo(() => {
    const isMobile = viewport.width < BREAKPOINTS.mobile;
    const isTablet =
      viewport.width >= BREAKPOINTS.mobile &&
      viewport.width < BREAKPOINTS.desktop;
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
      polygonCapCurvatureResolution:
        PERFORMANCE.polygonCapCurvatureResolution[tier],
    };
  }, [viewport.width]);

  const uiScale = (w = BREAKPOINTS.desktop) =>
    w >= 1800 ? 0.78 : w >= 1400 ? 0.84 : w >= 1100 ? 0.90 : w >= 900 ? 0.95 : w < 520 ? 0.88 : 1;
  const appStyle = useMemo(
    () => getThemeCssVariables(theme, globeTheme, { uiScale: uiScale(viewport?.width) }),
    [theme, globeTheme, viewport?.width],
  );

  const {
    isMobileViewport,
    isPanelOpen,
    panelDataMap,
    panelMode,
    closePanel,
    handlePanelSelect,
  } = useGameDataPanelState({
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
    if (
      mode === "learn" &&
      selectedCountry &&
      !activeDataMap[selectedCountry]
    ) {
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
  });

  return (
    <div
      className={`app-container ${theme} ${isScreenGlitching ? "glitch-active" : ""} ${isPanelOpen ? "data-panel-open" : ""}`}
      data-theme={theme}
      style={appStyle}
    >
      {isPlaying && !isGameOver && timeLeft > 0 && timeLeft <= 30 && (
        <div className="panic-vignette-overlay" />
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
          globeTheme={globeTheme}
          setGlobeTheme={setGlobeTheme}
          topExplorers={topExplorers}
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          localRecords={localRecords}
          session={session}
          onOpenAuth={() => setShowAuthModal(true)}
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
