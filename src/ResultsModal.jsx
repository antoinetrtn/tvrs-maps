import React from 'react';
import './ResultsModal.css';

const ResultsModal = ({ foundList, totalCountries, countryDataMap, onRestart, onClose, isGameOver, onStop, isPlaying, mode }) => {
  const allKeys = Object.keys(countryDataMap);
  const missed = allKeys.filter(k => !foundList.includes(k));

  const CONTINENT_ORDER = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "Unknown"];

  const groupByRegion = (list) => {
    const groups = {};
    list.forEach(k => {
      const region = countryDataMap[k]?.region || 'Unknown';
      if (!groups[region]) groups[region] = [];
      groups[region].push(k);
    });
    return groups;
  };

  const renderRegionLists = (listItems) => {
    const grouped = groupByRegion(listItems);
    return CONTINENT_ORDER.map(region => {
      if (!grouped[region] || grouped[region].length === 0) return null;
      return (
        <div key={region} className="region-block">
          <h4>{region}</h4>
          <ul>
            {grouped[region].map(k => {
              const data = countryDataMap[k];
              const label = mode === 'capitals'
                ? `${data?.capital_fr || data?.capital || '?'} (${data?.name_fr || k})`
                : (data?.name_fr || k);
              return <li key={k}>{label}</li>;
            })}
          </ul>
        </div>
      );
    });
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content">
        {onClose && <button className="close-popup" onClick={onClose}>✕</button>}
        <h2>{isGameOver ? "Partie Terminée" : "Informations de Partie"}</h2>
        <p className="score-summary">Vous avez trouvé <b style={{color:'#22c55e'}}>{foundList.length}</b> {mode === 'capitals' ? 'capitales' : 'pays'} sur {totalCountries} !</p>
        
        <div className="lists-container">
          <div className="list-section found">
            <h3>Trouvés ({foundList.length})</h3>
            <div className="region-container">
              {renderRegionLists(foundList)}
            </div>
          </div>
          {isGameOver && (
          <div className="list-section missed">
            <h3>Manqués ({missed.length})</h3>
            <div className="region-container">
              {renderRegionLists(missed)}
            </div>
          </div>
          )}
        </div>

        <div className="modal-actions" style={{display:'flex', gap:'12px', justifyContent:'center'}}>
           {isPlaying && !isGameOver && (
             <button className="stop-btn" onClick={() => { if(onStop) onStop(); if(onClose) onClose(); }}>
               Arrêter la partie
             </button>
           )}
           <button className="restart-btn" onClick={onRestart}>
             {isGameOver ? "Rejouer" : "Relancer la partie"}
           </button>
        </div>
      </div>
    </div>
  );
};
export default React.memo(ResultsModal);
