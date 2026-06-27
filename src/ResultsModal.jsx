import React, { useMemo } from 'react';
import { Close } from 'pixelarticons/react';
import './ResultsModal.css';
import { getGameStats } from './utils';
import { getThemeRegionColor } from './designSystem';

const REGION_LABELS_FR = {
  "Europe": "Europe",
  "Americas": "Amériques",
  "Asia": "Asie",
  "Africa": "Afrique",
  "Oceania": "Océanie",
  "Antarctic": "Antarctique",
  "France": "France",
  "Unknown": "Inconnu"
};

// Fixed-width neutral placeholder for not-yet-found entries (no noisy glitch animation)
const getMaskText = (str) => '·'.repeat(Math.max(3, Math.min(str.length, 7)));

const ResultsModal = ({ foundList, totalCountries, countryDataMap, activeDataMap, onRestart, onClose, isGameOver, onStop, isPlaying, mode, theme = 'dark', lang = 'fr', globeTheme = 'glass' }) => {
  const dataMap = activeDataMap || countryDataMap;
  const { stats, CONTINENT_ORDER } = useMemo(() =>
    getGameStats(foundList, dataMap, lang),
    [foundList, dataMap, lang]
  );

  const colors = useMemo(() => {
    const res = {};
    const regions = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "France", "Unknown"];
    regions.forEach(r => {
      res[r] = getThemeRegionColor(globeTheme, theme, r);
    });
    return res;
  }, [globeTheme, theme]);

  return (
    <div className="modal-overlay">
      <div className={`modal-content ${isGameOver ? 'is-game-over' : ''}`}>
        <header className="modal-header">
          <div className="header-left">
            <span className="modal-eyebrow">
              {isGameOver ? (lang === 'fr' ? "Partie terminée" : "Game over") : (lang === 'fr' ? "Progression" : "Progress")}
            </span>
            <div className="overall-score">
              <span className="score-number">{foundList.length}</span>
              <span className="score-sep">/</span>
              <span className="score-total">{totalCountries}</span>
            </div>
          </div>
          {onClose && (
            <button className="close-popup" onClick={onClose} aria-label={lang === 'fr' ? 'Fermer' : 'Close'}>
              <Close width={18} height={18} />
            </button>
          )}
        </header>

        <div className="continents-grid">
          {CONTINENT_ORDER.map(region => {
            const data = stats[region];
            if (!data || data.total === 0) return null;

            const pct = Math.round((data.found / data.total) * 100);
            const color = colors[region] || 'var(--accent)';
            const regionLabel = lang === 'fr' ? (REGION_LABELS_FR[region] || region) : region;

            return (
              <section key={region} className="continent-row" style={{ '--continent-color': color }}>
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

                <div className="continent-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="continent-progress-fill" style={{ width: `${pct}%` }} />
                </div>

                <div className="countries-pill-grid">
                  {data.countries.map(c => {
                    const label = mode === 'capitals' ? c.capital : c.name;
                    const isRevealed = c.found || isGameOver;
                    const displayLabel = isRevealed ? label : getMaskText(label || '');
                    return (
                      <div
                        key={c.key}
                        className={`country-pill ${c.found ? 'found' : 'missed'}`}
                        title={isRevealed ? label : '???'}
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
              <button className="stop-btn" onClick={() => { if (onStop) onStop(); if (onClose) onClose(); }}>
                {lang === 'fr' ? "Arrêter la partie" : "Stop game"}
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
