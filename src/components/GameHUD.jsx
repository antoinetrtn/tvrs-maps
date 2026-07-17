import "./GameHUD.css";

import { ChevronLeft, ChevronRight, Heart, Home, InfoBox, Play, Square } from "pixelarticons/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getThemeRegionColor } from "../config/designSystem";
import { GAME_REGIONS, getRegionAbbr } from "../config/gameConfig";
import { BREAKPOINTS, HARDCORE_LIVES } from "../config/gameConstants";
import { useTranslation } from "../config/i18n";
import { normalizeString } from "../utils/utils";
import Logo from "./Logo";

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
  theme,
  viewport,
  isKeyboardMode,
  selectedCountry,
  globeTheme,
  learnSearchQuery = "",
  onLearnSearchChange,
  onToggleLearnPanel,
  showLearnPanel,
  hideLearnInput = false,
  hideHudPlayStop = false,
  livesLeft = null,
  isHardcoreRun = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
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

  const t = useTranslation(lang);

  const preNormalizedData = useMemo(() => {
    if (!countryDataMap) return {};
    const result = {};
    Object.entries(countryDataMap).forEach(([key, value]) => {
      if (!value) return;
      result[key] = {
        ...value,
        normalizedNameFr: normalizeString(value.name_fr || value.name_en || key),
        normalizedNameEn: normalizeString(value.name_en || key),
        normalizedCapitalFr: value.capital_fr
          ? normalizeString(value.capital_fr)
          : value.capital
            ? normalizeString(value.capital)
            : "",
        normalizedCapitalEn: value.capital ? normalizeString(value.capital) : "",
        normalizedAliases: (value.aliases || []).map((alias) => normalizeString(alias)),
      };
    });
    return result;
  }, [countryDataMap]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (mode === "learn" && onLearnSearchChange) {
      onLearnSearchChange(val);
    }

    // Stricter trigger: at least 4 chars and must represent a significant part of the word
    if (val.length >= 4) {
      const normalizedInput = normalizeString(val);
      const newSuggestions = [];
      const keysToCheck =
        mode === "learn"
          ? Object.keys(preNormalizedData)
          : Object.keys(preNormalizedData).filter((k) => !foundList.includes(k));

      for (const adminKey of keysToCheck) {
        const mapped = preNormalizedData[adminKey];
        if (!mapped) continue;

        const normalizedNameToMatch =
          lang === "fr" ? mapped.normalizedNameFr : mapped.normalizedNameEn;
        const normalizedCapitalToMatch =
          lang === "fr" ? mapped.normalizedCapitalFr : mapped.normalizedCapitalEn;

        const nameDisplay =
          lang === "fr" ? mapped.name_fr || mapped.name_en || adminKey : mapped.name_en || adminKey;
        const capitalDisplay =
          lang === "fr" && mapped.capital_fr ? mapped.capital_fr : mapped.capital || null;

        // In learn mode, match both name and capital
        if (mode === "learn") {
          const matchName = normalizedNameToMatch.includes(normalizedInput);
          const matchCap =
            normalizedCapitalToMatch && normalizedCapitalToMatch.includes(normalizedInput);

          // Suggestions should help with long/complex names
          if (matchName || matchCap) {
            const target = matchName ? nameDisplay : capitalDisplay;
            // Only suggest if input is long enough or target is complex (has spaces/hyphens)
            if (val.length >= 5 || target.includes(" ") || target.includes("-")) {
              newSuggestions.push({
                key: adminKey,
                display: target,
                subtext: matchName
                  ? mapped.capital_fr || mapped.capital
                  : mapped.name_fr || mapped.name_en || adminKey,
              });
            }
          }
        } else {
          const targetNormalized =
            mode === "countries" || mode === "departments" || mode === "rivers_mountains"
              ? normalizedNameToMatch
              : normalizedCapitalToMatch;
          const targetDisplay =
            mode === "countries" || mode === "departments" || mode === "rivers_mountains"
              ? nameDisplay
              : capitalDisplay;

          if (targetNormalized && targetNormalized.startsWith(normalizedInput)) {
            const ratio = val.length / targetDisplay.length;
            const hasSeparator = val.includes(" ") || val.includes("-");
            const isTargetCompound = targetDisplay.includes(" ") || targetDisplay.includes("-");

            // Logic for game mode:
            // 1. If single word: must be at least 80% finished (e.g. "Franc" -> "France")
            // 2. If compound: must have a separator AND started the second word (e.g. "Sainte-H" -> "Sainte-Hélène")
            const parts = val.split(/[ -]/).filter((s) => s.length > 0);
            const isSignificantCompoundMatch =
              isTargetCompound && hasSeparator && parts.length >= 2;
            const isAlmostFinishedSingle = !isTargetCompound && ratio >= 0.8;

            if (isAlmostFinishedSingle || isSignificantCompoundMatch) {
              newSuggestions.push({
                key: adminKey,
                display: targetDisplay,
                subtext:
                  mode === "departments"
                    ? mapped.code
                    : mode === "rivers_mountains"
                      ? mapped.type === "mountain_range"
                        ? `${mapped.height}m`
                        : `${mapped.length}km`
                      : mode === "capitals"
                        ? null
                        : mapped?.capital_fr || mapped?.capital,
              });
            }
          }
        }
      }
      setSuggestions(newSuggestions.slice(0, 5));
    } else setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if ((e.key === "Tab" || e.key === "Enter") && suggestions.length > 0) {
      e.preventDefault();
      submitSuggestion(suggestions[0].display);
    } else if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      if (onEnter(inputValue)) {
        setInputValue("");
        setSuggestions([]);
      }
    }
  };

  const submitSuggestion = (match) => {
    if (onEnter && onEnter(match)) {
      setInputValue("");
      setSuggestions([]);
      if (extInputRef.current) extInputRef.current.focus();
    }
  };

  const CONTINENT_ORDER = GAME_REGIONS.filter((r) => r !== "Unknown");
  const REGION_COLORS = useMemo(() => {
    return GAME_REGIONS.reduce(
      (acc, r) => ({ ...acc, [r]: getThemeRegionColor(globeTheme, theme, r) }),
      {}
    );
  }, [globeTheme, theme]);
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
      return t("search_placeholder");
    }
    return t("answer_placeholder");
  }, [mode, t]);

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
          <Heart
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
              <button
                className="hud-btn-circular"
                onClick={onGoHome}
                onMouseDown={(e) => e.preventDefault()}
                title={t("home")}
              >
                <Home width={18} height={18} />
              </button>
              {mode !== "learn" && (
                <button
                  className={`hud-mini-pill score-pill ${scoreGlow ? "score-increased-flash" : ""}`}
                  onClick={onInfo}
                  onMouseDown={(e) => e.preventDefault()}
                  title={t("progress_title")}
                >
                  <span className="mini-pill-val">{score}</span>
                  <span className="mini-pill-sub">/{totalPossible}</span>
                </button>
              )}
            </div>

            <div className="hud-top-center">{heartsRow}</div>

            <div className="hud-top-right">
              {mode === "learn" ? (
                <button
                  className={`hud-btn-circular ${showLearnPanel ? "active" : ""}`}
                  onClick={onToggleLearnPanel}
                  onMouseDown={(e) => e.preventDefault()}
                  title={t("data_table")}
                >
                  <InfoBox width={18} height={18} />
                </button>
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
                    <button
                      className="hud-btn-circular"
                      style={{ color: "var(--error)", width: "40px", height: "40px" }}
                      onClick={onStop}
                      onMouseDown={(e) => e.preventDefault()}
                      title={t("stop")}
                    >
                      <Square width={16} height={16} />
                    </button>
                  ) : (
                    <button
                      className="hud-btn-circular"
                      style={{ color: "var(--success)", width: "40px", height: "40px" }}
                      onClick={() => onNavigateFocus("next")}
                      onMouseDown={(e) => e.preventDefault()}
                      title={t("play")}
                    >
                      <Play width={16} height={16} />
                    </button>
                  )}
                  <button
                    className={`hud-mini-pill timer-pill ${timeLeft > 0 && timeLeft <= 30 ? "timer-low" : ""}`}
                    onClick={onInfo}
                    onMouseDown={(e) => e.preventDefault()}
                    title={t("progress_title")}
                  >
                    <span className="mini-pill-val">{formatTime(timeLeft)}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          // === DESKTOP TOP HUD BAR ===
          <>
            <div className="hud-top-left">
              <div
                className="hud-logo-clickable"
                onClick={onGoHome}
                onMouseDown={(e) => e.preventDefault()}
                title={t("return_home")}
                style={{ pointerEvents: "auto", cursor: "pointer" }}
              >
                <Logo size="small" variant="hud" />
              </div>
            </div>

            <div className="hud-top-center">
              {mode !== "learn" && (
                <div
                  className="central-island-panel"
                  onClick={onInfo}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div
                    className={`island-font ${timeLeft > 0 && timeLeft <= 30 ? "timer-low" : ""}`}
                  >
                    {formatTime(timeLeft)}
                  </div>
                  <div className="island-divider" />
                  <div className="island-progress-wrap">
                    <div className="progress-linear-container">
                      <div
                        className="progress-linear-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="island-divider" />
                  <div className={`island-font ${scoreGlow ? "score-increased-flash" : ""}`}>
                    <span className="island-font">
                      {score}/{totalPossible}
                    </span>
                  </div>
                  {heartsRow && (
                    <>
                      <div className="island-divider" />
                      {heartsRow}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="hud-top-right">
              {mode === "learn" ? null : hideHudPlayStop ? null : isPlaying && !isGameOver ? (
                <button
                  className="hud-btn-circular"
                  style={{ color: "var(--error)" }}
                  onClick={onStop}
                  onMouseDown={(e) => e.preventDefault()}
                  title={t("stop")}
                >
                  <Square width={18} height={18} />
                </button>
              ) : (
                <button
                  className="hud-btn-circular"
                  style={{ color: "var(--success)" }}
                  onClick={() => onNavigateFocus("next")}
                  onMouseDown={(e) => e.preventDefault()}
                  title={t("play")}
                >
                  <Play width={18} height={18} />
                </button>
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
          <button className="hud-btn-circular" onClick={onInfo} title={t("information")}>
            <InfoBox width={18} height={18} />
          </button>
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
          {suggestions.length > 0 && (
            <div className="suggestions-list animation-fade-in">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  className="suggestion-item"
                  onMouseDown={(e) => {
                    e.preventDefault(); // STOPS BLUR
                  }}
                  onClick={() => submitSuggestion(s.display)}
                  type="button"
                >
                  <span className="sug-text">{s.display}</span>
                  {s.subtext && <small className="sug-sub">({s.subtext})</small>}
                </button>
              ))}
            </div>
          )}

          <div className="bottom-hud-islands">
            {isFocusedCountry && mode !== "learn" && (
              <button
                className="hud-btn-circular prev-btn"
                onClick={() => onNavigateFocus("prev")}
                onMouseDown={(e) => e.preventDefault()}
                title={t("previous")}
              >
                <ChevronLeft width={18} height={18} />
              </button>
            )}

            <div
              className={`input-island ${inputError ? "error" : ""} ${inputWarning ? "warning" : ""} ${inputSuccess ? "success" : ""}`}
            >
              <input
                ref={extInputRef}
                type="search"
                name="q-resp"
                id="q-resp-field"
                inputMode="text"
                enterKeyHint="done"
                placeholder={placeholderText}
                className="input-field"
                value={
                  mode === "learn" && learnSearchQuery !== undefined ? learnSearchQuery : inputValue
                }
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                aria-label={t("quiz_answer")}
              />
            </div>

            {isFocusedCountry && mode !== "learn" && (
              <button
                className="hud-btn-circular next-btn"
                onClick={() => onNavigateFocus("next")}
                onMouseDown={(e) => e.preventDefault()}
                title={t("next")}
              >
                <ChevronRight width={18} height={18} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(GameHUD);
