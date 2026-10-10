import React, { useMemo } from "react";

import { SettingsRow, SettingsSection } from "../components/ui/Settings.jsx";
import { computeStandings, computeWinner } from "./conquestLogic";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import { conquestText } from "./conquestText";

const ConquestEnd = ({ lang, conquest, onExit }) => {
  const t = conquestText(lang);
  const { players, claims, bonuses, userId, match } = conquest;
  const result = match?.result || null;
  const standings = useMemo(
    () => computeStandings(players, claims, bonuses),
    [players, claims, bonuses]
  );
  const winner = useMemo(
    () => computeWinner(players, claims, bonuses, result),
    [players, claims, bonuses, result]
  );
  let headline = t.draw;
  if (winner)
    headline = winner.user_id === userId ? t.youWin : `${t.winner} ${winner.display_name}`;

  return (
    <div className="conquest-panel conquest-surface conquest-end">
      <header className="conquest-header">
        <h2 className="conquest-title">{headline}</h2>
        {result?.forfeit_by && <p className="conquest-subtitle">{t.forfeitNote}</p>}
      </header>
      <SettingsSection title={t.finalBoard}>
        {standings.map((player, index) => (
          <SettingsRow key={player.user_id}>
            <div className="conquest-end-row">
              <span className="conquest-rank">{index + 1}</span>
              <ConquestPlayerChip player={player} tag={player.user_id === userId ? t.you : null}>
                <span className="conquest-score">
                  {player.countries} {t.countries} · {player.steals || 0} {t.steals}
                  {player.bonus ? ` · +${player.bonus} ${t.bonus}` : ""}
                </span>
              </ConquestPlayerChip>
              <span className="conquest-total">
                {player.total} {t.pts}
              </span>
            </div>
          </SettingsRow>
        ))}
      </SettingsSection>
      <p className="conquest-hint">{t.rematchHint}</p>
      <button type="button" className="btn-primary conquest-block" onClick={onExit}>
        {t.back}
      </button>
    </div>
  );
};

export default ConquestEnd;
