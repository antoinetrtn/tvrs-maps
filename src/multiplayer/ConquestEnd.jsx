import React, { useMemo } from "react";

import { computeStandings, computeWinner } from "./conquestLogic";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import { conquestText } from "./conquestText";

const ConquestEnd = ({ lang, conquest, onExit }) => {
  const t = conquestText(lang);
  const { players, claims, userId } = conquest;
  const standings = useMemo(() => computeStandings(players, claims), [players, claims]);
  const winner = useMemo(() => computeWinner(players, claims), [players, claims]);
  let headline = t.draw;
  if (winner)
    headline = winner.user_id === userId ? t.youWin : `${t.winner} ${winner.display_name}`;

  return (
    <div className="conquest-panel glass-panel conquest-end">
      <h2 className="conquest-title">{headline}</h2>
      <span className="conquest-label">{t.finalBoard}</span>
      <ol className="conquest-player-list">
        {standings.map((player, index) => (
          <li key={player.user_id}>
            <span className="conquest-rank">{index + 1}</span>
            <ConquestPlayerChip player={player} tag={player.user_id === userId ? t.you : null}>
              <span className="conquest-score">
                {player.score} {t.pts} · {player.countries} {t.countries}
              </span>
            </ConquestPlayerChip>
          </li>
        ))}
      </ol>
      <p className="conquest-hint">{t.rematchHint}</p>
      <button type="button" className="conquest-btn primary" onClick={onExit}>
        {t.back}
      </button>
    </div>
  );
};

export default ConquestEnd;
