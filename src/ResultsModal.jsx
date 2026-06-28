import React, { useMemo } from "react";
import { Close } from "pixelarticons/react";
import "./ResultsModal.css";
import { getGameStats } from "./utils";
import { getThemeRegionColor, scrambleText } from "./designSystem";
import { useTranslation } from "./i18n";
import { GAME_REGIONS } from "./gameConfig";

const getMaskText = (str) => scrambleText(str);

const ResultsModal = ({
  foundList,
  totalCountries,
  countryDataMap,
  activeDataMap,
  onRestart,
  onClose,
  isGameOver,
  onStop,
  isPlaying,
  mode,
  theme = "dark",
  lang = "fr",
  globeTheme = "satellite",
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

  return (
    <div className="modal-overlay">
      <div className={`modal-content ${isGameOver ? "is-game-over" : ""}`}>
        <header className="modal-header">
          <div className="header-left">
            <div className="score-title">
              <span className="header-font">
                {isGameOver ? t("game_over") : t("progress_title")}
              </span>
              <span className="score-font">
                {foundList.length}/{totalCountries}
              </span>
            </div>
          </div>
          <div className="header-right">
            {onClose && (
              <button
                className="close-popup"
                onClick={onClose}
                aria-label={t("close")}
              >
                <Close width={18} height={18} />
              </button>
            )}
          </div>
        </header>

        <div className="continents-grid">
          {CONTINENT_ORDER.map((region) => {
            const data = stats[region];
            if (!data || data.total === 0) return null;

            const pct = Math.round((data.found / data.total) * 100);
            const color = colors[region] || "var(--accent)";
            const regionLabel = t(`region_${region}`) || region;

            return (
              <section
                key={region}
                className="continent-row"
                style={{ "--continent-color": color }}
              >
                <div className="continent-head">
                  <div className="continent-title">
                    <span className="continent-dot" />
                    <h3>{regionLabel}</h3>
                  </div>
                  <div className="continent-stats">
                    <div
                      className="continent-progress"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="continent-progress-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="continent-count">{data.found}/{data.total}</span>
                  </div>
                </div>

                <div className="countries-pill-grid">
                  {data.countries.map((c) => {
                    const label = mode === "capitals" ? c.capital : c.name;
                    const isRevealed = c.found || isGameOver;
                    const displayLabel = isRevealed
                      ? label
                      : getMaskText(label || "");
                    return (
                      <div
                        key={c.key}
                        className={`country-pill ${c.found ? "found" : "missed"}`}
                        title={isRevealed ? label : t("unrevealed_placeholder")}
                      >
                        {displayLabel}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ResultsModal);
