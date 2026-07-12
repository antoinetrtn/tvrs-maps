import { useState, useEffect, useRef, useCallback } from "react";
import { normalizeString } from "../utils";
import { riversMountainsDataMap } from "../riversMountainsData";
import { countryDataMap } from "../gameData";
import { CHALLENGES } from "../challenges";
import { isSupabaseConfigured, upsertProfile } from "../supabaseClient";
import { AVATAR_COLORS, getThemeRegionColorLabel } from "../designSystem";
import { FEEDBACK_TIMING } from "../gameConstants";
import { getLevelAndProgress, checkChallengesRealTime } from "../useUserProfile";

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
}) {
  const [foundList, setFoundList] = useState([]);
  const score = foundList.length;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(gameDuration);

  const [feedback, setFeedback] = useState(null);
  const popupSuccess = feedback === "success";
  const popupError = feedback === "error";
  const popupWarning = feedback === "warning";

  const setPopupSuccess = useCallback((val) => setFeedback(val ? "success" : null), []);
  const setPopupError = useCallback((val) => setFeedback(val ? "error" : null), []);
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

      if (
        extInputRef &&
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
      setSelectedCountry,
      extInputRef,
      setPopupError,
      setPopupWarning,
    ],
  );

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

  const stopGame = useCallback(() => {
    setIsGameOver(true);
    setIsPlaying(false);
    setShowEndScreen(true);
    handleGameFinished(foundList.length);
  }, [foundList.length, handleGameFinished]);

  const resetGame = useCallback(
    (newMode) => {
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
    },
    [resetNavigationTrail, gameDuration, setSelectedCountry],
  );

  const handleSuccessfulGuess = useCallback(
    (guessedKey, timing) => {
      const newFound = [...foundList, guessedKey];
      setFoundList(newFound);
      setPopupError(false);
      setPopupWarning(false);
      setPopupSuccess(true);
      setSelectedCountry(guessedKey);

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

      const hour = new Date().getHours();
      const currentBadges = userProfile.unlockedBadges || [];
      const sessionData = {
        mode,
        score: newFound.length,
        timeSpent: gameDuration - timeLeft,
        timeLeft,
        accuracy: 1,
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
      lang,
      setSelectedCountry,
      extInputRef,
      addAchievementToQueue,
      setPopupSuccess,
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

      let isSuccessVal = false;
      if (
        (mode === "countries" ||
          mode === "departments" ||
          mode === "rivers_mountains") &&
        (matchName === normalizedInput ||
          aliases.some((alias) => normalizeString(alias) === normalizedInput))
      ) {
        isSuccessVal = true;
      } else if (mode === "capitals" && matchCapital === normalizedInput) {
        isSuccessVal = true;
      }

      if (isSuccessVal) {
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
      setPopupError,
      setPopupWarning,
    ],
  );

  const handleSearch = useCallback(
    (inputVal, learnShowRivers, learnShowMountains) => {
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
          setSelectedCountry(adminKey);
          resetNavigationTrail(adminKey);
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
            setSelectedCountry(adminKey);
            resetNavigationTrail(adminKey);
            return true;
          }
        }
      }

      return false;
    },
    [
      activeDataMap,
      lang,
      mode,
      setSelectedCountry,
      resetNavigationTrail,
    ],
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
  };
}
