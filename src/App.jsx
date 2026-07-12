import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import GlobeMap from "./GlobeMap.jsx";
import GameHUD from "./GameHUD.jsx";
import HomeScreen from "./HomeScreen.jsx";
import ResultsModal from "./ResultsModal.jsx";
import EndScreen from "./EndScreen.jsx";
import ConfirmationModal from "./ConfirmationModal.jsx";

import "./App.css";
import { countryDataMap } from "./gameData";
import { departmentsDataMap } from "./departmentsData";
import { riversMountainsDataMap } from "./riversMountainsData";
import { useTranslation } from "./i18n";
import { normalizeString } from "./utils";
import { useUserProfile, checkChallengesRealTime } from "./useUserProfile";
import { CHALLENGES } from "./challenges";
import { isSupabaseConfigured, upsertProfile } from "./supabaseClient";
import {
  AVATAR_COLORS,
  getThemeCssVariables,
  GLOBE_THEME_IDS,
  DEFAULT_GLOBE_THEME,
  getThemeRegionColorLabel,
} from "./designSystem";
import AchievementToast from "./AchievementToast.jsx";
import AuthModal from "./AuthModal.jsx";
import {
  DEFAULT_MODE,
  DEFAULT_GAME_DURATION_SEC,
  HOME_AUTOROTATE_INTERVAL_MS,
  KEYBOARD_CLOSE_DELAY_MS,
  FEEDBACK_TIMING,
  BREAKPOINTS,
  STORAGE_KEYS,
  DATA_URLS,
  PERFORMANCE,
} from "./gameConstants";

function App() {
  const [currentScreen, setCurrentScreen] = useState("home"); // 'home' or 'game' or 'profile'

  const {
    session,
    userProfile,
    setUserProfile,
    localRecords,
    topExplorers,
    updateGameRecord,
    lastScores
  } = useUserProfile();
  useState("records");
  const [mode, setMode] = useState(DEFAULT_MODE); // 'countries', 'capitals', 'learn', 'departments'
  const [foundList, setFoundList] = useState([]);
  const score = foundList.length;
  const [gameDuration, setGameDuration] = useState(DEFAULT_GAME_DURATION_SEC);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_GAME_DURATION_SEC);
  const [lang, setLang] = useState("fr"); // 'fr' or 'en'
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [showResultsTable, setShowResultsTable] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'success' | 'warning' | 'error' | null
  const popupSuccess = feedback === "success";
  const popupError = feedback === "error";
  const popupWarning = feedback === "warning";

  const setPopupSuccess = useCallback((val) => setFeedback(val ? "success" : null), []);
  const setPopupError = useCallback((val) => setFeedback(val ? "error" : null), []);
  const setPopupWarning = useCallback((val) => setFeedback(val ? "warning" : null), []);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isNewPB, setIsNewPB] = useState(false);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const activeAchievement = achievementQueue[0] || null;
  const addAchievementToQueue = useCallback((achievement) => {
    setAchievementQueue((prev) => [...prev, achievement]);
  }, []);
  const handleCloseAchievement = useCallback(() => {
    setAchievementQueue((prev) => prev.slice(1));
  }, []);



  const [xpResult, setXpResult] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const conqueredRegionsThisGameRef = useRef([]);
  const speedGuessCount3sRef = useRef(0);
  const speedGuessCount1sRef = useRef(0);
  const guessTimestampsRef = useRef([]);
  const guessesThisGameRef = useRef([]);
  const lastGuessTimeRef = useRef(0);
  const lightningCountRef = useRef(0);
  const globeLightingEnabled = true;
  const [theme, setTheme] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.globeTheme);
      // Blackout (or no preference yet) implies the dark UI theme.
      if (!cached || cached === "blackout") return "dark";
    } catch (_) {}
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "dark";
  }); // System default theme
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

  // New States for Advanced UX
  const [isScreenGlitching, setIsScreenGlitching] = useState(false);
  const [, setMenuOpen] = useState(false);
  const [confirmState, setConfirmState] = useState(null); // { message, onConfirm }
  const t = useTranslation(lang);

  // Learn Mode Toggles
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

  // Profile, records and top explorers states are synced automatically in the useUserProfile hook.
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

  const extInputRef = useRef(null);
  const initialWidth = useRef(window.innerWidth);
  const initialHeight = useRef(window.innerHeight);
  const viewportFrameRef = useRef(null);
  const navigationTrailRef = useRef([]);
  const navigationTrailIndexRef = useRef(-1);

  const prevScreenRef = useRef(currentScreen);

  // Trigger screen transition glitch effect when screens/modals toggle
  useEffect(() => {
    const isGoingHome = currentScreen === "home" && prevScreenRef.current !== "home";
    prevScreenRef.current = currentScreen;

    if (isGoingHome) {
      return;
    }

    setIsScreenGlitching(true);
    const timer = setTimeout(() => setIsScreenGlitching(false), 220);
    return () => clearTimeout(timer);
  }, [currentScreen, showEndScreen, showResultsTable]);

  // --- MOBILE KEYBOARD / VIEWPORT LOGIC ---
  const getViewport = useCallback(() => {
    const vv = window.visualViewport;
    return {
      width: vv ? vv.width : window.innerWidth,
      height: vv ? vv.height : window.innerHeight,
      top: vv ? vv.offsetTop : 0,
      left: vv ? vv.offsetLeft : 0,
    };
  }, []);

  const [viewport, setViewport] = useState(getViewport);

  useEffect(() => {
    const handleResize = () => {
      if (viewportFrameRef.current)
        cancelAnimationFrame(viewportFrameRef.current);
      viewportFrameRef.current = requestAnimationFrame(() => {
        const nextViewport = getViewport();
        setViewport((prev) => {
          const changed =
            Math.abs(prev.width - nextViewport.width) > 1 ||
            Math.abs(prev.height - nextViewport.height) > 1 ||
            Math.abs(prev.top - nextViewport.top) > 1 ||
            Math.abs(prev.left - nextViewport.left) > 1;
          return changed ? nextViewport : prev;
        });
      });
    };
    window.addEventListener("resize", handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);
    }
    return () => {
      if (viewportFrameRef.current)
        cancelAnimationFrame(viewportFrameRef.current);
      window.removeEventListener("resize", handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      }
    };
  }, [getViewport]);

  const isDepartmentsMode = mode === "departments";
  const isRiversMountainsMode = mode === "rivers_mountains";
  const activeDataMap = useMemo(() => {
    if (isRiversMountainsMode) return riversMountainsDataMap;
    return isDepartmentsMode ? departmentsDataMap : countryDataMap;
  }, [isDepartmentsMode, isRiversMountainsMode]);

  // Build a sorted list of all unfound keys for prev/next navigation
  const allCountryKeys = useMemo(
    () => Object.keys(activeDataMap),
    [activeDataMap],
  );
  const totalPossible = allCountryKeys.length;

  const getClosestUnfound = useCallback(
    (fromAdmin, currentFound) => {
      const c1 = activeDataMap[fromAdmin];
      if (!c1 || c1.lat === undefined) return null;

      let sameRegionList = [];
      let otherRegionList = [];

      Object.keys(activeDataMap).forEach((key) => {
        if (
          !currentFound.includes(key) &&
          activeDataMap[key].lat !== undefined
        ) {
          let dLng = Math.abs(c1.lng - activeDataMap[key].lng);
          if (dLng > 180) dLng = 360 - dLng;
          const dist = Math.hypot(c1.lat - activeDataMap[key].lat, dLng);

          if (c1.region && activeDataMap[key].region === c1.region) {
            sameRegionList.push({ key, dist });
          } else {
            otherRegionList.push({ key, dist });
          }
        }
      });

      if (sameRegionList.length > 0) {
        sameRegionList.sort((a, b) => a.dist - b.dist);
        return sameRegionList[0].key;
      } else if (otherRegionList.length > 0) {
        otherRegionList.sort((a, b) => a.dist - b.dist);
        return otherRegionList[0].key;
      }
      return null;
    },
    [activeDataMap],
  );

  const resetNavigationTrail = useCallback((country) => {
    navigationTrailRef.current = country ? [country] : [];
    navigationTrailIndexRef.current = country ? 0 : -1;
  }, []);

  // Navigate to next/previous unfound country in focus mode
  const navigateFocus = useCallback(
    (direction) => {
      const unfoundKeys = allCountryKeys.filter(
        (k) => !foundList.includes(k) && activeDataMap[k]?.lat !== undefined,
      );
      if (unfoundKeys.length === 0) return;

      if (!isPlaying && mode !== "learn") setIsPlaying(true);

      let nextCountry;
      if (!selectedCountry) {
        nextCountry =
          direction === "prev"
            ? unfoundKeys[unfoundKeys.length - 1]
            : unfoundKeys[0];
        resetNavigationTrail(nextCountry);
      } else {
        let trail = navigationTrailRef.current;
        let trailIndex = navigationTrailIndexRef.current;

        if (trail[trailIndex] !== selectedCountry) {
          trail = [selectedCountry];
          trailIndex = 0;
          navigationTrailRef.current = trail;
          navigationTrailIndexRef.current = trailIndex;
        }

        if (direction === "prev" && trailIndex > 0) {
          nextCountry = trail[trailIndex - 1];
          navigationTrailIndexRef.current = trailIndex - 1;
        } else if (direction === "next" && trailIndex < trail.length - 1) {
          nextCountry = trail[trailIndex + 1];
          navigationTrailIndexRef.current = trailIndex + 1;
        } else {
          const excludedForNavigation = Array.from(
            new Set([...foundList, ...trail, selectedCountry]),
          );
          nextCountry = getClosestUnfound(
            selectedCountry,
            excludedForNavigation,
          );

          if (nextCountry) {
            if (direction === "prev") {
              navigationTrailRef.current = [nextCountry, ...trail];
              navigationTrailIndexRef.current = 0;
            } else {
              navigationTrailRef.current = [
                ...trail.slice(0, trailIndex + 1),
                nextCountry,
              ];
              navigationTrailIndexRef.current = trailIndex + 1;
            }
          }
        }
      }

      if (!nextCountry) return;

      setSelectedCountry(nextCountry);
      setPopupError(false);
      setPopupWarning(false);

      // Maintain focus for a seamless experience. If already focused, don't re-assert.
      if (
        extInputRef.current &&
        document.activeElement !== extInputRef.current
      ) {
        setTimeout(() => {
          if (extInputRef.current) extInputRef.current.focus();
        }, FEEDBACK_TIMING.focusKeyboardMs);
      }
    },
    [
      selectedCountry,
      foundList,
      allCountryKeys,
      activeDataMap,
      isPlaying,
      mode,
      getClosestUnfound,
      resetNavigationTrail,
    ],
  );

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }
      if (selectedCountry) {
        if (e.key === "ArrowRight") navigateFocus("next");
        if (e.key === "ArrowLeft") navigateFocus("prev");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCountry, navigateFocus]);

  // Game countries loaded from GeoJSON
  const [countriesData, setCountriesData] = useState([]);
  const [departmentsGeoData, setDepartmentsGeoData] = useState([]);
  // Only treat a height shrink as a keyboard when the width is unchanged — an
  // orientation change alters both dimensions and must NOT trigger keyboard mode.
  const keyboardModeCandidate =
    window.innerWidth < BREAKPOINTS.desktop &&
    ((Math.abs(viewport.width - initialWidth.current) <= 2 &&
      viewport.height < initialHeight.current * 0.85) ||
      viewport.top > 20);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const effectiveKeyboardMode = keyboardModeCandidate || isKeyboardMode;

  // Re-baseline the no-keyboard viewport whenever it changes for a non-keyboard
  // reason (e.g. orientation change), mirroring GlobeMap's logic.
  useEffect(() => {
    const keyboardLike =
      viewport.top > 20 ||
      (Math.abs(viewport.width - initialWidth.current) <= 2 &&
        viewport.height < initialHeight.current * 0.85);
    if (!keyboardLike) {
      initialWidth.current = viewport.width;
      initialHeight.current = viewport.height;
    }
  }, [viewport.width, viewport.height, viewport.top]);

  useEffect(() => {
    if (window.innerWidth >= BREAKPOINTS.desktop) {
      setIsKeyboardMode(false);
      return undefined;
    }

    if (keyboardModeCandidate) {
      setIsKeyboardMode(true);
      return undefined;
    }

    const closeTimer = setTimeout(
      () => setIsKeyboardMode(false),
      KEYBOARD_CLOSE_DELAY_MS,
    );
    return () => clearTimeout(closeTimer);
  }, [keyboardModeCandidate]);

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

  const resetGame = useCallback(
    (newMode) => {
      setMode(newMode);
      setFoundList([]);
      setTimeLeft(gameDuration);
      setIsPlaying(false);
      setIsGameOver(false);
      setShowEndScreen(false);
      setShowResultsTable(false);
      setSelectedCountry(null);
      resetNavigationTrail(null);
      setMenuOpen(false);
      setIsNewPB(false);
      setXpResult(null);
      conqueredRegionsThisGameRef.current = [];
      speedGuessCount3sRef.current = 0;
      speedGuessCount1sRef.current = 0;
      guessTimestampsRef.current = [];
      guessesThisGameRef.current = [];
      lastGuessTimeRef.current = Date.now();
      lightningCountRef.current = 0;
    },
    [resetNavigationTrail, gameDuration],
  );

  const startGame = useCallback(
    (selectedMode) => {
      resetGame(selectedMode);
      setCurrentScreen("game");
    },
    [resetGame],
  );

  const goHome = useCallback(() => {
    resetGame(DEFAULT_MODE);
    setCurrentScreen("home");
  }, [resetGame]);

  useEffect(() => {
    if (currentScreen === "home") {
      setTimeLeft(gameDuration);
    }
  }, [gameDuration, currentScreen]);

  // Home Screen automatic country targeting simulation loop
  useEffect(() => {
    if (currentScreen !== "home" || !countryDataMap) {
      if (currentScreen === "home") {
        setSelectedCountry(null);
      }
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
  }, [currentScreen, countryDataMap]);

  const handleGameFinished = useCallback(
    async (finalScore) => {
      if (mode === "learn") return;
      const timeSpent = gameDuration - timeLeft;

      const prevRecord = localRecords[mode] || { maxScore: 0, bestTime: null, gamesPlayed: 0 };
      const isPB = finalScore > prevRecord.maxScore || (prevRecord.maxScore === 0 && finalScore > 0);

      if (isPB) {
        setIsNewPB(true);
      }

      const res = await updateGameRecord(
        mode,
        finalScore,
        timeSpent,
        totalPossible,
        gameDuration,
        conqueredRegionsThisGameRef.current
      );
      setXpResult(res);

      if (res && res.newlyUnlockedBadges && res.newlyUnlockedBadges.length > 0) {
        res.newlyUnlockedBadges.forEach((chId) => {
          const chObj = CHALLENGES.find((c) => c.id === chId);
          if (chObj) {
            addAchievementToQueue({
              title: lang === "fr" ? chObj.titleFr : chObj.titleEn,
              message: `${lang === "fr" ? chObj.descFr : chObj.descEn} (Emote débloquée !)`,
              color: AVATAR_COLORS[chObj.color] || chObj.color,
              invaderId: chObj.id
            });
          }
        });
      }
    },
    [mode, gameDuration, timeLeft, updateGameRecord, localRecords, totalPossible, lang, addAchievementToQueue]
  );

  useEffect(() => {
    if (
      isPlaying &&
      !isGameOver &&
      foundList.length > 0 &&
      foundList.length >= totalPossible
    ) {
      setIsGameOver(true);
      setIsPlaying(false);
      setShowEndScreen(true);
      handleGameFinished(foundList.length);
    }
  }, [foundList.length, isPlaying, isGameOver, totalPossible, handleGameFinished]);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URLS.countriesGeoJson)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.features) {
          setCountriesData(data.features);
        }
      })
      .catch((err) => console.error("Failed to load map data", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URLS.departmentsGeoJson)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && data.features) {
          setDepartmentsGeoData(data.features);
        }
      })
      .catch((err) =>
        console.error("Failed to load departments map data", err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let timer = null;
    if (isPlaying && !isGameOver && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft <= 0 && isPlaying && !isGameOver) {
      setIsGameOver(true);
      setIsPlaying(false);
      setShowEndScreen(true);
      handleGameFinished(foundList.length);
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isGameOver, timeLeft, foundList.length, handleGameFinished]);

  const stopGame = useCallback(() => {
    setIsGameOver(true);
    setIsPlaying(false);
    setShowEndScreen(true);
    handleGameFinished(foundList.length);
  }, [foundList.length, handleGameFinished]);

  const handleSuccessfulGuess = useCallback(
    (guessedKey, timing) => {
      const newFound = [...foundList, guessedKey];
      setFoundList(newFound);
      setPopupError(false);
      setPopupWarning(false);
      setPopupSuccess(true);
      setSelectedCountry(guessedKey);

      // Track timings & stats for achievements
      const now = Date.now();
      const lastGuessDuration = (now - lastGuessTimeRef.current) / 1000;
      lastGuessTimeRef.current = now;
      
      guessesThisGameRef.current.push(guessedKey);
      
      if (lastGuessDuration <= 3) {
        speedGuessCount3sRef.current += 1;
      }
      if (lastGuessDuration <= 1) {
        speedGuessCount1sRef.current += 1;
      }
      
      guessTimestampsRef.current.push(now);
      if (guessTimestampsRef.current.length >= 3) {
        const thirdLast = guessTimestampsRef.current[guessTimestampsRef.current.length - 3];
        if (now - thirdLast <= 5000) {
          lightningCountRef.current += 1;
        }
      }

      // Check for region conquest achievement
      const guessItem = activeDataMap[guessedKey];
      const region = guessItem?.region;
      const newlyConqueredRegions = [];
      if (region && region !== "Unknown") {
        const allInRegion = Object.keys(activeDataMap).filter(
          (k) => activeDataMap[k]?.region === region
        );
        if (allInRegion.length > 0) {
          const wasCompletedBefore = foundList.filter(
            (k) => activeDataMap[k]?.region === region
          ).length === allInRegion.length;
          const isCompletedNow = newFound.filter(
            (k) => activeDataMap[k]?.region === region
          ).length === allInRegion.length;

          if (!wasCompletedBefore && isCompletedNow) {
            conqueredRegionsThisGameRef.current.push(region);
            newlyConqueredRegions.push(region);
            
            // Standard notification for region conquest
            const labelColor = getThemeRegionColorLabel(globeTheme, theme, region);
            const invaders = ["invader_1", "invader_2", "invader_3", "invader_4", "invader_5", "invader_6", "invader_7", "invader_8"];
            const regionHash = region.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const invaderId = invaders[regionHash % invaders.length];

            addAchievementToQueue({
              title: t("achievement_continent_conquered"),
              message: t("achievement_continent_desc", { region: t(`region_${region}`) || region }),
              color: labelColor,
              invaderId: invaderId
            });
          }
        }
      }

      // Call Real-time Challenge verification
      const hour = new Date().getHours();
      const currentBadges = userProfile.unlockedBadges || [];
      const sessionData = {
        mode,
        score: newFound.length,
        timeSpent: gameDuration - timeLeft,
        timeLeft,
        accuracy: 1, // mid-game assumes 100% since we only call on successful guesses
        isGameOver: false,
        perfect: false,
        continentsConquered: newlyConqueredRegions,
        consecutiveCorrect: newFound.length,
        lastGuessDuration,
        guessesThisGame: guessesThisGameRef.current,
        speedGuessCount3s: speedGuessCount3sRef.current,
        speedGuessCount1s: speedGuessCount1sRef.current,
        lightningCount: lightningCountRef.current,
        gameDuration,
        isNight: hour >= 22 || hour < 4,
        isLunch: hour >= 12 && hour < 14
      };

      const unlocked = checkChallengesRealTime(currentBadges, localRecords, sessionData);
      if (unlocked.length > 0) {
        const gainedAchievementXp = unlocked.length * 100;
        const newXp = (userProfile.xp || 0) + gainedAchievementXp;
        const { level: newLevel } = getLevelAndProgress(newXp);

        // Also check if this new level unlocks level achievements!
        const levelBadges = [];
        for (let lvl = 2; lvl <= newLevel; lvl++) {
          if ([2, 5, 10, 15, 20].includes(lvl)) {
            const chId = `ch_gen_lvl_${lvl}`;
            if (!currentBadges.includes(chId) && !unlocked.includes(chId)) {
              levelBadges.push(chId);
            }
          }
        }

        const updatedBadges = [...currentBadges, ...unlocked, ...levelBadges];
        const finalXp = newXp + levelBadges.length * 100;
        const { level: finalLevel } = getLevelAndProgress(finalXp);

        const updatedProfile = {
          ...userProfile,
          xp: finalXp,
          level: finalLevel,
          unlockedBadges: updatedBadges
        };
        setUserProfile(updatedProfile);
        localStorage.setItem("tvrs-user-profile", JSON.stringify(updatedProfile));

        const allUnlocked = [...unlocked, ...levelBadges];
        allUnlocked.forEach((chId) => {
          const chObj = CHALLENGES.find((c) => c.id === chId);
          if (chObj) {
            addAchievementToQueue({
              title: lang === "fr" ? chObj.titleFr : chObj.titleEn,
              message: `${lang === "fr" ? chObj.descFr : chObj.descEn} (Emote débloquée !)`,
              color: AVATAR_COLORS[chObj.color] || chObj.color,
              invaderId: chObj.id
            });
          }
        });

        if (isSupabaseConfigured) {
          const activeUserId = session?.user?.id || userProfile.id;
          upsertProfile(
            activeUserId,
            updatedProfile.username,
            updatedProfile.avatarId,
            updatedProfile.avatarColor,
            updatedProfile.xp,
            updatedProfile.level,
            updatedProfile.unlockedBadges
          ).catch((err) => console.error("Error syncing real-time challenge:", err));
        }
      }

      setTimeout(() => {
        setPopupSuccess(false);
        setSelectedCountry((prev) => {
          if (prev === guessedKey) {
            const nextCountry = getClosestUnfound(guessedKey, newFound);
            navigationTrailRef.current = nextCountry
              ? [guessedKey, nextCountry]
              : [guessedKey];
            navigationTrailIndexRef.current = nextCountry ? 1 : 0;
            // Strong focus re-assertion ONLY if in keyboard mode and focus was actually lost
            if (
              extInputRef.current &&
              effectiveKeyboardMode &&
              document.activeElement !== extInputRef.current
            ) {
              extInputRef.current.focus();
            }
            return nextCountry || null;
          }
          return prev;
        });
      }, timing);
    },
    [
      foundList,
      effectiveKeyboardMode,
      getClosestUnfound,
      activeDataMap,
      globeTheme,
      theme,
      t,
      userProfile,
      setUserProfile,
      localRecords,
      mode,
      gameDuration,
      timeLeft,
      session,
      lang
    ]
  );

  const handleInput = useCallback(
    (inputVal) => {
      const isDebug = import.meta.env.DEV;
      if (isDebug) {
        if (inputVal === "WIN100") {
          setFoundList(Object.keys(activeDataMap));
          return true;
        }
        if (inputVal === "LOSE100") {
          setIsGameOver(true);
          return true;
        }
      }

      if (!isPlaying && mode !== "learn") setIsPlaying(true);
      if (selectedCountry) return false;

      const normalizedInput = normalizeString(inputVal);
      if (!normalizedInput) return false;
      let matchFound = null;

      for (let adminKey of Object.keys(activeDataMap)) {
        const mapped = activeDataMap[adminKey];
        let matchName = null;
        let matchCapital = null;
        const aliases = mapped?.aliases || [];

        if (mapped) {
          matchName =
            lang === "fr"
              ? normalizeString(mapped.name_fr || mapped.name_en || adminKey)
              : normalizeString(mapped.name_en || adminKey);
          matchCapital =
            lang === "fr" && mapped.capital_fr
              ? normalizeString(mapped.capital_fr)
              : mapped.capital
                ? normalizeString(mapped.capital)
                : null;
        } else {
          matchName = normalizeString(adminKey);
        }

        if (
          mode === "countries" ||
          mode === "departments" ||
          mode === "rivers_mountains"
        ) {
          if (
            matchName === normalizedInput ||
            aliases.some((alias) => normalizeString(alias) === normalizedInput)
          ) {
            matchFound = adminKey;
            break;
          }
        } else if (mode === "capitals" && matchCapital) {
          if (matchCapital === normalizedInput) {
            matchFound = adminKey;
            break;
          }
        }
      }

      if (matchFound) {
        if (foundList.includes(matchFound)) {
          return "ALREADY_FOUND";
        }
        handleSuccessfulGuess(matchFound, FEEDBACK_TIMING.successHoldMs);
        return "SUCCESS";
      }
      return "ERROR";
    },
    [
      activeDataMap,
      foundList,
      isPlaying,
      lang,
      mode,
      selectedCountry,
      handleSuccessfulGuess,
    ],
  );

  const specificCountryGuess = useCallback(
    (inputVal) => {
      if (!selectedCountry) return false;
      const mapped = activeDataMap[selectedCountry];
      if (!mapped) return false;

      if (!isPlaying && mode !== "learn") setIsPlaying(true);

      const normalizedInput = normalizeString(inputVal);
      let matchName =
        lang === "fr"
          ? normalizeString(mapped.name_fr)
          : normalizeString(mapped.name_en);
      let matchCapital =
        lang === "fr" && mapped.capital_fr
          ? normalizeString(mapped.capital_fr)
          : mapped.capital
            ? normalizeString(mapped.capital)
            : null;
      const aliases = mapped.aliases || [];

      let isSuccess = false;
      if (
        (mode === "countries" ||
          mode === "departments" ||
          mode === "rivers_mountains") &&
        (matchName === normalizedInput ||
          aliases.some((alias) => normalizeString(alias) === normalizedInput))
      ) {
        isSuccess = true;
      } else if (mode === "capitals" && matchCapital === normalizedInput) {
        isSuccess = true;
      }

      if (isSuccess) {
        if (foundList.includes(selectedCountry)) {
          setPopupWarning(true);
          setTimeout(() => setPopupWarning(false), FEEDBACK_TIMING.flashMs);
          return "ALREADY_FOUND";
        }

        handleSuccessfulGuess(selectedCountry, FEEDBACK_TIMING.successHoldFocusedMs);
        setPopupError(false);
        setPopupWarning(false);
        return "SUCCESS";
      } else {
        setPopupError(true);
        setTimeout(() => setPopupError(false), FEEDBACK_TIMING.flashMs);
        return "ERROR";
      }
    },
    [
      activeDataMap,
      foundList,
      isPlaying,
      lang,
      mode,
      selectedCountry,
      handleSuccessfulGuess,
    ],
  );

  const handleCountrySelect = useCallback(
    (c) => {
      if (c === selectedCountry && c !== null) {
        setPopupError(false);
        // Force focus even if it's the same country
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
    },
    [selectedCountry, resetNavigationTrail],
  );

  const handleSearch = useCallback(
    (inputVal) => {
      const normalizedInput = normalizeString(inputVal);
      if (!normalizedInput) return false;

      for (let adminKey of Object.keys(activeDataMap)) {
        const mapped = activeDataMap[adminKey];
        if (!mapped) continue;

        const matchName =
          lang === "fr"
            ? normalizeString(mapped.name_fr || mapped.name_en || adminKey)
            : normalizeString(mapped.name_en || adminKey);
        const matchCapital =
          lang === "fr" && mapped.capital_fr
            ? normalizeString(mapped.capital_fr)
            : mapped.capital
              ? normalizeString(mapped.capital)
              : null;
        const aliases = mapped.aliases || [];

        if (
          matchName === normalizedInput ||
          matchCapital === normalizedInput ||
          aliases.some((alias) => normalizeString(alias) === normalizedInput)
        ) {
          handleCountrySelect(adminKey);
          return true;
        }
      }

      if (mode === "learn") {
        for (let adminKey of Object.keys(riversMountainsDataMap)) {
          const mapped = riversMountainsDataMap[adminKey];
          if (!mapped) continue;
          if (mapped.type === "river" && !learnShowRivers) continue;
          if (
            (mapped.type === "mountain" || mapped.type === "mountain_range") &&
            !learnShowMountains
          )
            continue;

          const matchName =
            lang === "fr"
              ? normalizeString(mapped.name_fr || mapped.name_en || adminKey)
              : normalizeString(mapped.name_en || adminKey);
          const aliases = mapped.aliases || [];

          if (
            matchName === normalizedInput ||
            aliases.some((alias) => normalizeString(alias) === normalizedInput)
          ) {
            handleCountrySelect(adminKey);
            return true;
          }
        }
      }

      return false;
    },
    [
      activeDataMap,
      lang,
      handleCountrySelect,
      mode,
      learnShowRivers,
      learnShowMountains,
    ],
  );

  const shouldAutoRotate = false;

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
      // Higher curvature resolution = smoother polygon caps (mobile gets the most
      // since its globe is smaller on screen); see PERFORMANCE in gameConstants.
      polygonCapCurvatureResolution:
        PERFORMANCE.polygonCapCurvatureResolution[tier],
    };
  }, [viewport.width]);

  const appStyle = useMemo(
    () => getThemeCssVariables(theme, globeTheme),
    [theme, globeTheme],
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
                const res = handleSearch(val);
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
              // Return true to clear the input field in GameHUD for any terminal result
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
            isKeyboardMode={effectiveKeyboardMode}
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
        departmentsData={departmentsGeoData}
        foundList={foundList}
        selectedCountry={selectedCountry}
        shouldAutoRotate={shouldAutoRotate && perfProfile.enableAutoRotate}
        onCountrySelect={handleCountrySelect}
        theme={theme}
        viewport={viewport}
        isError={popupError}
        isSuccess={popupSuccess}
        hasActiveFeedback={popupError || popupSuccess}
        perfProfile={perfProfile}
        isHomeScreen={currentScreen === "home"}
        isKeyboardMode={effectiveKeyboardMode}
        isEndScreen={showEndScreen}
        isPerfectScore={foundList.length === totalPossible}
        onPreserveInputFocus={preserveInputFocus}
        globeLightingEnabled={globeLightingEnabled}
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
