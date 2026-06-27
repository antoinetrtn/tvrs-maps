import React, { useMemo } from "react";
import { Close } from "pixelarticons/react";
import "./ResultsModal.css";
import { getGameStats } from "./utils";
import { getThemeRegionColor } from "./designSystem";
import { useTranslation } from "./i18n";
import { GAME_REGIONS } from "./gameConfig";

// Fixed-width neutral placeholder for not-yet-found entries (no noisy glitch animation)
const getMaskText = (str) => "·".repeat(Math.max(3, Math.min(str.length, 7)));

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
                  <span className="continent-count">
                    <span className="cc-found">{data.found}</span>
                    <span className="cc-sep">/</span>
                    <span className="cc-total">{data.total}</span>
                  </span>
                </div>

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
                        title={isRevealed ? label : "???"}
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

        <div className="modal-footer">
          <div className="modal-actions">
            {isPlaying && !isGameOver && (
              <button
                className="stop-btn"
                onClick={() => {
                  if (onStop) onStop();
                  if (onClose) onClose();
                }}
              >
                {t("stop_game")}
              </button>
            )}
            <button className="restart-btn" onClick={onRestart}>
              {isGameOver ? t("home") : t("continue")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ResultsModal);
