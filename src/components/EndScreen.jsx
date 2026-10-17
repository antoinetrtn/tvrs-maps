import "./EndScreen.css";
import "./PassportStamp.css";

import { ChevronDown, ChevronUp, Trophy } from "pixelarticons/react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { getThemeRegionColor } from "../config/designSystem";
import { GAME_REGIONS } from "../config/gameConfig";
import { useTranslation } from "../config/i18n";
import { getLevelAndProgress } from "../utils/gamification";
import { getGameStats } from "../utils/utils";
import EndScreenContinents from "./EndScreenContinents";
import EndScreenTraining from "./EndScreenTraining";
import PixelFireworks from "./PixelFireworks";
import Button from "./ui/Button";
import XpBar from "./XpBar";
import XpOrbsAnimation from "./XpOrbsAnimation";

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
  xpResult = null,
  livesLeft = null,
  isHardcoreRun = false,
  isTraining = false,
  trainingMode = "countries",
  trainingReviewKeys = [],
}) => {
  const dataMap = activeDataMap || countryDataMap;
  const t = useTranslation(lang);

  // Minimized: the summary collapses to a floating chip so the player can
  // freely explore their hits/misses on the globe (crucial on mobile, where
  // the full end screen captures every pointer event).
  const [minimized, setMinimized] = useState(false);

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
    if (isTraining) return t("training_end_title");
    if (isHardcoreRun && livesLeft === 0) return t("hardcore_game_over");
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

  if (minimized) {
    return (
      <div className={`end-screen-overlay minimized ${theme}`}>
        <button
          type="button"
          className="end-screen-restore-chip glass-panel"
          onClick={() => setMinimized(false)}
          title={t("back_to_results")}
        >
          <ChevronUp width={16} height={16} />
          <span className="restore-chip-score">
            {foundList.length}/{totalCountries}
          </span>
          <span className="restore-chip-label">{t("back_to_results")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`end-screen-overlay ${isPerfectScore ? "perfect-game" : ""} ${theme}`}>
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
      {isPerfectScore && <PixelFireworks duration={8000} />}

      <div className="end-screen-content scrollbar-styled">
        <div className="end-screen-header journal-header">
          <p className="journal-kicker">
            {t("travel_journal")} ·{" "}
            {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h1>{getTitle()}</h1>
          {isTraining && <p className="training-end-note">{t("training_end_note")}</p>}
          <div className="journal-stamps">
            <div className="passport-stamp score-stamp" aria-label={t("stamp_explored")}>
              <span className="stamp-caption">{t("stamp_explored")}</span>
              <span className="stamp-value">
                {totalCountries > 0 ? Math.round((foundList.length / totalCountries) * 100) : 0}%
              </span>
              <span className="stamp-caption">
                {foundList.length}/{totalCountries}
              </span>
            </div>
            {!isTraining && isNewPB && (
              <div className="passport-stamp new-pb-badge">
                <Trophy width={14} height={14} />
                <span>{t("new_pb")}</span>
              </div>
            )}
          </div>
        </div>

        <div className="end-screen-spacer">
          {/* This space is for the globe which is rendered behind */}
        </div>

        {isTraining ? (
          <EndScreenTraining
            trainingMode={trainingMode}
            trainingReviewKeys={trainingReviewKeys}
            lang={lang}
            t={t}
          />
        ) : (
          <EndScreenContinents
            stats={stats}
            order={CONTINENT_ORDER}
            colors={colors}
            foundCount={foundList.length}
            total={totalCountries}
            onViewTable={onViewTable}
            containerRef={orbsSourceRef}
            t={t}
          />
        )}

        {/* Gamification Progress Display */}
        {!isTraining && xpResult && (
          <div
            className={`end-screen-xp-card glass-panel ${showLevelUp ? "level-up-shake" : ""}`}
            ref={orbsTargetRef}
          >
            <div className="xp-card-header">
              <span className="xp-level-title">{t("level", { level: animatedLevel })}</span>
              <span className="xp-gain-badge">+{gainedXp} XP</span>
            </div>
            <XpBar percent={percent} label={t("level", { level: animatedLevel })} />
            {showLevelUp && (
              <div className="end-screen-level-up-banner text-natural-case">{t("level_up")}</div>
            )}
          </div>
        )}

        {!isTraining && lastScores && lastScores.length > 0 && (
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
          <Button variant="secondary" onClick={() => setMinimized(true)}>
            <ChevronDown width={16} height={16} />
            {t("explore_globe")}
          </Button>
          <Button variant="primary" onClick={onRestart}>
            {t("home")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(EndScreen);
