import "./GameHUD.css";
import "./GameHUDLives.css";

import { ChevronLeft, ChevronRight, Home, InfoBox, Play, Square } from "pixelarticons/react";
import React, { useEffect, useMemo, useRef, useState } from "react";

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

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function resolvePlaceholderText({ mode, learnSubMode, requireSelection, t }) {
  if (mode === "learn") {
    return t(
      learnSubMode === "rivers_mountains"
        ? "search_placeholder_rivers_mountains"
        : "search_placeholder"
    );
  }
  if (requireSelection) return t("answer_placeholder_select");
  if (mode === "rivers_mountains") return t("search_placeholder_rivers_mountains");
  return t("answer_placeholder");
}

function HudHearts({ isHardcoreRun, livesLeft, livesShake, t }) {
  if (!isHardcoreRun || livesLeft === null) return null;
  return (
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
  );
}

function HudPlayStopButton({ isRunning, isMobile, t, onStop, onNavigateFocus }) {
  const iconProps = { width: isMobile ? 16 : 18, height: isMobile ? 16 : 18 };
  const style = isMobile
    ? { color: isRunning ? "var(--error)" : "var(--success)", width: "40px", height: "40px" }
    : { color: isRunning ? "var(--error)" : "var(--success)" };

  return (
    <IconButton
      label={t(isRunning ? "stop" : "play")}
      look="hud"
      style={style}
      onClick={isRunning ? onStop : () => onNavigateFocus("next")}
      onMouseDown={(e) => e.preventDefault()}
    >
      {isRunning ? <Square {...iconProps} /> : <Play {...iconProps} />}
    </IconButton>
  );
}

function HudHomeButton({ isMobile, onGoHome, t }) {
  if (isMobile) {
    return (
      <IconButton
        label={t("home")}
        look="hud"
        onClick={onGoHome}
        onMouseDown={(e) => e.preventDefault()}
      >
        <Home width={18} height={18} />
      </IconButton>
    );
  }
  return (
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
  );
}

function DesktopIsland(p) {
  return (
    <Button
      variant="ghost"
      look="hud-island"
      onClick={p.onInfo}
      onMouseDown={(e) => e.preventDefault()}
      title={p.t("progress_title")}
    >
      <span className={`island-font ${p.isTimerLow ? "timer-low" : ""}`}>
        {formatTime(p.timeLeft)}
      </span>
      <span className="island-divider" />
      <span className="island-progress-wrap">
        <span className="progress-linear-container">
          <span className="progress-linear-fill" style={{ width: `${p.progressPercent}%` }} />
        </span>
      </span>
      <span className="island-divider" />
      <span className={`island-font ${p.scoreGlow ? "score-increased-flash" : ""}`}>
        <span className="island-font">
          {p.score}/{p.totalPossible}
        </span>
      </span>
    </Button>
  );
}

function MobileRightControls({ isLearn, learn, playStop, isTimerLow, timeLeft, onInfo, t }) {
  if (isLearn) {
    return (
      <IconButton
        label={t("data_table")}
        look="hud"
        className={learn.show ? "active" : ""}
        onClick={learn.toggle}
        onMouseDown={(e) => e.preventDefault()}
      >
        <InfoBox width={18} height={18} />
      </IconButton>
    );
  }
  return (
    <div className="hud-play-controls">
      {playStop}
      <Button
        variant="secondary"
        size="sm"
        className={`hud-mini-pill timer-pill ${isTimerLow ? "timer-low" : ""}`}
        onClick={onInfo}
        onMouseDown={(e) => e.preventDefault()}
        title={t("progress_title")}
      >
        <span className="mini-pill-val">{formatTime(timeLeft)}</span>
      </Button>
    </div>
  );
}

function TopHudBar(p) {
  const isLearn = p.mode === "learn";
  return (
    <div
      className={`top-hud-bar ${p.isMobile ? "mobile-layout" : "desktop-layout"} ${isLearn ? "learn-mode" : ""}`}
      style={p.topBarStyle}
    >
      <div className="hud-top-left">
        <HudHomeButton isMobile={p.isMobile} onGoHome={p.onGoHome} t={p.t} />
        {p.isMobile && !isLearn && (
          <Button
            variant="secondary"
            size="sm"
            className={`hud-mini-pill score-pill ${p.scoreGlow ? "score-increased-flash" : ""}`}
            onClick={p.onInfo}
            onMouseDown={(e) => e.preventDefault()}
            title={p.t("progress_title")}
          >
            <span className="mini-pill-val">{p.score}</span>
            <span className="mini-pill-sub">/{p.totalPossible}</span>
          </Button>
        )}
      </div>

      <div className="hud-top-center">
        {p.isMobile ? p.hearts : !isLearn && <DesktopIsland {...p} />}
      </div>

      <div className="hud-top-right">
        {p.isMobile ? (
          <MobileRightControls
            isLearn={isLearn}
            learn={p.learn}
            playStop={p.playStopMobile}
            isTimerLow={p.isTimerLow}
            timeLeft={p.timeLeft}
            onInfo={p.onInfo}
            t={p.t}
          />
        ) : (
          <>
            {p.hearts}
            {!isLearn && p.playStop}
          </>
        )}
      </div>
    </div>
  );
}

function HudNavButton({ direction, isFocusedCountry, mode, t, onNavigateFocus }) {
  if (!isFocusedCountry || mode === "learn") return null;
  const isNext = direction === "next";
  return (
    <IconButton
      label={t(isNext ? "next" : "previous")}
      look="hud"
      className={isNext ? "next-btn" : "prev-btn"}
      onClick={() => onNavigateFocus(direction)}
      onMouseDown={(e) => e.preventDefault()}
    >
      {isNext ? <ChevronRight width={18} height={18} /> : <ChevronLeft width={18} height={18} />}
    </IconButton>
  );
}

function getInputIslandClass(error, warning, success, rejected) {
  let c = "input-island";
  if (error) c += " error";
  if (warning) c += " warning";
  if (success) c += " success";
  if (rejected) c += " is-rejected";
  return c;
}

function BottomHudBar(p) {
  if (p.hide) return null;

  const isSmall = window.innerWidth < BREAKPOINTS.desktop;
  const bottomStyle = isSmall
    ? {
        position: "absolute",
        top: 0,
        left: "50%",
        transform: `translate3d(-50%, calc(${p.viewport.top + p.viewport.height - 24}px - env(safe-area-inset-bottom, 0px)), 0) translateY(-100%)`,
        bottom: "auto",
      }
    : {};

  return (
    <div
      className={`bottom-hud-container ${p.isKeyboardMode ? "keyboard-mode" : ""} ${p.mode === "learn" ? "learn-search-bar" : ""}`}
      style={bottomStyle}
    >
      {p.combobox.suggestions.length > 0 && p.combobox.inputProps["aria-expanded"] && (
        <AnswerSuggestionList
          id={p.combobox.inputProps["aria-controls"]}
          suggestions={p.combobox.suggestions}
          activeIndex={p.combobox.activeIndex}
          onSelect={p.combobox.choose}
          t={p.t}
        />
      )}

      <div className="bottom-hud-islands">
        <HudNavButton
          direction="prev"
          isFocusedCountry={p.nav.isFocusedCountry}
          mode={p.mode}
          t={p.t}
          onNavigateFocus={p.nav.onNavigateFocus}
        />

        <form
          autoComplete="off"
          data-form-type="other"
          onSubmit={(e) => e.preventDefault()}
          className={p.input.islandClass}
        >
          <TextField
            variant="bare"
            ref={p.input.ref}
            {...ANSWER_INPUT_PROPS}
            {...p.combobox.inputProps}
            id="q-resp-field"
            placeholder={shieldAutofillText(p.placeholderText)}
            className="input-field"
            aria-label={shieldAutofillText(p.t("quiz_answer"))}
          />
        </form>

        <HudNavButton
          direction="next"
          isFocusedCountry={p.nav.isFocusedCountry}
          mode={p.mode}
          t={p.t}
          onNavigateFocus={p.nav.onNavigateFocus}
        />
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {p.combobox.statusText}
      </div>
    </div>
  );
}

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

  const progressPercent = totalPossible ? Math.min((score / totalPossible) * 100, 100) : 0;

  const placeholderText = useMemo(
    () => resolvePlaceholderText({ mode, learnSubMode, requireSelection, t }),
    [mode, learnSubMode, requireSelection, t]
  );

  const isMobile = viewport.width < BREAKPOINTS.desktop;

  const hearts = (
    <HudHearts isHardcoreRun={isHardcoreRun} livesLeft={livesLeft} livesShake={livesShake} t={t} />
  );

  const topBarStyle = isMobile
    ? {
        top: 0,
        left: "50%",
        transform: `translate3d(-50%, calc(${viewport.top + 24}px + env(safe-area-inset-top, 0px)), 0)`,
      }
    : {};

  const isRunning = isPlaying && !isGameOver;
  const playStopButton = (
    <HudPlayStopButton
      isRunning={isRunning}
      isMobile={isMobile}
      t={t}
      onStop={onStop}
      onNavigateFocus={onNavigateFocus}
    />
  );

  const isTimerLow = timeLeft > 0 && timeLeft <= 30;
  const islandClass = getInputIslandClass(inputError, inputWarning, inputSuccess, isRejected);

  return (
    <>
      <TopHudBar
        isMobile={isMobile}
        mode={mode}
        onGoHome={onGoHome}
        scoreGlow={scoreGlow}
        onInfo={onInfo}
        score={score}
        totalPossible={totalPossible}
        hearts={hearts}
        learn={{ show: showLearnPanel, toggle: onToggleLearnPanel }}
        playStop={hideHudPlayStop ? null : playStopButton}
        playStopMobile={playStopButton}
        isTimerLow={isTimerLow}
        timeLeft={timeLeft}
        progressPercent={progressPercent}
        topBarStyle={topBarStyle}
        t={t}
      />

      {/* Desktop Only Info Button in Bottom Right */}
      {!isMobile && mode !== "learn" && (
        <div className="hud-bottom-right">
          <IconButton label={t("information")} look="hud" onClick={onInfo}>
            <InfoBox width={18} height={18} />
          </IconButton>
        </div>
      )}

      <BottomHudBar
        hide={hideLearnInput && mode === "learn"}
        mode={mode}
        isKeyboardMode={isKeyboardMode}
        viewport={viewport}
        combobox={{ suggestions, inputProps, activeIndex, choose, statusText }}
        t={t}
        nav={{ isFocusedCountry, onNavigateFocus }}
        input={{ ref: extInputRef, islandClass }}
        placeholderText={placeholderText}
      />
    </>
  );
};

export default React.memo(GameHUD);
