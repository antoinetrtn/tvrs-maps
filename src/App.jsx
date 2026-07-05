import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import GlobeMap from "./GlobeMap.jsx";
import GameHUD from "./GameHUD.jsx";
import HomeScreen from "./HomeScreen.jsx";
import ResultsModal from "./ResultsModal.jsx";
import EndScreen from "./EndScreen.jsx";
import ConfirmationModal from "./ConfirmationModal.jsx";
import ProfileScreen from "./ProfileScreen.jsx";
import "./App.css";
import { countryDataMap } from "./gameData";
import { departmentsDataMap } from "./departmentsData";
import { riversMountainsDataMap } from "./riversMountainsData";
import { useTranslation } from "./i18n";
import { normalizeString } from "./utils";
import {
  isSupabaseConfigured,
  getProfile,
  upsertProfile,
  getUserRecords,
  upsertUserRecord,
  submitLeaderboardScore,
  getLeaderboard
} from "./supabaseClient.js";

import {
  getThemeCssVariables,
  GLOBE_THEME_IDS,
  DEFAULT_GLOBE_THEME,
} from "./designSystem";
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

  const [userProfile, setUserProfile] = useState(() => {
    try {
      const cached = localStorage.getItem("tvrs-user-profile");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_) {}
    const randomId = "u-" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    const randomNum = Math.floor(100 + Math.random() * 900);
    const newProfile = {
      id: randomId,
      username: `Explorer_${randomNum}`,
      avatarId: "invader_1",
      avatarColor: "cyan"
    };
    try {
      localStorage.setItem("tvrs-user-profile", JSON.stringify(newProfile));
    } catch (_) {}
    return newProfile;
  });

  const [localRecords, setLocalRecords] = useState(() => {
    const defaultRecords = {
      countries: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      capitals: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      departments: { maxScore: 0, bestTime: null, gamesPlayed: 0 },
      rivers_mountains: { maxScore: 0, bestTime: null, gamesPlayed: 0 }
    };
    try {
      const cached = localStorage.getItem("tvrs-local-records");
      if (cached) {
        return { ...defaultRecords, ...JSON.parse(cached) };
      }
    } catch (_) {}
    try {
      localStorage.setItem("tvrs-local-records", JSON.stringify(defaultRecords));
    } catch (_) {}
    return defaultRecords;
  });

  const [topExplorers, setTopExplorers] = useState([]);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [hudSide, setHudSide] = useState("right"); // 'left' or 'right'
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
    showCountryLabels: learnShowCountryLabels,
    showCapitals: learnShowCapitals,
    showRivers: learnShowRivers,
    showMountains: learnShowMountains,
  } = learnToggles;

  const fetchTopExplorers = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await getLeaderboard("countries", 3);
      if (!error && data) {
        setTopExplorers(data);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération du Top 3 :", err);
    }
  }, []);

  // Fetch top explorers on mount
  useEffect(() => {
    fetchTopExplorers();
  }, [fetchTopExplorers]);

  // Sync profile & records with Supabase on startup
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const syncProfileAndRecords = async () => {
      try {
        // 1. Sync Profile
        const { data: dbProfile, error: profileErr } = await getProfile(userProfile.id);
        if (profileErr || !dbProfile) {
          // If not found in DB, upload our local profile
          await upsertProfile(
            userProfile.id,
            userProfile.username,
            userProfile.avatarId,
            userProfile.avatarColor
          );
        } else {
          // If found in DB, sync local state
          const syncedProfile = {
            id: dbProfile.id,
            username: dbProfile.username,
            avatarId: dbProfile.avatar_id,
            avatarColor: dbProfile.avatar_color
          };
          setUserProfile(syncedProfile);
          localStorage.setItem("tvrs-user-profile", JSON.stringify(syncedProfile));
        }

        // 2. Sync Records
        const { data: dbRecords, error: recordsErr } = await getUserRecords(userProfile.id);
        if (!recordsErr && dbRecords && dbRecords.length > 0) {
          setLocalRecords((prev) => {
            const merged = { ...prev };
            dbRecords.forEach((rec) => {
              const modeKey = rec.game_mode;
              if (merged[modeKey]) {
                const localRec = merged[modeKey];
                const dbMaxScore = rec.max_score;
                const dbBestTime = rec.best_time_seconds;
                const dbGamesPlayed = rec.games_played || 0;

                let useDb = false;
                if (dbMaxScore > localRec.maxScore) {
                  useDb = true;
                } else if (dbMaxScore === localRec.maxScore) {
                  if (localRec.bestTime === null || (dbBestTime !== null && dbBestTime < localRec.bestTime)) {
                    useDb = true;
                  }
                }

                merged[modeKey] = {
                  maxScore: useDb ? dbMaxScore : localRec.maxScore,
                  bestTime: useDb ? dbBestTime : localRec.bestTime,
                  gamesPlayed: Math.max(localRec.gamesPlayed, dbGamesPlayed)
                };
              }
            });
            localStorage.setItem("tvrs-local-records", JSON.stringify(merged));
            return merged;
          });
        } else {
          // If online records are empty, upload all our local records
          for (const [modeKey, record] of Object.entries(localRecords)) {
            if (record.gamesPlayed > 0) {
              await upsertUserRecord(
                userProfile.id,
                modeKey,
                record.maxScore,
                record.bestTime,
                record.gamesPlayed
              );
            }
          }
        }
      } catch (err) {
        console.error("Erreur lors de la synchronisation Supabase :", err);
      }
    };

    syncProfileAndRecords();
  }, [userProfile.id]);

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
    (finalScore) => {
      if (mode === "learn") return;

      const timeSpent = gameDuration - timeLeft;

      setLocalRecords((prev) => {
        const currentRecord = prev[mode] || { maxScore: 0, bestTime: null, gamesPlayed: 0 };
        const nextGamesPlayed = currentRecord.gamesPlayed + 1;

        let nextMaxScore = currentRecord.maxScore;
        let nextBestTime = currentRecord.bestTime;

        if (finalScore > currentRecord.maxScore) {
          nextMaxScore = finalScore;
          nextBestTime = timeSpent;
        } else if (finalScore === currentRecord.maxScore) {
          if (currentRecord.bestTime === null || timeSpent < currentRecord.bestTime) {
            nextBestTime = timeSpent;
          }
        }

        const updatedRecord = {
          maxScore: nextMaxScore,
          bestTime: nextBestTime,
          gamesPlayed: nextGamesPlayed
        };

        const updatedRecords = {
          ...prev,
          [mode]: updatedRecord
        };

        localStorage.setItem("tvrs-local-records", JSON.stringify(updatedRecords));

        if (isSupabaseConfigured) {
          upsertUserRecord(
            userProfile.id,
            mode,
            nextMaxScore,
            nextBestTime,
            nextGamesPlayed
          ).catch((err) => console.error("Error syncing record:", err));

          if (finalScore > 0) {
            submitLeaderboardScore(userProfile.id, mode, finalScore, timeSpent)
              .then(() => {
                fetchTopExplorers();
              })
              .catch((err) => console.error("Error submitting score:", err));
          }
        }

        return updatedRecords;
      });
    },
    [mode, gameDuration, timeLeft, userProfile.id, fetchTopExplorers]
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
    [foundList, effectiveKeyboardMode, getClosestUnfound],
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
        return;
      }

      setSelectedCountry(c);
      resetNavigationTrail(c);
      setPopupError(false);
      // Assert focus when clicking a country on the globe.
      // If we're already focused (e.g. via preventDefault on pointerdown), skip the redundant call.
      if (
        c &&
        extInputRef.current &&
        document.activeElement !== extInputRef.current
      ) {
        setTimeout(() => {
          if (extInputRef.current) extInputRef.current.focus();
        }, FEEDBACK_TIMING.focusGlobeClickMs); // small delay for stability on globe clicks
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
    const pixelRatio = Math.min(devicePixelRatio, PERFORMANCE.maxPixelRatio);
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
          onOpenProfile={() => setCurrentScreen("profile")}
          topExplorers={topExplorers}
        />
      ) : currentScreen === "profile" ? (
        <ProfileScreen
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          localRecords={localRecords}
          onBack={() => setCurrentScreen("home")}
          lang={lang}
          theme={theme}
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
        isHomeScreen={currentScreen === "home" || currentScreen === "profile"}
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
          mode={mode}
          onRestart={goHome}
          onViewTable={() => {
            setShowEndScreen(false);
            setShowResultsTable(true);
          }}
          theme={theme}
          lang={lang}
          globeTheme={globeTheme}
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
    </div>
  );
}

export default App;
