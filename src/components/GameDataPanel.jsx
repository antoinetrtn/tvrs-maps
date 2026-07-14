import React, { useMemo, useState, useCallback } from "react";
import { Close, Home } from "pixelarticons/react";
import { getThemeRegionColor } from "../config/designSystem";
import { getPanelData, normalizeString, buildLearnExtraEntries } from "../utils/utils";
import { useTranslation } from "../config/i18n";
import { GAME_REGIONS } from "../config/gameConfig";
import GameDataPanelRow from "./GameDataPanelRow";
import LearnModeToggles from "./LearnModeToggles";
import "./GameDataPanel.css";

const GameDataPanel = ({
  dataMap,
  foundList = [],
  selectedCountry,
  onSelectCountry,
  onClose,
  onGoHome,
  mode,
  theme = "dark",
  lang = "fr",
  globeTheme = "satellite",
  isGameOver = false,
  revealAll = false,
  variant = "side",
  title,
  score,
  total,
  extraEntries: extraEntriesProp,
  searchQuery: controlledSearch,
  onSearchChange,
  showSearch = true,
  isLearnMode = false,
  learnToggles,
  onToggleLearn,
}) => {
  const t = useTranslation(lang);
  const [localSearch, setLocalSearch] = useState("");
  const searchQuery = controlledSearch ?? localSearch;
  const setSearchQuery = onSearchChange ?? setLocalSearch;

  const colors = useMemo(() => {
    const res = {};
    GAME_REGIONS.forEach((r) => {
      res[r] = getThemeRegionColor(globeTheme, theme, r);
    });
    return res;
  }, [globeTheme, theme]);

  const learnExtraEntries = useMemo(
    () =>
      isLearnMode && learnToggles
        ? buildLearnExtraEntries(
            "learn",
            learnToggles.showDepartments,
            learnToggles.showRivers,
            learnToggles.showMountains,
          )
        : extraEntriesProp || [],
    [isLearnMode, learnToggles, extraEntriesProp],
  );

  const { rowsByRegion, CONTINENT_ORDER } = useMemo(
    () =>
      getPanelData({
        dataMap,
        foundList,
        lang,
        mode,
        revealAll: revealAll || isLearnMode,
        extraEntries: learnExtraEntries,
      }),
    [dataMap, foundList, lang, mode, revealAll, isLearnMode, learnExtraEntries],
  );

  const normalizedQuery = normalizeString(searchQuery);

  const filteredRegions = useMemo(() => {
    if (!normalizedQuery) return rowsByRegion;

    const filtered = {};
    Object.entries(rowsByRegion).forEach(([region, rows]) => {
      const matches = rows.filter(
        (row) =>
          normalizeString(row.name).includes(normalizedQuery) ||
          normalizeString(row.sublabel || "").includes(normalizedQuery),
      );
      if (matches.length > 0) filtered[region] = matches;
    });
    return filtered;
  }, [rowsByRegion, normalizedQuery]);

  const regionsToRender = useMemo(() => {
    const ordered = [...CONTINENT_ORDER];
    Object.keys(rowsByRegion).forEach((region) => {
      if (!ordered.includes(region)) ordered.push(region);
    });
    return ordered.filter((region) => filteredRegions[region]?.length);
  }, [CONTINENT_ORDER, rowsByRegion, filteredRegions]);

  const handleRowClick = useCallback(
    (key) => {
      onSelectCountry?.(key === selectedCountry ? null : key);
    },
    [onSelectCountry, selectedCountry],
  );

  const panelTitle =
    title ||
    (isGameOver ? t("game_over") : isLearnMode ? t("mode_learn") : t("progress_title"));

  const scoreLabel =
    score !== undefined && total !== undefined ? `${score}/${total}` : null;

  return (
    <aside
      className={`game-data-panel ${theme} ${variant} ${isGameOver ? "is-game-over" : ""}`}
      aria-label={panelTitle}
    >
      <header className="data-panel-header">
        <div className="data-panel-title-block">
          <h2 className="data-panel-title">{panelTitle}</h2>
          {scoreLabel && (
            <span className="data-panel-score">{scoreLabel}</span>
          )}
        </div>
        <div className="data-panel-header-actions">
          {isGameOver && onGoHome && (
            <button
              className="panel-back-btn"
              onClick={onGoHome}
              aria-label={t("home")}
              title={t("home")}
            >
              <Home width={20} height={20} />
            </button>
          )}
          {onClose && (
            <button
              className="panel-close-btn"
              onClick={onClose}
              aria-label={t("close")}
            >
              <Close width={20} height={20} />
            </button>
          )}
        </div>
      </header>

      {isLearnMode && learnToggles && onToggleLearn && (
        <div className="data-panel-toolbar">
          <LearnModeToggles
            learnToggles={learnToggles}
            onToggleLearn={onToggleLearn}
            lang={lang}
            compact
          />
        </div>
      )}

      {showSearch && (
        <div className="data-panel-search">
          <input
            type="search"
            className="data-panel-search-input"
            placeholder={t("search_placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("search_placeholder")}
          />
        </div>
      )}

      <div className="data-panel-body scrollbar-styled">
        {regionsToRender.map((region) => {
          const rows = filteredRegions[region];
          if (!rows || rows.length === 0) return null;

          const regionLabel = t(`region_${region}`) || region;
          const color = colors[region] || "var(--accent)";
          const foundInRegion = rows.filter((r) => r.found).length;

          return (
            <section
              key={region}
              className="data-panel-region"
              style={{ "--region-color": color }}
            >
              <header className="data-panel-region-head">
                <span className="data-panel-region-dot" />
                <h3 className="data-panel-region-name">{regionLabel}</h3>
                {!revealAll && !isLearnMode && (
                  <span className="data-panel-region-count">
                    {foundInRegion}/{rows.length}
                  </span>
                )}
              </header>

              <div className="data-panel-table" role="table">
                {rows.map((row) => (
                  <GameDataPanelRow
                    key={row.key}
                    row={row}
                    isSelected={row.key === selectedCountry}
                    mode={isLearnMode ? "learn" : mode}
                    onSelect={handleRowClick}
                    unrevealedLabel={t("unrevealed_placeholder")}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
};

export default React.memo(GameDataPanel);