import React, { useMemo, useState, useEffect, useRef } from "react";
import { InfoBox, Trophy } from "pixelarticons/react";
import XpOrbsAnimation from "./XpOrbsAnimation";
import { getLevelAndProgress } from "../utils/gamification";
import { getThemeRegionColor } from "../config/designSystem";
import { useTranslation } from "../config/i18n";
import { GAME_REGIONS } from "../config/gameConfig";
import { getGameStats } from "../utils/utils";
import PixelFireworks from "./PixelFireworks";
import "./EndScreen.css";

const EndScreen = ({
  foundList,
  totalCountries,
  countryDataMap,
  activeDataMap,
  onRestart,
  onViewTable,
  theme = "dark",
  lang = "fr",
  globeTheme = "satellite",
  lastScores = [],
  maxScore = 0,
  isNewPB = false,
  xpResult = null
}) => {
  const dataMap = activeDataMap || countryDataMap;
  const t = useTranslation(lang);
  
  const orbsSourceRef = useRef(null);
  const orbsTargetRef = useRef(null);

  const { stats, CONTINENT_ORDER } = useMemo(
    () => getGameStats(foundList, dataMap, lang),
    [foundList, dataMap, lang]
  );

  const colors = useMemo(() => {
    const res = {};
    GAME_REGIONS.forEach((r) => {
      res[r] = getThemeRegionColor(globeTheme, theme, r);
    });
    return res;
  }, [globeTheme, theme]);

  const isPerfectScore = foundList.length === totalCountries;

  const getTitle = () => {
    if (isPerfectScore) return t("incredible");
    return t("well_done");
  };

  // Gamification states
  const oldXp = xpResult?.oldXp || 0;
  const oldLevel = xpResult?.oldLevel || 1;
  const gainedXp = xpResult?.gainedXp || 0;

  const [animatedTotalGained, setAnimatedTotalGained] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [, setAnimatingOrbs] = useState(true);

  // Compute animated progression
  const currentAnimatedXp = oldXp + animatedTotalGained;
  const { level: animatedLevel, percent } = getLevelAndProgress(currentAnimatedXp);

  // Detect Level Up during orbs collection
  useEffect(() => {
    if (animatedLevel > oldLevel) {
      setShowLevelUp(true);
    }
  }, [animatedLevel, oldLevel]);

  const handleOrbCollect = () => {
    setAnimatedTotalGained((prev) => {
      const step = Math.ceil(gainedXp / 15);
      return Math.min(gainedXp, prev + step);
    });
  };

  const handleAnimationComplete = () => {
    setAnimatedTotalGained(gainedXp);
    setAnimatingOrbs(false);
  };

  return (
    <div
      className={`end-screen-overlay ${isPerfectScore ? "perfect-game" : ""} ${theme}`}
    >
      {/* XP Orbs Particle Component */}
      {xpResult && gainedXp > 0 && (
        <XpOrbsAnimation
          sourceRef={orbsSourceRef}
          targetRef={orbsTargetRef}
          onOrbCollect={handleOrbCollect}
          onComplete={handleAnimationComplete}
          count={15}
          active={true}
        />
      )}

      {/* Retro fireworks on Level Up or Personal Best */}
      {(isNewPB || showLevelUp) && <PixelFireworks duration={8000} />}

      <div className="end-screen-content scrollbar-styled">
        <div className="end-screen-header">
          <h1>{getTitle()}</h1>
          {isNewPB && (
            <div className="new-pb-badge">
              <span>★ {t("new_pb")} ★</span>
            </div>
          )}
        </div>

        <div className="end-screen-spacer">
          {/* This space is for the globe which is rendered behind */}
        </div>

        <div
          className="continents-progress-bars"
          onClick={onViewTable}
          title={t("view_table")}
          ref={orbsSourceRef}
        >
          <div className="progress-bars-header">
            <span className="final-score-inline">
              {foundList.length} / {totalCountries}
            </span>
            <span className="progress-info-icon">
              <InfoBox width={18} height={18} />
            </span>
          </div>

          <div className="progress-bars-grid">
            {CONTINENT_ORDER.filter(
              (reg) => reg !== "Unknown" && stats[reg].total > 0
            ).map((region) => {
              const data = stats[region];
              const pct = Math.round((data.found / data.total) * 100);
              const color = colors[region] || "var(--accent)";
              const label = t(`region_${region}`) || region;

              return (
                <div
                  key={region}
                  className="progress-item"
                  style={{ "--continent-color": color }}
                >
                  <div className="progress-info">
                    <div className="progress-title">
                      <span className="progress-dot" />
                      <span className="progress-label">{label}</span>
                    </div>
                    <div className="progress-stats">
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="progress-count">
                        {data.found}/{data.total}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gamification Progress Display */}
        {xpResult && (
          <div
            className={`end-screen-xp-card glass-panel ${showLevelUp ? "level-up-shake" : ""}`}
            ref={orbsTargetRef}
          >
            <div className="xp-card-header">
              <span className="xp-level-title">{t("level", { level: animatedLevel })}</span>
              <span className="xp-gain-badge">+{gainedXp} XP</span>
            </div>
            <div className="minecraft-xp-bar-container">
              <div className="minecraft-xp-bar-fill" style={{ width: `${percent}%` }} />
            </div>
            {showLevelUp && (
              <div className="end-screen-level-up-banner text-natural-case">
                {t("level_up")}
              </div>
            )}
          </div>
        )}



        {lastScores && lastScores.length > 0 && (
          <div className="end-screen-history glass-panel">
            <h3 className="history-title text-natural-case">{t("last_scores")}</h3>
            <div className="history-scores-row">
              {lastScores.map((hScore, idx) => {
                let trophyColor = "var(--text-muted)";
                let trophyClass = "trophy-grey";
                if (maxScore > 0) {
                  if (hScore >= maxScore) {
                    trophyColor = "var(--color-gold)";
                    trophyClass = "trophy-gold";
                  } else if (hScore >= maxScore * 0.7) {
                    trophyColor = "var(--color-silver)";
                    trophyClass = "trophy-silver";
                  } else if (hScore >= maxScore * 0.4) {
                    trophyColor = "var(--color-bronze)";
                    trophyClass = "trophy-bronze";
                  }
                } else if (hScore > 0) {
                  trophyColor = "var(--color-gold)";
                  trophyClass = "trophy-gold";
                }

                return (
                  <div key={idx} className="history-score-item">
                    <Trophy
                      width={18}
                      height={18}
                      className={`trophy-icon ${trophyClass}`}
                      style={{ color: trophyColor }}
                    />
                    <span className="history-score-value">{hScore}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="end-screen-actions">
          <button className="btn-primary" onClick={onRestart}>
            {t("home")}
          </button>
        </div>
      </div>
    </div>
  );
};



export default React.memo(EndScreen);
