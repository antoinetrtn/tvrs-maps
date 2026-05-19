import React, { useMemo } from 'react';
import { beefCutsDataMap } from './beefCutsData';
import './BeefCutsMap.css';

const VIEWBOX_WIDTH = 376.17478;
const VIEWBOX_HEIGHT = 237.23108;

const getCutHighlightShape = (cut) => {
  const code = Number(cut.code);
  if ([1, 2, 3, 4, 5].includes(code)) return { rx: 21, ry: 13, rotate: -8 };
  if ([6, 7, 8, 9, 10, 11, 12].includes(code)) return { rx: 18, ry: 13, rotate: -12 };
  if ([13, 14, 15, 16, 17].includes(code)) return { rx: 20, ry: 12, rotate: 0 };
  if ([18, 19, 20, 21].includes(code)) return { rx: 18, ry: 14, rotate: 8 };
  if ([22, 23, 28, 29].includes(code)) return { rx: 14, ry: 11, rotate: 0 };
  return { rx: 20, ry: 13, rotate: 0 };
};

const BeefCutsMap = ({
  lang,
  foundList,
  selectedCountry,
  onCutSelect,
  isHomeScreen,
  isEndScreen,
  isError,
  isPerfectScore
}) => {
  const foundSet = useMemo(() => new Set(foundList), [foundList]);
  const cuts = useMemo(() => Object.entries(beefCutsDataMap), []);

  if (isHomeScreen) return null;

  return (
    <div className={`beef-map-shell ${isEndScreen ? 'end-screen' : ''}`}>
      <div className="beef-map-background" aria-hidden="true">
        <div className="beef-grid" />
        <div className="beef-mist" />
      </div>

      <div className="beef-board">
        <div className="beef-diagram-wrap">
          <img
            className="beef-diagram-image"
            src="/assets/beef-cuts-france-with-numbers.svg"
            alt={lang === 'fr' ? 'Schéma français des pièces de boucherie du bœuf' : 'French beef cuts diagram'}
            draggable="false"
          />
          <svg
            className="beef-hotspots"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            aria-hidden="false"
          >
            {cuts.map(([key, cut]) => {
              const isFound = foundSet.has(key);
              const isSelected = selectedCountry === key;
              const stateClass = isFound
                ? (isPerfectScore ? 'is-perfect' : 'is-found')
                : (isSelected ? (isError ? 'is-error' : 'is-selected') : 'is-idle');
              const label = lang === 'fr' ? cut.name_fr : cut.name_en;
              const highlight = getCutHighlightShape(cut);

              return (
                <g
                  key={key}
                  className={`beef-hotspot ${stateClass}`}
                  onClick={() => onCutSelect(key)}
                  tabIndex={0}
                  role="button"
                  aria-label={label}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onCutSelect(key);
                    }
                  }}
                >
                  <ellipse
                    className="beef-hotspot-highlight"
                    cx={cut.x}
                    cy={cut.y - 4}
                    rx={highlight.rx}
                    ry={highlight.ry}
                    transform={`rotate(${highlight.rotate} ${cut.x} ${cut.y - 4})`}
                  />
                  <ellipse
                    className="beef-hotspot-hit"
                    cx={cut.x}
                    cy={cut.y - 4}
                    rx={highlight.rx + 5}
                    ry={highlight.ry + 5}
                    transform={`rotate(${highlight.rotate} ${cut.x} ${cut.y - 4})`}
                  />
                </g>
              );
            })}
          </svg>
          <div className="beef-labels-layer" aria-hidden="true">
            {cuts.map(([key, cut]) => {
              const isFound = foundSet.has(key);
              if (!isFound && !isEndScreen) return null;

              const label = lang === 'fr' ? cut.name_fr : cut.name_en;
              const labelClass = [
                'beef-found-label',
                isPerfectScore && isFound ? 'is-perfect' : '',
                isFound ? 'is-found' : 'is-missed'
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={key}
                  className={labelClass}
                  style={{
                    left: `${(cut.x / VIEWBOX_WIDTH) * 100}%`,
                    top: `${((cut.y - 4) / VIEWBOX_HEIGHT) * 100}%`
                  }}
                >
                  <div className="beef-found-label-dot" />
                  <div className="beef-found-label-copy">
                    <div className="beef-found-label-main">
                      <span className="beef-found-label-code">{cut.code}</span>
                      <span className="beef-found-label-name">{label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default React.memo(BeefCutsMap);
