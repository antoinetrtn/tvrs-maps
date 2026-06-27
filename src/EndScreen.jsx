import React, { useMemo } from "react";
import "./EndScreen.css";
import { getGameStats } from "./utils";
import { getThemeRegionColor } from "./designSystem";
import { useTranslation } from "./i18n";

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
  globeTheme = "glass",
}) => {
  const dataMap = activeDataMap || countryDataMap;
  const t = useTranslation(lang);
  const { stats, CONTINENT_ORDER } = useMemo(
    () => getGameStats(foundList, dataMap, lang),
    [foundList, dataMap, lang],
  );

  const colors = useMemo(() => {
    const res = {};
    const regions = [
      "Europe",
      "Americas",
      "Asia",
      "Africa",
      "Oceania",
      "Antarctic",
      "France",
      "Unknown",
    ];
    regions.forEach((r) => {
      res[r] = getThemeRegionColor(globeTheme, theme, r);
    });
    return res;
  }, [globeTheme, theme]);
  const isPerfectScore = foundList.length === totalCountries;

  const getTitle = () => {
    if (isPerfectScore) return t("incredible");
    return t("well_done");
  };

  const getSubTitle = () => {
    if (isPerfectScore && mode === "departments") return t("mastered_france");
    if (isPerfectScore) return t("conquered_world");
    return t("you_found");
  };

  return (
    <div
      className={`end-screen-overlay ${isPerfectScore ? "perfect-game" : ""}`}
    >
      <div className="end-screen-content">
        <div className="end-screen-header">
          <h1>{getTitle()}</h1>
          <p>
            {getSubTitle()}
            <span className="final-score">
              {" "}
              {foundList.length} / {totalCountries}
            </span>
          </p>
        </div>

        <div className="end-screen-spacer">
          {/* This space is for the globe which is rendered behind */}
        </div>

        <div className="continents-progress-bars">
          {CONTINENT_ORDER.filter(
            (reg) => reg !== "Unknown" && stats[reg].total > 0,
          ).map((region) => {
            const data = stats[region];
            const pct = (data.found / data.total) * 100;
            const color = colors[region] || "var(--accent)";
            const label = t(`region_${region}`) || region;

            return (
              <div key={region} className="progress-item">
                <div className="progress-info">
                  <span className="progress-label">{label}</span>
                  <span className="progress-count">
                    {data.found}/{data.total}
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="end-screen-actions">
          <button className="btn-secondary" onClick={onViewTable}>
            {t("view_table")}
          </button>
          <button className="btn-primary" onClick={onRestart}>
            {t("play_again")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(EndScreen);
