import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import GlobeMap from "./GlobeMap.jsx";
import GameHUD from "./components/GameHUD.jsx";
import HomeScreen from "./components/HomeScreen.jsx";
import ResultsModal from "./components/ResultsModal.jsx";
import EndScreen from "./components/EndScreen.jsx";
import ConfirmationModal from "./components/ConfirmationModal.jsx";

import "./App.css";
import { countryDataMap } from "./data/gameData";
import { useTranslation } from "./config/i18n";
import { useUserProfile } from "./hooks/useUserProfile";
import {
  AVATAR_COLORS,
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
  FEEDBACK_TIMING,
  PERFORMANCE,
} from "./config/gameConstants";
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

  const [learnToggles, setLearnToggles] = useState({
    showCountryLabels: true,
    showCapitals: false,
    showRivers: false,
    showMountains: false,
  });

  const onToggleLearn = useCallback((key) => {
    setLearnToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const {
    showRivers: learnShowRivers,
    showMountains: learnShowMountains,
  } = learnToggles;

  const t = useTranslation(lang);
  const extInputRef = useRef(null);
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
  } = useGeoData({ mode });

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
      setCurrentScreen("game");
    },
    [resetGame],
  );

  const goHome = useCallback(() => {
    resetGame(DEFAULT_MODE);
    setMode(DEFAULT_MODE);
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
      antialias: true,
      enableAutoRotate: true,
      enablePointerInteraction: true,
      maxLabels: PERFORMANCE.maxLabels[tier],
      showAtmosphere: true,
      useImageTextures: false,
      cullOffscreenCountries: false,
      polygonCapCurvatureResolution:
        PERFORMANCE.polygonCapCurvatureResolution[tier],
    };
  }, [viewport.width]);

  const uiScale = (w = 1024) =>
    w >= 1800 ? 0.78 : w >= 1400 ? 0.84 : w >= 1100 ? 0.90 : w >= 900 ? 0.95 : w < 520 ? 0.88 : 1;
  const appStyle = useMemo(
    () => getThemeCssVariables(theme, globeTheme, { uiScale: uiScale(viewport?.width) }),
    [theme, globeTheme, viewport?.width],
  );

  return (
    <div
      className={`app-container ${theme} ${isScreenGlitching ? "glitch-active" : ""}`}
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
      ) : (
        !showEndScreen && (
          <GameHUD
            mode={mode}
            onGoHome={goHome}
            lang={lang}
            score={score}
            totalPossible={totalPossible}
            timeLeft={timeLeft}
            onEnter={(val) => {
              if (mode === "learn") {
                const res = handleSearch(val, learnShowRivers, learnShowMountains);
                if (!res) {
                  setPopupError(true);
                  setTimeout(() => setPopupError(false), FEEDBACK_TIMING.flashMs);
                }
                return res;
              }

              let res;
              if (selectedCountry) {
                res = specificCountryGuess(val);
              } else {
                res = handleInput(val);
                if (res === "ALREADY_FOUND") {
                  setPopupWarning(true);
                  setTimeout(() => setPopupWarning(false), FEEDBACK_TIMING.flashMs);
                } else if (res === "ERROR") {
                  setPopupError(true);
                  setTimeout(() => setPopupError(false), FEEDBACK_TIMING.flashMs);
                }
              }
              return (
                res === "SUCCESS" ||
                res === true ||
                res === "ERROR" ||
                res === "ALREADY_FOUND"
              );
            }}
            isPlaying={isPlaying}
            isGameOver={isGameOver}
            onStop={() => handleCustomConfirm(t("stop_game_confirm"), stopGame)}
            onInfo={() => setShowInfoModal(true)}
            isFocusedCountry={!!selectedCountry}
            onClearFocus={() => {
              setSelectedCountry(null);
              resetNavigationTrail(null);
            }}
            onNavigateFocus={navigateFocus}
            inputError={popupError}
            inputWarning={popupWarning}
            inputSuccess={popupSuccess}
            extInputRef={extInputRef}
            foundList={foundList}
            countryDataMap={activeDataMap}
            theme={theme}
            viewport={viewport}
            isKeyboardMode={isKeyboardMode}
            selectedCountry={selectedCountry}
            globeTheme={globeTheme}
            learnToggles={learnToggles}
            onToggleLearn={onToggleLearn}
          />
        )
      )}
      <GlobeMap
        mode={mode}
        lang={lang}
        countriesData={countriesData}
        departmentsData={departmentsData}
        foundList={foundList}
        selectedCountry={selectedCountry}
        shouldAutoRotate={false}
        onCountrySelect={(c) => {
          if (c === selectedCountry && c !== null) {
            setPopupError(false);
            if (extInputRef.current) {
              extInputRef.current.focus();
              setTimeout(() => {
                if (extInputRef.current) extInputRef.current.focus();
              }, 50);
              setTimeout(() => {
                if (extInputRef.current) extInputRef.current.focus();
              }, 150);
            }
            return;
          }
          setSelectedCountry(c);
          resetNavigationTrail(c);
          setPopupError(false);
          if (c && extInputRef.current) {
            extInputRef.current.focus();
            setTimeout(() => {
              if (extInputRef.current) extInputRef.current.focus();
            }, 50);
            setTimeout(() => {
              if (extInputRef.current) extInputRef.current.focus();
            }, 150);
          }
        }}
        theme={theme}
        viewport={viewport}
        isError={popupError}
        isSuccess={popupSuccess}
        hasActiveFeedback={popupError || popupSuccess}
        perfProfile={perfProfile}
        isHomeScreen={currentScreen === "home"}
        isKeyboardMode={isKeyboardMode}
        isEndScreen={showEndScreen}
        isPerfectScore={foundList.length === totalPossible}
        onPreserveInputFocus={preserveInputFocus}
        globeLightingEnabled={true}
        activeDataMap={activeDataMap}
        globeTheme={globeTheme}
        learnToggles={learnToggles}
      />
      {showEndScreen && (
        <EndScreen
          foundList={foundList}
          totalCountries={totalPossible}
          countryDataMap={countryDataMap}
          activeDataMap={activeDataMap}
          onRestart={goHome}
          onViewTable={() => {
            setShowEndScreen(false);
            setShowResultsTable(true);
          }}
          theme={theme}
          lang={lang}
          globeTheme={globeTheme}
          lastScores={lastScores[mode] || []}
          maxScore={localRecords[mode]?.maxScore || 0}
          isNewPB={isNewPB}
          xpResult={xpResult}
        />
      )}
      {(showResultsTable || showInfoModal) && (
        <ResultsModal
          foundList={foundList}
          totalCountries={totalPossible}
          countryDataMap={countryDataMap}
          activeDataMap={activeDataMap}
          onRestart={
            isGameOver
              ? goHome
              : () =>
                  handleCustomConfirm(t("restart_game_confirm"), () => {
                    resetGame(mode);
                    setShowInfoModal(false);
                  })
          }
          onClose={() => {
            setShowResultsTable(false);
            setShowInfoModal(false);
            if (isGameOver) setShowEndScreen(true);
          }}
          isGameOver={isGameOver}
          onStop={stopGame}
          isPlaying={isPlaying}
          mode={mode}
          theme={theme}
          lang={lang}
          globeTheme={globeTheme}
        />
      )}
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
