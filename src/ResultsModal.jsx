import React, { useMemo } from "react";
import { Close } from "pixelarticons/react";
import "./ResultsModal.css";
import { getThemeRegionColor } from "./designSystem";
import { getGameStats, scrambleText } from "./utils";
import { useTranslation } from "./i18n";
import { GAME_REGIONS } from "./gameConfig";

const getMaskText = (str) => scrambleText(str);

const ResultsModal = ({
  foundList,
  totalCountries,
  countryDataMap,
  activeDataMap,
  onClose,
  isGameOver,
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
    <div className={`fullpage-panel ${theme} ${isGameOver ? "is-game-over" : ""}`}>
      <header className="panel-header">
        <div className="header-left" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="score-title" style={{ display: "flex", alignItems: "baseline", gap: "var(--spacing-sm)" }}>
            <span className="panel-title" style={{ fontVariantNumeric: "tabular-nums" }}>
              {isGameOver ? t("game_over") : t("progress_title")}
            </span>
            <span className="score-font" style={{ fontSize: "1.2rem", color: "var(--text-muted)", fontWeight: 300 }}>
              ({foundList.length}/{totalCountries})
            </span>
          </div>
        </div>
        {onClose && (
          <button
            className="panel-close-btn"
            onClick={onClose}
            aria-label={t("close")}
          >
            <Close width={20} height={20} />
          </button>
        )}
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
  );
};

export default React.memo(ResultsModal);
