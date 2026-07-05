import React, { useMemo } from "react";
import { InfoBox, Trophy } from "pixelarticons/react";
import "./EndScreen.css";
import { getGameStats } from "./utils";
import { getThemeRegionColor } from "./designSystem";
import { useTranslation } from "./i18n";
import { GAME_REGIONS } from "./gameConfig";

const EndScreen = ({
  foundList,
  totalCountries,
  countryDataMap,
  activeDataMap,
  mode,
  onRestart,
  onViewTable,
  theme = "dark",
  lang = "fr",
  globeTheme = "satellite",
  lastScores = [],
  maxScore = 0,
  isNewPB = false,
}) => {
  const dataMap = activeDataMap || countryDataMap;
  const t = useTranslation(lang);
  const { stats, CONTINENT_ORDER } = useMemo(
    () => getGameStats(foundList, dataMap, lang),
    [foundList, dataMap, lang],
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

  return (
    <div
      className={`end-screen-overlay ${isPerfectScore ? "perfect-game" : ""}`}
    >
      <div className="end-screen-content">
        <div className="end-screen-header">
          <h1>{getTitle()}</h1>
        </div>

        <div className="end-screen-spacer">
          {/* This space is for the globe which is rendered behind */}
        </div>

        <div
          className="continents-progress-bars"
          onClick={onViewTable}
          title={t("view_table")}
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
              (reg) => reg !== "Unknown" && stats[reg].total > 0,
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

        {isNewPB && (
          <div className="new-pb-banner">
            <span>{t("new_pb")}</span>
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
