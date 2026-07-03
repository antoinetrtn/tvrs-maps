import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Globe,
  MapPin,
  InfoBox,
  Square,
  Close,
  ChevronLeft,
  ChevronRight,
  Home,
  Play,
  Waves,
  TreePine,
} from "pixelarticons/react";
import Logo from "./Logo";
import "./GameHUD.css";
import { getThemeRegionColor } from "./designSystem";
import { useTranslation } from "./i18n";
import { GAME_REGIONS, getRegionAbbr } from "./gameConfig";

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
  onClearFocus,
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
  learnToggles,
  onToggleLearn,
}) => {
  const {
    showCountryLabels: learnShowCountryLabels,
    showCapitals: learnShowCapitals,
    showRivers: learnShowRivers,
    showMountains: learnShowMountains,
  } = learnToggles || {};
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const t = useTranslation(lang);

  const normalizeString = (str) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-']/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  };

  const preNormalizedData = useMemo(() => {
    if (!countryDataMap) return {};
    const result = {};
    Object.entries(countryDataMap).forEach(([key, value]) => {
      if (!value) return;
      result[key] = {
        ...value,
        normalizedNameFr: normalizeString(
          value.name_fr || value.name_en || key,
        ),
        normalizedNameEn: normalizeString(value.name_en || key),
        normalizedCapitalFr: value.capital_fr
          ? normalizeString(value.capital_fr)
          : value.capital
            ? normalizeString(value.capital)
            : "",
        normalizedCapitalEn: value.capital
          ? normalizeString(value.capital)
          : "",
        normalizedAliases: (value.aliases || []).map((alias) =>
          normalizeString(alias),
        ),
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

    // Stricter trigger: at least 4 chars and must represent a significant part of the word
    if (val.length >= 4) {
      const normalizedInput = normalizeString(val);
      const newSuggestions = [];
      const keysToCheck =
        mode === "learn"
          ? Object.keys(preNormalizedData)
          : Object.keys(preNormalizedData).filter(
              (k) => !foundList.includes(k),
            );

      for (const adminKey of keysToCheck) {
        const mapped = preNormalizedData[adminKey];
        if (!mapped) continue;

        let normalizedNameToMatch =
          lang === "fr" ? mapped.normalizedNameFr : mapped.normalizedNameEn;
        let normalizedCapitalToMatch =
          lang === "fr"
            ? mapped.normalizedCapitalFr
            : mapped.normalizedCapitalEn;

        let nameDisplay =
          lang === "fr"
            ? mapped.name_fr || mapped.name_en || adminKey
            : mapped.name_en || adminKey;
        let capitalDisplay =
          lang === "fr" && mapped.capital_fr
            ? mapped.capital_fr
            : mapped.capital || null;

        // In learn mode, match both name and capital
        if (mode === "learn") {
          const matchName = normalizedNameToMatch.includes(normalizedInput);
          const matchCap =
            normalizedCapitalToMatch &&
            normalizedCapitalToMatch.includes(normalizedInput);

          // Suggestions should help with long/complex names
          if (matchName || matchCap) {
            const target = matchName ? nameDisplay : capitalDisplay;
            // Only suggest if input is long enough or target is complex (has spaces/hyphens)
            if (
              val.length >= 5 ||
              target.includes(" ") ||
              target.includes("-")
            ) {
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
          let targetNormalized =
            mode === "countries" ||
            mode === "departments" ||
            mode === "rivers_mountains"
              ? normalizedNameToMatch
              : normalizedCapitalToMatch;
          let targetDisplay =
            mode === "countries" ||
            mode === "departments" ||
            mode === "rivers_mountains"
              ? nameDisplay
              : capitalDisplay;

          if (
            targetNormalized &&
            targetNormalized.startsWith(normalizedInput)
          ) {
            const ratio = val.length / targetDisplay.length;
            const hasSeparator = val.includes(" ") || val.includes("-");
            const isTargetCompound =
              targetDisplay.includes(" ") || targetDisplay.includes("-");

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
                        ? mapped.name_fr || mapped.name_en || adminKey
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
    const colors = {};
    GAME_REGIONS.forEach((r) => {
      colors[r] = getThemeRegionColor(globeTheme, theme, r);
    });
    return colors;
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

  const progressPercent = totalPossible
    ? Math.min((score / totalPossible) * 100, 100)
    : 0;
  const isDepartmentsMode = mode === "departments";

  const placeholderText = useMemo(() => {
    if (mode === "learn") {
      return t("search_placeholder");
    }
    return t("answer_placeholder");
  }, [mode, t]);

  // Determine which continent to highlight
  const activeContinent = useMemo(() => {
    if (!selectedCountry || !countryDataMap) return null;
    return countryDataMap[selectedCountry]?.region;
  }, [selectedCountry, countryDataMap]);

  const gaugeRegions = isDepartmentsMode
    ? ["France"]
    : CONTINENT_ORDER.filter((region) => region !== "France");
  const getRegionColor = useCallback(
    (region) =>
      REGION_COLORS[region] ||
      (isDepartmentsMode ? "var(--accent)" : "var(--warning)"),
    [REGION_COLORS, isDepartmentsMode],
  );

  const isMobile = viewport.width < 1024;

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
                className="hud-btn-circular glass-panel"
                onClick={onGoHome}
                onPointerDown={(e) => e.preventDefault()}
                title={t("home")}
              >
                <Home width={18} height={18} />
              </button>
              {mode !== "learn" && (
                <div
                  className={`hud-mini-pill score-pill glass-panel ${scoreGlow ? "score-increased-flash" : ""}`}
                  style={{ marginLeft: "8px" }}
                >
                  <span className="mini-pill-val">{score}</span>
                  <span className="mini-pill-sub">/{totalPossible}</span>
                </div>
              )}
            </div>

            <div className="hud-top-center">
              {/* Center is empty on mobile for layout density */}
            </div>

            <div className="hud-top-right">
              {mode === "learn" ? (
                <div
                  className="learn-toggles-group glass-panel"
                  style={{
                    display: "flex",
                    gap: "4px",
                    padding: "2px",
                    borderRadius: "var(--radius-full)",
                  }}
                >
                  <button
                    className={`learn-toggle-btn ${learnShowCountryLabels ? "active" : ""}`}
                    onClick={() => onToggleLearn("showCountryLabels")}
                    onPointerDown={(e) => e.preventDefault()}
                    title={t("show_country_labels")}
                  >
                    <Globe width={16} height={16} />
                  </button>
                  <button
                    className={`learn-toggle-btn ${learnShowCapitals ? "active" : ""}`}
                    onClick={() => onToggleLearn("showCapitals")}
                    onPointerDown={(e) => e.preventDefault()}
                    title={t("show_capitals")}
                  >
                    <MapPin width={16} height={16} />
                  </button>
                  <button
                    className={`learn-toggle-btn ${learnShowRivers ? "active" : ""}`}
                    onClick={() => onToggleLearn("showRivers")}
                    onPointerDown={(e) => e.preventDefault()}
                    title={t("show_rivers")}
                  >
                    <Waves width={16} height={16} />
                  </button>
                  <button
                    className={`learn-toggle-btn ${learnShowMountains ? "active" : ""}`}
                    onClick={() => onToggleLearn("showMountains")}
                    onPointerDown={(e) => e.preventDefault()}
                    title={t("show_mountains")}
                  >
                    <TreePine width={16} height={16} />
                  </button>
                </div>
              ) : (
                <button
                  className={`hud-mini-pill timer-pill glass-panel ${mobileMenuOpen ? "active" : ""} ${timeLeft > 0 && timeLeft <= 30 ? "timer-low" : ""}`}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  onPointerDown={(e) => e.preventDefault()}
                  style={{ cursor: "pointer", pointerEvents: "auto" }}
                >
                  <span className="mini-pill-val">{formatTime(timeLeft)}</span>
                </button>
              )}
            </div>

            {/* Collapsible Mobile Menu Popover */}
            {mobileMenuOpen && mode !== "learn" && (
              <div
                className="mobile-dropdown-menu glass-panel animation-fade-in"
                style={{
                  position: "absolute",
                  top: "52px",
                  right: "0",
                  width: "280px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  zIndex: 1005,
                  pointerEvents: "auto",
                }}
              >
                <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                  {isPlaying && !isGameOver ? (
                    <button
                      className="dropdown-action-btn stop"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onStop();
                      }}
                      onPointerDown={(e) => e.preventDefault()}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        height: "44px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid var(--error)",
                        background: "transparent",
                        color: "var(--error)",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      <Square width={14} height={14} />
                      <span>{t("stop")}</span>
                    </button>
                  ) : (
                    <button
                      className="dropdown-action-btn play"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigateFocus("next");
                      }}
                      onPointerDown={(e) => e.preventDefault()}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        height: "44px",
                        borderRadius: "var(--radius-full)",
                        border: "none",
                        background: "var(--success)",
                        color: "var(--accent-contrast)",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      <Play width={14} height={14} />
                      <span>{t("play")}</span>
                    </button>
                  )}
                  <button
                    className="dropdown-action-btn info"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onInfo();
                    }}
                    onPointerDown={(e) => e.preventDefault()}
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      border: "1px solid var(--glass-border)",
                      background: "var(--glass-bg)",
                      color: "var(--text-main)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <InfoBox width={16} height={16} />
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>{t("progress")}</span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div
                    className="progress-linear-container"
                    style={{ height: "6px" }}
                  >
                    <div
                      className="progress-linear-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "10px",
                    marginTop: "4px",
                  }}
                >
                  {gaugeRegions.map((reg) => {
                    const isActive = activeContinent === reg;
                    const isFaded = activeContinent && activeContinent !== reg;
                    const color = getRegionColor(reg);
                    const pct =
                      (regionStats[reg]?.found / regionStats[reg]?.total) *
                        100 || 0;
                    const displayVal = getRegionAbbr(reg);
                    return (
                      <div
                        key={reg}
                        className={`gauge-item ${isActive ? "highlight" : ""} ${isFaded ? "faded" : ""}`}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div
                          className="circular-gauge"
                          style={{
                            "--pct": `${pct}%`,
                            "--color": color,
                            width: "32px",
                            height: "32px",
                            background: `conic-gradient(${color} ${pct}%, var(--glass-border) 0)`,
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              width: "24px",
                              height: "24px",
                              background: "var(--bg-color)",
                              borderRadius: "50%",
                              zIndex: 0,
                            }}
                          />
                          <span
                            className="gauge-val"
                            style={{ zIndex: 1, fontSize: "0.6rem" }}
                          >
                            {displayVal}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                          }}
                        >
                          {regionStats[reg]?.found}/{regionStats[reg]?.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          // === DESKTOP TOP HUD BAR ===
          <>
            <div className="hud-top-left">
              <div
                className="hud-logo-clickable"
                onClick={onGoHome}
                onPointerDown={(e) => e.preventDefault()}
                title={t("return_home")}
                style={{ pointerEvents: "auto", cursor: "pointer" }}
              >
                <Logo size="small" variant="hud" />
              </div>
            </div>

            <div className="hud-top-center">
              {mode !== "learn" && (
                <div
                  className="central-island-panel glass-panel"
                  onClick={onInfo}
                  onPointerDown={(e) => e.preventDefault()}
                >
                  <div className={`island-font ${timeLeft > 0 && timeLeft <= 30 ? "timer-low" : ""}`}>{formatTime(timeLeft)}</div>
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
                </div>
              )}
            </div>

            <div className="hud-top-right">
              {mode === "learn" ? (
                <div
                  className="learn-toggles-group glass-panel"
                  style={{
                    display: "flex",
                    gap: "4px",
                    padding: "3px",
                    borderRadius: "var(--radius-full)",
                  }}
                >
                  <button
                    className={`learn-toggle-btn ${learnShowCountryLabels ? "active" : ""}`}
                    onClick={() => onToggleLearn("showCountryLabels")}
                    onPointerDown={(e) => e.preventDefault()}
                    title={t("labels_pays")}
                  >
                    <Globe width={16} height={16} />
                  </button>
                  <button
                    className={`learn-toggle-btn ${learnShowCapitals ? "active" : ""}`}
                    onClick={() => onToggleLearn("showCapitals")}
                    onPointerDown={(e) => e.preventDefault()}
                    title={t("labels_capitales")}
                  >
                    <MapPin width={16} height={16} />
                  </button>
                  <button
                    className={`learn-toggle-btn ${learnShowRivers ? "active" : ""}`}
                    onClick={() => onToggleLearn("showRivers")}
                    onPointerDown={(e) => e.preventDefault()}
                    title={t("labels_rivieres")}
                  >
                    <Waves width={16} height={16} />
                  </button>
                  <button
                    className={`learn-toggle-btn ${learnShowMountains ? "active" : ""}`}
                    onClick={() => onToggleLearn("showMountains")}
                    onPointerDown={(e) => e.preventDefault()}
                    title={t("labels_montagnes")}
                  >
                    <TreePine width={16} height={16} />
                  </button>
                </div>
              ) : isPlaying && !isGameOver ? (
                <button
                  className="hud-btn-circular glass-panel"
                  style={{ color: "var(--error)" }}
                  onClick={onStop}
                  onPointerDown={(e) => e.preventDefault()}
                  title={t("stop")}
                >
                  <Square width={18} height={18} />
                </button>
              ) : (
                <button
                  className="hud-btn-circular glass-panel"
                  style={{ color: "var(--success)" }}
                  onClick={() => onNavigateFocus("next")}
                  onPointerDown={(e) => e.preventDefault()}
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
          <button
            className="hud-btn-circular glass-panel"
            onClick={onInfo}
            title={t("information")}
          >
            <InfoBox width={18} height={18} />
          </button>
        </div>
      )}

      {/* Focus Badge: Always visible if focused, even with keyboard */}
      {isFocusedCountry && (
        <div
          className="top-hud-container"
          style={{
            top: 0,
            left: 0,
            transform: `translate3d(${viewport.left}px, ${viewport.top + 24}px, 0)`,
          }}
        >
          <div
            className="top-hud-stack"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              width: "100%",
            }}
          >
            <div className="focus-info-card animation-fade-in">
              {isKeyboardMode && mode !== "learn" && (
                <div className={`focus-mini-pill ${scoreGlow ? "score-increased-flash" : ""}`}>
                  <span className="focus-mini-val">{score}</span>
                  <span className="focus-mini-sub">/{totalPossible}</span>
                </div>
              )}
              <div className="focus-label">
                <MapPin width={14} height={14} className="focus-icon" />
                <span className="focus-label-text">
                  {mode === "learn"
                    ? (lang === "fr"
                        ? countryDataMap[selectedCountry]?.name_fr
                        : countryDataMap[selectedCountry]?.name_en) ||
                      selectedCountry
                    : mode === "departments"
                      ? t("department_prefix", {
                          code:
                            countryDataMap[selectedCountry]?.code ||
                            selectedCountry,
                        })
                      : mode === "rivers_mountains"
                        ? countryDataMap[selectedCountry]?.type ===
                          "mountain_range"
                          ? t("guess_mountain_range")
                          : t("guess_river")
                        : mode === "countries"
                          ? t("guess_country")
                          : t("find_capital")}
                </span>
                <button
                  className="focus-close-btn"
                  onClick={onClearFocus}
                  onPointerDown={(e) => e.preventDefault()}
                >
                  <Close width={14} height={14} />
                </button>
              </div>
              {isKeyboardMode && mode !== "learn" && (
                <div className={`focus-mini-pill ${timeLeft > 0 && timeLeft <= 30 ? "timer-low" : ""}`}>
                  <span className="focus-mini-val">{formatTime(timeLeft)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className={`bottom-hud-container ${isKeyboardMode ? "keyboard-mode" : ""}`}
        style={
          window.innerWidth < 1024
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
                onPointerDown={(e) => {
                  e.preventDefault(); // STOPS BLUR
                  submitSuggestion(s.display);
                }}
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
              className="hud-btn-circular glass-panel prev-btn"
              onClick={() => onNavigateFocus("prev")}
              onPointerDown={(e) => e.preventDefault()}
              title={t("previous")}
            >
              <ChevronLeft width={18} height={18} />
            </button>
          )}

          <div
            className={`input-island glass-panel ${inputError ? "error" : ""} ${inputWarning ? "warning" : ""} ${inputSuccess ? "success" : ""}`}
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
              value={inputValue}
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
              className="hud-btn-circular glass-panel next-btn"
              onClick={() => onNavigateFocus("next")}
              onPointerDown={(e) => e.preventDefault()}
              title={t("next")}
            >
              <ChevronRight width={18} height={18} />
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default React.memo(GameHUD);
