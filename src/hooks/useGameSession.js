import { useCallback, useEffect, useRef, useState } from "react";

import { AVATAR_COLORS } from "../config/designSystem";
import { getActiveModeConfig } from "../config/gameConfig";
import { AUTO_NAVIGATION, FEEDBACK_TIMING, HARDCORE_LIVES } from "../config/gameConstants";
import { CHALLENGES } from "../data/challenges";
import { nextTrainingTarget } from "../services/countryStats";
import { recordSuccessfulGuessSideEffects } from "../utils/recordSuccessfulGuessSideEffects";
import { normalizeString } from "../utils/utils";

function resolveTrailCountry({
  direction,
  selectedCountry,
  navigationTrailRef,
  navigationTrailIndexRef,
  foundList,
  getClosestUnfound,
}) {
  let trail = navigationTrailRef.current;
  let trailIndex = navigationTrailIndexRef.current;

  if (trail[trailIndex] !== selectedCountry) {
    trail = [selectedCountry];
    trailIndex = 0;
    navigationTrailRef.current = trail;
    navigationTrailIndexRef.current = trailIndex;
  }

  if (direction === "prev" && trailIndex > 0) {
    navigationTrailIndexRef.current = trailIndex - 1;
    return trail[trailIndex - 1];
  }

  if (direction === "next" && trailIndex < trail.length - 1) {
    navigationTrailIndexRef.current = trailIndex + 1;
    return trail[trailIndex + 1];
  }

  const excluded = Array.from(new Set([...foundList, ...trail, selectedCountry]));
  const nextCountry = getClosestUnfound(selectedCountry, excluded);

  if (nextCountry) {
    if (direction === "prev") {
      navigationTrailRef.current = [nextCountry, ...trail];
      navigationTrailIndexRef.current = 0;
    } else {
      navigationTrailRef.current = [...trail.slice(0, trailIndex + 1), nextCountry];
      navigationTrailIndexRef.current = trailIndex + 1;
    }
  }

  return nextCountry;
}

function focusExternalInput(extInputRef) {
  if (extInputRef?.current && document.activeElement !== extInputRef.current) {
    setTimeout(() => extInputRef.current?.focus(), FEEDBACK_TIMING.focusKeyboardMs);
  }
}

function handleDebugInput(inputVal, activeDataMap, setFoundList, setIsGameOver) {
  if (!import.meta.env.DEV) return false;
  if (inputVal === "WIN100") return (setFoundList(Object.keys(activeDataMap)), true);
  if (inputVal === "LOSE100") return (setIsGameOver(true), true);
  return false;
}

function resolveCapitalString(mapped, lang) {
  if (!mapped) return null;
  const val = lang === "fr" && mapped.capital_fr ? mapped.capital_fr : mapped.capital;
  return val ? normalizeString(val) : null;
}

function resolveCountryNameString(mapped, adminKey, lang) {
  if (!mapped) return normalizeString(adminKey);
  const val =
    lang === "fr" ? mapped.name_fr || mapped.name_en || adminKey : mapped.name_en || adminKey;
  return normalizeString(val);
}

function isInputMatchingCountry({ adminKey, mapped, lang, mode, normalizedInput }) {
  const config = getActiveModeConfig(mode);
  if (config.targetCheck === "capital") {
    const matchCapital = resolveCapitalString(mapped, lang);
    return Boolean(matchCapital && matchCapital === normalizedInput);
  }
  const matchName = resolveCountryNameString(mapped, adminKey, lang);
  const aliases = mapped?.aliases || [];
  return (
    matchName === normalizedInput ||
    aliases.some((alias) => normalizeString(alias) === normalizedInput)
  );
}

function findMatchingCountryKey({ keys, activeDataMap, lang, mode, normalizedInput }) {
  for (const adminKey of keys) {
    const mapped = Object.hasOwn(activeDataMap, adminKey) ? activeDataMap[adminKey] : null;
    if (isInputMatchingCountry({ adminKey, mapped, lang, mode, normalizedInput })) {
      return adminKey;
    }
  }
  return null;
}

function checkSpecificCountryMatch({ mapped, lang, mode, normalizedInput }) {
  const config = getActiveModeConfig(mode);
  if (config.targetCheck === "capital") {
    const matchCapital = resolveCapitalString(mapped, lang);
    return Boolean(matchCapital && matchCapital === normalizedInput);
  }
  const matchName =
    lang === "fr" ? normalizeString(mapped.name_fr) : normalizeString(mapped.name_en);
  const aliases = mapped.aliases || [];
  return (
    matchName === normalizedInput ||
    aliases.some((alias) => normalizeString(alias) === normalizedInput)
  );
}

function handleGuessErrorFeedback({
  selectedCountry,
  registerMistake,
  triggerGlobeFeedback,
  setPopupError,
}) {
  registerMistake();
  triggerGlobeFeedback(selectedCountry, { isError: true, isSuccess: false });
  setPopupError(true);
  setTimeout(() => {
    triggerGlobeFeedback(selectedCountry, { isError: false, isSuccess: false });
    setPopupError(false);
  }, FEEDBACK_TIMING.flashMs);
}

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
  selectedCountry,
  setSelectedCountry,
  activeDataMap,
  extInputRef,
  effectiveKeyboardMode,
  globeFeedbackApplierRef,
  hardcoreMode = false,
  trainingPool = null,
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
  // Saisie validée pendant le flash de réussite (successFlashMs) : la sélection
  // pointe encore le pays tout juste trouvé, donc on garde la réponse et on la
  // rejoue sur le pays suivant dès l'auto-avance, au lieu de l'avaler (bug Entrée).
  const queuedGuessRef = useRef(null);

  const navigationTrailRef = useRef([]);
  const navigationTrailIndexRef = useRef(-1);

  const resetNavigationTrail = useCallback((country) => {
    navigationTrailRef.current = country ? [country] : [];
    navigationTrailIndexRef.current = country ? 0 : -1;
  }, []);

  const getClosestUnfound = useCallback(
    (fromAdmin, currentFound) => {
      // Entraînement ciblé : on suit l'ordre du pool (moins maîtrisés d'abord), pas la proximité.
      if (trainingPool) return nextTrainingTarget(trainingPool, currentFound);
      const c1 = activeDataMap[fromAdmin];
      if (c1?.lat === undefined) return null;

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
    [activeDataMap, trainingPool]
  );

  const navigateFocus = useCallback(
    (direction) => {
      const unfoundKeys = allCountryKeys.filter(
        (k) =>
          !foundList.includes(k) &&
          Object.hasOwn(activeDataMap, k) &&
          activeDataMap[k]?.lat !== undefined
      );
      if (unfoundKeys.length === 0) return;

      if (!isPlaying && mode !== "learn") setIsPlaying(true);

      let nextCountry;
      if (!selectedCountry) {
        nextCountry = direction === "prev" ? unfoundKeys[unfoundKeys.length - 1] : unfoundKeys[0];
        resetNavigationTrail(nextCountry);
      } else {
        nextCountry = resolveTrailCountry({
          direction,
          selectedCountry,
          navigationTrailRef,
          navigationTrailIndexRef,
          foundList,
          getClosestUnfound,
        });
      }

      if (!nextCountry) return;

      setSelectedCountry(nextCountry);
      setPopupError(false);
      setPopupWarning(false);
      focusExternalInput(extInputRef);
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
      // Pas de record, d'XP ni de classement pour « Apprendre » et l'entraînement ciblé (pool réduit).
      if (mode === "learn" || trainingPool) return;
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

      if (res?.newlyUnlockedBadges?.length > 0) {
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
      trainingPool,
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
      if (activeDataMap) {
        const keys = Object.keys(activeDataMap).filter(
          (k) =>
            activeDataMap[k]?.lat !== undefined ||
            (Array.isArray(activeDataMap[k]?.path) && activeDataMap[k].path.length > 0)
        );
        if (keys.length > 0) {
          const randomIndex = Math.floor(Math.random() * keys.length);
          setSelectedCountry(keys[randomIndex]);
        } else {
          setSelectedCountry(null);
        }
      } else {
        setSelectedCountry(null);
      }
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
      queuedGuessRef.current = null;
      setMistakes(0);
    },
    [activeDataMap, resetNavigationTrail, gameDuration, setSelectedCountry]
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
              extInputRef?.current &&
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
      if (handleDebugInput(inputVal, activeDataMap, setFoundList, setIsGameOver)) {
        return "SUCCESS";
      }

      if (!isPlaying && mode !== "learn") setIsPlaying(true);
      if (selectedCountry) return "";

      const normalizedInput = normalizeString(inputVal);
      if (!normalizedInput) return "";

      const candidateKeys = trainingPool ?? Object.keys(activeDataMap);
      const matchFound = findMatchingCountryKey({
        keys: candidateKeys,
        activeDataMap,
        lang,
        mode,
        normalizedInput,
      });

      if (!matchFound) {
        registerMistake();
        return "ERROR";
      }

      if (foundList.includes(matchFound) || successPendingRef.current.has(matchFound)) {
        return "ALREADY_FOUND";
      }
      handleSuccessfulGuess(matchFound);
      return "SUCCESS";
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
      trainingPool,
    ]
  );

  const specificCountryGuess = useCallback(
    (inputVal) => {
      if (!selectedCountry) return "";
      const mapped = Object.hasOwn(activeDataMap, selectedCountry)
        ? activeDataMap[selectedCountry]
        : null;
      if (!mapped) return "";

      if (!isPlaying && mode !== "learn") setIsPlaying(true);

      const normalizedInput = normalizeString(inputVal);
      const isSuccessVal = checkSpecificCountryMatch({ mapped, lang, mode, normalizedInput });

      if (!isSuccessVal && successPendingRef.current.has(selectedCountry)) {
        queuedGuessRef.current = { from: selectedCountry, value: inputVal };
        return "QUEUED";
      }

      if (!isSuccessVal) {
        handleGuessErrorFeedback({
          selectedCountry,
          registerMistake,
          triggerGlobeFeedback,
          setPopupError,
        });
        return "ERROR";
      }

      if (foundList.includes(selectedCountry) || successPendingRef.current.has(selectedCountry)) {
        setPopupWarning(true);
        setTimeout(() => setPopupWarning(false), FEEDBACK_TIMING.flashMs);
        return "ALREADY_FOUND";
      }

      handleSuccessfulGuess(selectedCountry);
      return "SUCCESS";
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

  useEffect(() => {
    const queued = queuedGuessRef.current;
    if (!queued || !selectedCountry || selectedCountry === queued.from) return;
    queuedGuessRef.current = null;
    specificCountryGuess(queued.value);
  }, [selectedCountry, specificCountryGuess]);

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
        const capitalRaw = lang === "fr" && mapped.capital_fr ? mapped.capital_fr : mapped.capital;
        const matchCapital = capitalRaw ? normalizeString(capitalRaw) : null;
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
