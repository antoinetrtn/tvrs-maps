import "./GameHUD.css";
import "./GameHUDLives.css";

import { ChevronLeft, ChevronRight, Home, InfoBox, Play, Square } from "pixelarticons/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getThemeRegionColorLabel } from "../config/designSystem";
import { GAME_REGIONS, getRegionAbbr } from "../config/gameConfig";
import { BREAKPOINTS, HARDCORE_LIVES } from "../config/gameConstants";
import { useTranslation } from "../config/i18n";
import useAnswerCombobox from "../hooks/useAnswerCombobox";
import {
  ANSWER_INPUT_PROPS,
  focusAnswerInputSafely,
  shieldAutofillText,
} from "../utils/answerField";
import AnswerSuggestionList from "./AnswerSuggestionList";
import Logo from "./Logo";
import { PixelHeart } from "./PixelHeart";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import TextField from "./ui/TextField";

const GameHUD = ({
  mode,
  onGoHome,
  lang,
  score,
  totalPossible,
  timeLeft,
  onEnter,
  isPlaying,
  isGameOver,
  onStop,
  onInfo,
  isFocusedCountry,
  _onClearFocus,
  onNavigateFocus,
  inputError,
  inputSuccess,
  inputWarning,
  extInputRef,
  foundList,
  countryDataMap,
  viewport,
  isKeyboardMode,
  selectedCountry,
  learnSubMode,
  learnSearchQuery = "",
  onLearnSearchChange,
  onToggleLearnPanel,
  showLearnPanel,
  hideLearnInput = false,
  hideHudPlayStop = false,
  livesLeft = null,
  isHardcoreRun = false,
}) => {
  const [scoreGlow, setScoreGlow] = useState(false);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    if (score > prevScoreRef.current) {
      setScoreGlow(true);
      const timer = setTimeout(() => setScoreGlow(false), 500);
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = score;
  }, [score]);

  // Hardcore lives: brief shake when a heart is lost.
  const [livesShake, setLivesShake] = useState(false);
  const prevLivesRef = useRef(livesLeft);
  useEffect(() => {
    const prev = prevLivesRef.current;
    prevLivesRef.current = livesLeft;
    if (livesLeft !== null && prev !== null && livesLeft < prev) {
      setLivesShake(true);
      const timer = setTimeout(() => setLivesShake(false), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [livesLeft]);

  // Guarantee text input focus on game launch, restart, or mode change
  useEffect(() => {
    const focusInput = () => {
      focusAnswerInputSafely(extInputRef);
    };

    focusInput();
    const t1 = setTimeout(focusInput, 40);
    const t2 = setTimeout(focusInput, 120);
    const t3 = setTimeout(focusInput, 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [extInputRef, mode, isPlaying]);

  const t = useTranslation(lang);
  const requireSelection = mode !== "learn" && !selectedCountry;

  const { inputProps, suggestions, activeIndex, isRejected, choose, statusText } =
    useAnswerCombobox({
      mode,
      lang,
      countryDataMap,
      foundList,
      onEnter,
      inputRef: extInputRef,
      learnSearchQuery,
      onLearnSearchChange,
      t,
      requireSelection,
    });

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const CONTINENT_ORDER = GAME_REGIONS.filter((r) => r !== "Unknown");
  const REGION_COLORS = useMemo(() => {
    return GAME_REGIONS.reduce((acc, r) => ({ ...acc, [r]: getThemeRegionColorLabel(r) }), {});
  }, []);
  const regionStats = useMemo(() => {
    if (!countryDataMap) return {};
    const stats = {};
    CONTINENT_ORDER.forEach((r) => (stats[r] = { total: 0, found: 0 }));
    Object.keys(countryDataMap).forEach((k) => {
      const reg = countryDataMap[k]?.region;
      if (reg && !stats[reg]) stats[reg] = { total: 0, found: 0 };
      if (reg && stats[reg]) stats[reg].total++;
    });
    if (foundList)
      foundList.forEach((k) => {
        const reg = countryDataMap[k]?.region;
        if (reg && stats[reg]) stats[reg].found++;
      });
    return stats;
  }, [foundList, countryDataMap]);

  const progressPercent = totalPossible ? Math.min((score / totalPossible) * 100, 100) : 0;
  const isDepartmentsMode = mode === "departments";

  const placeholderText = useMemo(() => {
    if (mode === "learn") {
      return learnSubMode === "rivers_mountains"
        ? t("search_placeholder_rivers_mountains")
        : t("search_placeholder");
    }
    if (requireSelection) {
      return t("answer_placeholder_select");
    }
    if (mode === "rivers_mountains") {
      return t("search_placeholder_rivers_mountains");
    }
    return t("answer_placeholder");
  }, [mode, learnSubMode, requireSelection, t]);

  // Determine which continent to highlight
  const activeContinent = useMemo(
    () => (selectedCountry && countryDataMap ? countryDataMap[selectedCountry]?.region : null),
    [selectedCountry, countryDataMap]
  );

  const gaugeRegions = isDepartmentsMode
    ? ["France"]
    : CONTINENT_ORDER.filter((region) => region !== "France");
  const getRegionColor = useCallback(
    (region) => REGION_COLORS[region] || (isDepartmentsMode ? "var(--accent)" : "var(--warning)"),
    [REGION_COLORS, isDepartmentsMode]
  );

  const isMobile = viewport.width < BREAKPOINTS.desktop;

  const heartsRow =
    isHardcoreRun && livesLeft !== null ? (
      <div
        className={`hud-hearts ${livesShake ? "hearts-shake" : ""}`}
        title={t("hardcore_lives")}
        aria-label={`${t("hardcore_lives")}: ${livesLeft}/${HARDCORE_LIVES}`}
      >
        {Array.from({ length: HARDCORE_LIVES }, (_, i) => (
          <PixelHeart
            key={i}
            width={14}
            height={14}
            className={i < livesLeft ? "heart-full" : "heart-lost"}
          />
        ))}
      </div>
    ) : null;

  return (
    <>
      <div
        className={`top-hud-bar ${isMobile ? "mobile-layout" : "desktop-layout"} ${mode === "learn" ? "learn-mode" : ""}`}
        style={
          isMobile
            ? {
                top: 0,
                left: "50%",
                transform: `translate3d(-50%, calc(${viewport.top + 24}px + env(safe-area-inset-top, 0px)), 0)`,
              }
            : {}
        }
      >
        {isMobile ? (
          // === MOBILE TOP HUD BAR ===
          <>
            <div className="hud-top-left">
              <IconButton
                label={t("home")}
                look="hud"
                onClick={onGoHome}
                onMouseDown={(e) => e.preventDefault()}
              >
                <Home width={18} height={18} />
              </IconButton>
              {mode !== "learn" && (
                <Button
                  variant="secondary"
                  size="sm"
                  className={`hud-mini-pill score-pill ${scoreGlow ? "score-increased-flash" : ""}`}
                  onClick={onInfo}
                  onMouseDown={(e) => e.preventDefault()}
                  title={t("progress_title")}
                >
                  <span className="mini-pill-val">{score}</span>
                  <span className="mini-pill-sub">/{totalPossible}</span>
                </Button>
              )}
            </div>

            <div className="hud-top-center">{heartsRow}</div>

            <div className="hud-top-right">
              {mode === "learn" ? (
                <IconButton
                  label={t("data_table")}
                  look="hud"
                  className={`${showLearnPanel ? "active" : ""}`}
                  onClick={onToggleLearnPanel}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <InfoBox width={18} height={18} />
                </IconButton>
              ) : (
                <div
                  style={{
                    display: "flex",
                    gap: "var(--spacing-sm)",
                    alignItems: "center",
                    pointerEvents: "auto",
                  }}
                >
                  {isPlaying && !isGameOver ? (
                    <IconButton
                      label={t("stop")}
                      look="hud"
                      style={{ color: "var(--error)", width: "40px", height: "40px" }}
                      onClick={onStop}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <Square width={16} height={16} />
                    </IconButton>
                  ) : (
                    <IconButton
                      label={t("play")}
                      look="hud"
                      style={{ color: "var(--success)", width: "40px", height: "40px" }}
                      onClick={() => onNavigateFocus("next")}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <Play width={16} height={16} />
                    </IconButton>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className={`hud-mini-pill timer-pill ${timeLeft > 0 && timeLeft <= 30 ? "timer-low" : ""}`}
                    onClick={onInfo}
                    onMouseDown={(e) => e.preventDefault()}
                    title={t("progress_title")}
                  >
                    <span className="mini-pill-val">{formatTime(timeLeft)}</span>
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          // === DESKTOP TOP HUD BAR ===
          <>
            <div className="hud-top-left">
              <Button
                variant="ghost"
                className="hud-logo-clickable"
                onClick={onGoHome}
                onMouseDown={(e) => e.preventDefault()}
                aria-label={t("return_home")}
                title={t("return_home")}
              >
                <Logo size="small" variant="hud" />
              </Button>
            </div>

            <div className="hud-top-center">
              {mode !== "learn" && (
                <Button
                  variant="ghost"
                  look="hud-island"
                  onClick={onInfo}
                  onMouseDown={(e) => e.preventDefault()}
                  title={t("progress_title")}
                >
                  <span
                    className={`island-font ${timeLeft > 0 && timeLeft <= 30 ? "timer-low" : ""}`}
                  >
                    {formatTime(timeLeft)}
                  </span>
                  <span className="island-divider" />
                  <span className="island-progress-wrap">
                    <span className="progress-linear-container">
                      <span
                        className="progress-linear-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </span>
                  </span>
                  <span className="island-divider" />
                  <span className={`island-font ${scoreGlow ? "score-increased-flash" : ""}`}>
                    <span className="island-font">
                      {score}/{totalPossible}
                    </span>
                  </span>
                </Button>
              )}
            </div>

            <div className="hud-top-right">
              {heartsRow}
              {mode === "learn" ? null : hideHudPlayStop ? null : isPlaying && !isGameOver ? (
                <IconButton
                  label={t("stop")}
                  look="hud"
                  style={{ color: "var(--error)" }}
                  onClick={onStop}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Square width={18} height={18} />
                </IconButton>
              ) : (
                <IconButton
                  label={t("play")}
                  look="hud"
                  style={{ color: "var(--success)" }}
                  onClick={() => onNavigateFocus("next")}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Play width={18} height={18} />
                </IconButton>
              )}
            </div>
          </>
        )}
      </div>

      {/* Desktop Only Gauges in Bottom Right */}
      {!isMobile && mode !== "learn" && (
        <div className="hud-bottom-right">
          <div className="island-sub-gauges animation-fade-in">
            {gaugeRegions.map((reg) => {
              const isActive = activeContinent === reg;
              const isFaded = activeContinent && activeContinent !== reg;

              return (
                <div
                  key={reg}
                  className={`gauge-item ${isActive ? "highlight" : ""} ${isFaded ? "faded" : ""}`}
                  title={t(`region_${reg}`)}
                >
                  <div
                    className="circular-gauge"
                    style={{
                      "--pct": `${(regionStats[reg]?.found / regionStats[reg]?.total) * 100}%`,
                      "--color": getRegionColor(reg),
                    }}
                  >
                    <span className="gauge-val">{getRegionAbbr(reg)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <IconButton label={t("information")} look="hud" onClick={onInfo}>
            <InfoBox width={18} height={18} />
          </IconButton>
        </div>
      )}

      {!(hideLearnInput && mode === "learn") && (
        <div
          className={`bottom-hud-container ${isKeyboardMode ? "keyboard-mode" : ""} ${mode === "learn" ? "learn-search-bar" : ""}`}
          style={
            window.innerWidth < BREAKPOINTS.desktop
              ? {
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: `translate3d(-50%, calc(${viewport.top + viewport.height - 24}px - env(safe-area-inset-bottom, 0px)), 0) translateY(-100%)`,
                  bottom: "auto",
                }
              : {}
          }
        >
          {suggestions.length > 0 && inputProps["aria-expanded"] && (
            <AnswerSuggestionList
              id={inputProps["aria-controls"]}
              suggestions={suggestions}
              activeIndex={activeIndex}
              onSelect={choose}
              t={t}
            />
          )}

          <div className="bottom-hud-islands">
            {isFocusedCountry && mode !== "learn" && (
              <IconButton
                label={t("previous")}
                look="hud"
                className="prev-btn"
                onClick={() => onNavigateFocus("prev")}
                onMouseDown={(e) => e.preventDefault()}
              >
                <ChevronLeft width={18} height={18} />
              </IconButton>
            )}

            <form
              autoComplete="off"
              data-form-type="other"
              onSubmit={(e) => e.preventDefault()}
              className={`input-island ${inputError ? "error" : ""} ${inputWarning ? "warning" : ""} ${inputSuccess ? "success" : ""} ${isRejected ? "is-rejected" : ""}`}
            >
              <TextField
                variant="bare"
                ref={extInputRef}
                {...ANSWER_INPUT_PROPS}
                {...inputProps}
                id="q-resp-field"
                placeholder={shieldAutofillText(placeholderText)}
                className="input-field"
                aria-label={shieldAutofillText(t("quiz_answer"))}
              />
            </form>

            {isFocusedCountry && mode !== "learn" && (
              <IconButton
                label={t("next")}
                look="hud"
                className="next-btn"
                onClick={() => onNavigateFocus("next")}
                onMouseDown={(e) => e.preventDefault()}
              >
                <ChevronRight width={18} height={18} />
              </IconButton>
            )}
          </div>

          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {statusText}
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(GameHUD);
