import React, { useMemo } from 'react';
import './EndScreen.css';
import { getGameStats } from './utils';
import { CONTINENT_COLORS } from './designSystem';

const EndScreen = ({ foundList, totalCountries, countryDataMap, activeDataMap, mode, onRestart, onViewTable, theme = 'dark', lang = 'fr' }) => {
  const dataMap = activeDataMap || countryDataMap;
  const { stats, CONTINENT_ORDER } = useMemo(() => 
    getGameStats(foundList, dataMap, lang), 
    [foundList, dataMap, lang]
  );

  const colors = CONTINENT_COLORS[theme] || CONTINENT_COLORS.dark;
  const isPerfectScore = foundList.length === totalCountries;

  const continentLabels = {
    fr: {
      "Europe": "Europe",
      "Americas": "Amériques",
      "Asia": "Asie",
      "Africa": "Afrique",
      "Oceania": "Océanie",
      "Antarctic": "Antarctique",
      "France": "France",
      "Boeuf": "Bœuf",
      "Unknown": "Inconnu"
    },
    en: {
      "Europe": "Europe",
      "Americas": "Americas",
      "Asia": "Asia",
      "Africa": "Africa",
      "Oceania": "Oceania",
      "Antarctic": "Antarctica",
      "France": "France",
      "Boeuf": "Beef",
      "Unknown": "Unknown"
    }
  };

  const getTitle = () => {
    if (isPerfectScore) return lang === 'fr' ? "Incroyable !" : "Incredible !";
    return lang === 'fr' ? "Bravo !" : "Well done!";
  };

  const getSubTitle = () => {
    if (isPerfectScore && mode === 'departments') return lang === 'fr' ? "Vous maîtrisez la carte de France !" : "You mastered the map of France!";
    if (isPerfectScore && mode === 'beef') return lang === 'fr' ? "Vous maîtrisez la vache, sans globe." : "You mastered the cow, no globe needed.";
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
            const color = colors[region] || 'var(--accent)';
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
