import React, { useMemo } from 'react';
import './EndScreen.css';
import { getGameStats } from './utils';
import { CONTINENT_COLORS, THEME } from './designSystem';

const EndScreen = ({ foundList, totalCountries, countryDataMap, onRestart, onViewTable, theme = 'dark', lang = 'fr' }) => {
  const { stats, CONTINENT_ORDER } = useMemo(() => 
    getGameStats(foundList, countryDataMap, lang), 
    [foundList, countryDataMap, lang]
  );

  const colors = CONTINENT_COLORS[theme] || CONTINENT_COLORS.dark;
  const ui = THEME[theme] || THEME.dark;
  const isPerfectScore = foundList.length === totalCountries;

  const continentLabels = {
    fr: {
      "Europe": "Europe",
      "Americas": "Amériques",
      "Asia": "Asie",
      "Africa": "Afrique",
      "Oceania": "Océanie",
      "Antarctic": "Antarctique",
      "Unknown": "Inconnu"
    },
    en: {
      "Europe": "Europe",
      "Americas": "Americas",
      "Asia": "Asia",
      "Africa": "Africa",
      "Oceania": "Oceania",
      "Antarctic": "Antarctica",
      "Unknown": "Unknown"
    }
  };

  const getTitle = () => {
    if (isPerfectScore) return lang === 'fr' ? "Incroyable !" : "Incredible !";
    return lang === 'fr' ? "Bravo !" : "Well done!";
  };

  const getSubTitle = () => {
    if (isPerfectScore) return lang === 'fr' ? "Vous avez conquis le monde !" : "You conquered the world!";
    return lang === 'fr' ? "Vous avez trouvé :" : "You found:";
  };

  return (
    <div className={`end-screen-overlay ${isPerfectScore ? 'perfect-game' : ''}`}>
      <div className="end-screen-content">
        <div className="end-screen-header">
          <h1>{getTitle()}</h1>
          <p>
            {getSubTitle()}
            <span className="final-score"> {foundList.length} / {totalCountries}</span>
          </p>
        </div>

        <div className="end-screen-spacer">
          {/* This space is for the globe which is rendered behind */}
        </div>

        <div className="continents-progress-bars">
          {CONTINENT_ORDER.filter(reg => reg !== 'Unknown' && stats[reg].total > 0).map(region => {
            const data = stats[region];
            const pct = (data.found / data.total) * 100;
            const color = colors[region];
            const label = continentLabels[lang][region] || region;

            return (
              <div key={region} className="progress-item">
                <div className="progress-info">
                  <span className="progress-label">{label}</span>
                  <span className="progress-count">{data.found}/{data.total}</span>
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
            {lang === 'fr' ? "Voir le tableau" : "View Table"}
          </button>
          <button className="btn-primary" onClick={onRestart}>
            {lang === 'fr' ? "Rejouer" : "Play Again"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(EndScreen);
