import { useCallback, useEffect, useRef, useState } from "react";

import { AVATAR_COLORS } from "../config/designSystem";
import { getActiveModeConfig } from "../config/gameConfig";
import { AUTO_NAVIGATION, FEEDBACK_TIMING, HARDCORE_LIVES } from "../config/gameConstants";
import { CHALLENGES } from "../data/challenges";
import { recordSuccessfulGuessSideEffects } from "../utils/recordSuccessfulGuessSideEffects";
import { normalizeString } from "../utils/utils";

export function useGameSession({
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
  effectiveKeyboardMode,
  globeFeedbackApplierRef,
  hardcoreMode = false,
}) {
  const [foundList, setFoundList] = useState([]);
  const score = foundList.length;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(gameDuration);

  // Hardcore: the run ends after HARDCORE_LIVES wrong answers.
  const [mistakes, setMistakes] = useState(0);
  const isHardcoreRun = hardcoreMode && mode !== "learn";
  const livesLeft = isHardcoreRun ? Math.max(0, HARDCORE_LIVES - mistakes) : null;
  const registerMistake = useCallback(() => {
    setMistakes((prev) => prev + 1);
  }, []);

  const [feedback, setFeedback] = useState(null);
  const popupSuccess = feedback === "success";
  const popupError = feedback === "error";
  const popupWarning = feedback === "warning";

  const globeFeedbackRef = useRef({ isError: false, isSuccess: false });

  const triggerGlobeFeedback = useCallback(
    (admin, { isError = false, isSuccess = false } = {}) => {
      globeFeedbackRef.current = { isError, isSuccess };
      globeFeedbackApplierRef?.current?.(admin, { isError, isSuccess });
    },
    [globeFeedbackApplierRef]
  );

  const setPopupSuccess = useCallback((val) => {
    if (!val) globeFeedbackRef.current.isSuccess = false;
    setFeedback(val ? "success" : null);
  }, []);
  const setPopupError = useCallback((val) => {
    if (!val) globeFeedbackRef.current.isError = false;
    setFeedback(val ? "error" : null);
  }, []);
  const setPopupWarning = useCallback((val) => setFeedback(val ? "warning" : null), []);

  const [isNewPB, setIsNewPB] = useState(false);
  const [xpResult, setXpResult] = useState(null);

  const conqueredRegionsThisGameRef = useRef([]);
  const speedGuessCount3sRef = useRef(0);
  const speedGuessCount1sRef = useRef(0);
  const guessTimestampsRef = useRef([]);
  const guessesThisGameRef = useRef([]);
  const lastGuessTimeRef = useRef(0);
  const lightningCountRef = useRef(0);
  const successPendingRef = useRef(new Set());

  const navigationTrailRef = useRef([]);
  const navigationTrailIndexRef = useRef(-1);

  const resetNavigationTrail = useCallback((country) => {
    navigationTrailRef.current = country ? [country] : [];
    navigationTrailIndexRef.current = country ? 0 : -1;
  }, []);

  const getClosestUnfound = useCallback(
    (fromAdmin, currentFound) => {
      const c1 = activeDataMap[fromAdmin];
      if (!c1 || c1.lat === undefined) return null;

      const sameRegionList = [];
      const otherRegionList = [];

      Object.keys(activeDataMap).forEach((key) => {
        if (!currentFound.includes(key) && activeDataMap[key].lat !== undefined) {
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

      // Proximity-biased pick among the closest few — keeps the tour coherent
      // (same region first, nearby targets) while varying run to run.
      const pickWeightedNearest = (list) => {
        list.sort((a, b) => a.dist - b.dist);
        const pool = list.slice(0, AUTO_NAVIGATION.candidatePool);
        const r = Math.random();
        let acc = 0;
        for (let i = 0; i < pool.length; i += 1) {
          acc += AUTO_NAVIGATION.weights[i] ?? 0;
          if (r < acc) return pool[i].key;
        }
        return pool[0].key;
      };

      if (sameRegionList.length > 0) {
        return pickWeightedNearest(sameRegionList);
      } else if (otherRegionList.length > 0) {
        return pickWeightedNearest(otherRegionList);
      }
      return null;
    },
    [activeDataMap]
  );

  const navigateFocus = useCallback(
    (direction) => {
      const unfoundKeys = allCountryKeys.filter(
        (k) => !foundList.includes(k) && activeDataMap[k]?.lat !== undefined
      );
      if (unfoundKeys.length === 0) return;

      if (!isPlaying && mode !== "learn") setIsPlaying(true);

      let nextCountry;
      if (!selectedCountry) {
        nextCountry = direction === "prev" ? unfoundKeys[unfoundKeys.length - 1] : unfoundKeys[0];
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
            new Set([...foundList, ...trail, selectedCountry])
          );
          nextCountry = getClosestUnfound(selectedCountry, excludedForNavigation);

          if (nextCountry) {
            if (direction === "prev") {
              navigationTrailRef.current = [nextCountry, ...trail];
              navigationTrailIndexRef.current = 0;
            } else {
              navigationTrailRef.current = [...trail.slice(0, trailIndex + 1), nextCountry];
              navigationTrailIndexRef.current = trailIndex + 1;
            }
          }
        }
      }

      if (!nextCountry) return;

      setSelectedCountry(nextCountry);
      setPopupError(false);
      setPopupWarning(false);

      if (extInputRef && extInputRef.current && document.activeElement !== extInputRef.current) {
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
      setSelectedCountry,
      extInputRef,
      setPopupError,
      setPopupWarning,
    ]
  );

  const handleGameFinished = useCallback(
    async (finalScore) => {
      if (mode === "learn") return;
      const timeSpent = gameDuration - timeLeft;

      const prevRecord = localRecords[mode] || { maxScore: 0, bestTime: null, gamesPlayed: 0 };
      const isPB =
        finalScore > prevRecord.maxScore || (prevRecord.maxScore === 0 && finalScore > 0);

      if (isPB) {
        setIsNewPB(true);
      }

      const res = await updateGameRecord(
        mode,
        finalScore,
        timeSpent,
        totalPossible,
        gameDuration,
        conqueredRegionsThisGameRef.current,
        isHardcoreRun
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
              invaderId: chObj.id,
            });
          }
        });
      }
    },
    [
      mode,
      gameDuration,
      timeLeft,
      updateGameRecord,
      localRecords,
      totalPossible,
      lang,
      addAchievementToQueue,
      isHardcoreRun,
    ]
  );

  const stopGame = useCallback(() => {
    setIsGameOver(true);
    setIsPlaying(false);
    setShowEndScreen(true);
    handleGameFinished(foundList.length);
  }, [foundList.length, handleGameFinished]);

  // Hardcore: out of lives -> the run ends (after the error flash plays out).
  useEffect(() => {
    if (!isHardcoreRun || isGameOver || mistakes < HARDCORE_LIVES) return undefined;
    const timer = setTimeout(() => stopGame(), FEEDBACK_TIMING.flashMs);
    return () => clearTimeout(timer);
  }, [mistakes, isHardcoreRun, isGameOver, stopGame]);

  const resetGame = useCallback(
    (_newMode) => {
      setFoundList([]);
      setTimeLeft(gameDuration);
      setIsPlaying(false);
      setIsGameOver(false);
      setShowEndScreen(false);
      setSelectedCountry(null);
      resetNavigationTrail(null);
      setIsNewPB(false);
      setXpResult(null);
      conqueredRegionsThisGameRef.current = [];
      speedGuessCount3sRef.current = 0;
      speedGuessCount1sRef.current = 0;
      guessTimestampsRef.current = [];
      guessesThisGameRef.current = [];
      lastGuessTimeRef.current = Date.now();
      lightningCountRef.current = 0;
      successPendingRef.current.clear();
      setMistakes(0);
    },
    [resetNavigationTrail, gameDuration, setSelectedCountry]
  );

  const handleSuccessfulGuess = useCallback(
    (guessedKey) => {
      const newFound = [...foundList, guessedKey];
      successPendingRef.current.add(guessedKey);
      triggerGlobeFeedback(guessedKey, { isError: false, isSuccess: true });
      setPopupError(false);
      setPopupWarning(false);
      setPopupSuccess(true);
      if (selectedCountry !== guessedKey) {
        setSelectedCountry(guessedKey);
        requestAnimationFrame(() => {
          triggerGlobeFeedback(guessedKey, { isError: false, isSuccess: true });
        });
      }

      requestAnimationFrame(() => {
        recordSuccessfulGuessSideEffects({
          guessedKey,
          foundList,
          newFound,
          activeDataMap,
          refs: {
            lastGuessTimeRef,
            guessesThisGameRef,
            speedGuessCount3sRef,
            speedGuessCount1sRef,
            guessTimestampsRef,
            lightningCountRef,
            conqueredRegionsThisGameRef,
          },
          mode,
          gameDuration,
          timeLeft,
          globeTheme,
          theme,
          t,
          lang,
          userProfile,
          localRecords,
          session,
          setUserProfile,
          addAchievementToQueue,
        });
      });

      setTimeout(() => {
        successPendingRef.current.delete(guessedKey);
        triggerGlobeFeedback(guessedKey, { isError: false, isSuccess: false });
        setFoundList(newFound);
        setPopupSuccess(false);
        setSelectedCountry((prev) => {
          if (prev === guessedKey) {
            const nextCountry = getClosestUnfound(guessedKey, newFound);
            navigationTrailRef.current = nextCountry ? [guessedKey, nextCountry] : [guessedKey];
            navigationTrailIndexRef.current = nextCountry ? 1 : 0;
            if (
              extInputRef &&
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
      }, FEEDBACK_TIMING.successFlashMs);
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
      lang,
      setSelectedCountry,
      extInputRef,
      addAchievementToQueue,
      setPopupSuccess,
      triggerGlobeFeedback,
      selectedCountry,
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

      for (const adminKey of Object.keys(activeDataMap)) {
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

        const config = getActiveModeConfig(mode);
        if (config.targetCheck === "capital") {
          if (matchCapital && matchCapital === normalizedInput) {
            matchFound = adminKey;
            break;
          }
        } else {
          if (
            matchName === normalizedInput ||
            aliases.some((alias) => normalizeString(alias) === normalizedInput)
          ) {
            matchFound = adminKey;
            break;
          }
        }
      }

      if (matchFound) {
        if (foundList.includes(matchFound) || successPendingRef.current.has(matchFound)) {
          return "ALREADY_FOUND";
        }
        handleSuccessfulGuess(matchFound);
        return "SUCCESS";
      }
      registerMistake();
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
      registerMistake,
    ]
  );

  const specificCountryGuess = useCallback(
    (inputVal) => {
      if (!selectedCountry) return false;
      const mapped = activeDataMap[selectedCountry];
      if (!mapped) return false;

      if (!isPlaying && mode !== "learn") setIsPlaying(true);

      const normalizedInput = normalizeString(inputVal);
      const matchName =
        lang === "fr" ? normalizeString(mapped.name_fr) : normalizeString(mapped.name_en);
      const matchCapital =
        lang === "fr" && mapped.capital_fr
          ? normalizeString(mapped.capital_fr)
          : mapped.capital
            ? normalizeString(mapped.capital)
            : null;
      const aliases = mapped.aliases || [];

      const config = getActiveModeConfig(mode);
      let isSuccessVal = false;
      if (config.targetCheck === "capital") {
        isSuccessVal = matchCapital && matchCapital === normalizedInput;
      } else {
        isSuccessVal =
          matchName === normalizedInput ||
          aliases.some((alias) => normalizeString(alias) === normalizedInput);
      }

      if (isSuccessVal) {
        if (foundList.includes(selectedCountry) || successPendingRef.current.has(selectedCountry)) {
          setPopupWarning(true);
          setTimeout(() => setPopupWarning(false), FEEDBACK_TIMING.flashMs);
          return "ALREADY_FOUND";
        }

        handleSuccessfulGuess(selectedCountry);
        return "SUCCESS";
      } else {
        registerMistake();
        triggerGlobeFeedback(selectedCountry, { isError: true, isSuccess: false });
        setPopupError(true);
        setTimeout(() => {
          triggerGlobeFeedback(selectedCountry, { isError: false, isSuccess: false });
          setPopupError(false);
        }, FEEDBACK_TIMING.flashMs);
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
      setPopupError,
      setPopupWarning,
      triggerGlobeFeedback,
      registerMistake,
    ]
  );

  const handleSearch = useCallback(
    (inputVal) => {
      const normalizedInput = normalizeString(inputVal);
      if (!normalizedInput) return false;

      for (const adminKey of Object.keys(activeDataMap)) {
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
          setSelectedCountry(adminKey);
          resetNavigationTrail(adminKey);
          return true;
        }
      }

      return false;
    },
    [activeDataMap, lang, setSelectedCountry, resetNavigationTrail]
  );

  useEffect(() => {
    if (isPlaying && !isGameOver && foundList.length > 0 && foundList.length >= totalPossible) {
      setIsGameOver(true);
      setIsPlaying(false);
      setShowEndScreen(true);
      handleGameFinished(foundList.length);
    }
  }, [foundList.length, isPlaying, isGameOver, totalPossible, handleGameFinished]);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isArrow = e.key === "ArrowRight" || e.key === "ArrowLeft";
      if (!isArrow) return;

      const inTextField = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
      const inGameInput = Boolean(extInputRef?.current) && e.target === extInputRef.current;

      // Shift+Arrow mirrors the prev/next arrows around the search bar. It also
      // fires from the game answer input when it is empty (its dominant state);
      // with content, native Shift+Arrow text selection keeps priority.
      if (
        e.shiftKey &&
        !e.repeat &&
        mode !== "learn" &&
        (!inTextField || (inGameInput && e.target.value === ""))
      ) {
        e.preventDefault();
        navigateFocus(e.key === "ArrowRight" ? "next" : "prev");
        return;
      }

      if (inTextField) return;
      if (isPlaying && selectedCountry) {
        if (e.key === "ArrowRight") navigateFocus("next");
        if (e.key === "ArrowLeft") navigateFocus("prev");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, selectedCountry, navigateFocus, mode, extInputRef]);

  return {
    foundList,
    setFoundList,
    score,
    isPlaying,
    setIsPlaying,
    isGameOver,
    setIsGameOver,
    showEndScreen,
    setShowEndScreen,
    timeLeft,
    setTimeLeft,
    feedback,
    popupSuccess,
    popupError,
    popupWarning,
    setPopupError,
    setPopupWarning,
    setPopupSuccess,
    isNewPB,
    setIsNewPB,
    xpResult,
    setXpResult,
    handleSuccessfulGuess,
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
  };
}
