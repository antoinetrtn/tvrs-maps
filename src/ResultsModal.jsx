import React, { useMemo } from 'react';
import './ResultsModal.css';
import { CONTINENT_COLORS, CONTINENT_COLORS_LABELS, CONTINENT_COLORS_ATTENUATED, THEME } from './designSystem';

const ResultsModal = ({ foundList, totalCountries, countryDataMap, onRestart, onClose, isGameOver, onStop, isPlaying, mode, theme = 'dark', lang = 'fr' }) => {
  const CONTINENT_ORDER = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "Unknown"];

  const stats = useMemo(() => {
    const s = {};
    CONTINENT_ORDER.forEach(reg => s[reg] = { total: 0, found: 0, countries: [] });
    
    Object.keys(countryDataMap).forEach(k => {
      const country = countryDataMap[k];
      let reg = country?.region;
      if (!reg || !s[reg]) reg = 'Unknown';
      
      s[reg].total++;
      const isFound = foundList.includes(k);
      if (isFound) s[reg].found++;
      s[reg].countries.push({
        key: k,
        found: isFound,
        name: lang === 'fr' ? (country.name_fr || k) : (country.name_en || k),
        capital: lang === 'fr' ? (country.capital_fr || country.capital) : country.capital
      });
    });

    // Sort countries in each region: found first, then alphabetical
    CONTINENT_ORDER.forEach(reg => {
      s[reg].countries.sort((a, b) => {
        if (a.found !== b.found) return a.found ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    });

    return s;
  }, [foundList, countryDataMap, lang]);

  const colors = CONTINENT_COLORS[theme] || CONTINENT_COLORS.dark;
  const labelColors = CONTINENT_COLORS_LABELS[theme] || CONTINENT_COLORS_LABELS.dark;
  const attenuatedColors = CONTINENT_COLORS_ATTENUATED[theme] || CONTINENT_COLORS_ATTENUATED.dark;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <header className="modal-header">
          <div className="header-left">
            <h2>{isGameOver ? (lang === 'fr' ? "Partie Terminée" : "Game Over") : (lang === 'fr' ? "Progression" : "Progress")}</h2>
            <div className="overall-score">
              <span className="score-number">{foundList.length}</span>
              <span className="score-sep">/</span>
              <span className="score-total">{totalCountries}</span>
            </div>
          </div>
          {onClose && <button className="close-popup" onClick={onClose}>✕</button>}
        </header>

        <div className="continents-grid">
          {CONTINENT_ORDER.map(region => {
            const data = stats[region];
            if (!data || data.total === 0) return null;
            
            const pct = Math.round((data.found / data.total) * 100);
            const color = colors[region];
            const labelColor = labelColors[region];
            const bgColor = attenuatedColors[region];

            const regionLabel = lang === 'fr' ? {
              "Europe": "Europe",
              "Americas": "Amériques",
              "Asia": "Asie",
              "Africa": "Afrique",
              "Oceania": "Océanie",
              "Antarctic": "Antarctique",
              "Unknown": "Inconnu"
            }[region] || region : region;

            return (
              <div key={region} className="continent-tile" style={{ '--continent-color': color, '--continent-bg': bgColor, '--continent-label': labelColor }}>
                <div className="tile-header">
                  <div className="continent-info">
                    <h3>{regionLabel}</h3>
                    <span className="continent-count">{data.found} / {data.total}</span>
                  </div>
                </div>
                
                <div className="countries-pill-grid">
                  {data.countries.map(c => {
                    const label = mode === 'capitals' ? c.capital : c.name;
                    const isRevealed = c.found || isGameOver;
                    return (
                      <div 
                        key={c.key} 
                        className={`country-pill ${c.found ? 'found' : 'missed'}`}
                        title={isRevealed ? label : '???'}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <div className="modal-actions">
            {isPlaying && !isGameOver && (
              <button className="stop-btn" onClick={() => { if(onStop) onStop(); if(onClose) onClose(); }}>
                {lang === 'fr' ? "Arrêter la partie" : "Stop Game"}
              </button>
            )}
            <button className="restart-btn" onClick={onRestart}>
              {isGameOver ? (lang === 'fr' ? "Accueil" : "Home") : (lang === 'fr' ? "Continuer" : "Continue")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ResultsModal);
