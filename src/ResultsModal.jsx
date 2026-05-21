import React, { useMemo } from 'react';
import './ResultsModal.css';
import { getGameStats } from './utils';
import { getThemeRegionColor, getThemeRegionColorLabel, getThemeRegionColorAttenuated } from './designSystem';

const ResultsModal = ({ foundList, totalCountries, countryDataMap, activeDataMap, onRestart, onClose, isGameOver, onStop, isPlaying, mode, theme = 'dark', lang = 'fr', globeTheme = 'glass' }) => {
  const dataMap = activeDataMap || countryDataMap;
  const { stats, CONTINENT_ORDER } = useMemo(() => 
    getGameStats(foundList, dataMap, lang), 
    [foundList, dataMap, lang]
  );

  const colors = useMemo(() => {
    const res = {};
    const regions = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "France", "Boeuf", "Unknown"];
    regions.forEach(r => {
      res[r] = getThemeRegionColor(globeTheme, theme, r);
    });
    return res;
  }, [globeTheme, theme]);

  const labelColors = useMemo(() => {
    const res = {};
    const regions = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "France", "Boeuf", "Unknown"];
    regions.forEach(r => {
      res[r] = getThemeRegionColorLabel(globeTheme, theme, r);
    });
    return res;
  }, [globeTheme, theme]);

  const attenuatedColors = useMemo(() => {
    const res = {};
    const regions = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "France", "Boeuf", "Unknown"];
    regions.forEach(r => {
      res[r] = getThemeRegionColorAttenuated(globeTheme, theme, r);
    });
    return res;
  }, [globeTheme, theme]);

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
            const color = colors[region] || 'var(--accent)';
            const labelColor = labelColors[region] || 'var(--accent)';
            const bgColor = attenuatedColors[region] || 'var(--accent-soft)';

            const regionLabel = lang === 'fr' ? {
              "Europe": "Europe",
              "Americas": "Amériques",
              "Asia": "Asie",
              "Africa": "Afrique",
              "Oceania": "Océanie",
              "Antarctic": "Antarctique",
              "France": "France",
              "Boeuf": "Bœuf",
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
