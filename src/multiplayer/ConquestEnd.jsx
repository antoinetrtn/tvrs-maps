import "./ConquestElo.css";

import { Flag, Gift, Sword, Trophy } from "pixelarticons/react";
import React, { useMemo } from "react";

import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import PanelCloseButton from "../components/ui/PanelCloseButton.jsx";
import { SettingsRow, SettingsSection } from "../components/ui/Settings.jsx";
import {
  computeStandings,
  computeWinner,
  eloChange,
  formatEloDelta,
  rematchState,
} from "./conquestLogic";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import { conquestText } from "./conquestText";

const EndHeader = ({ winner, userId, t, result, elo, onExit }) => {
  const isMe = winner && winner.user_id === userId;
  let headline = t.draw;
  let headlineFull = t.drawFull || t.draw;
  if (winner) {
    headline = isMe ? t.youWin : winner.display_name;
    headlineFull = isMe ? t.youWinFull || t.youWin : `${t.winner} ${winner.display_name}`;
  }

  return (
    <header className="conquest-header">
      <div className="conquest-header-row">
        <h2 className="conquest-title conquest-title--winner" aria-label={headlineFull}>
          {winner && <Trophy width={20} height={20} aria-hidden="true" />}
          <span>{headline}</span>
        </h2>
        <div className="conquest-header-actions">
          {onExit && <PanelCloseButton label={t.close} onClick={onExit} />}
        </div>
      </div>
      {result?.forfeit_by && (
        <p className="conquest-subtitle" title={t.forfeitNoteFull || t.forfeitNote}>
          {t.forfeitNote}
        </p>
      )}
      {elo ? (
        <p className="conquest-elo">
          {t.elo} {elo.after}{" "}
          <span className={elo.delta >= 0 ? "is-up" : "is-down"}>{formatEloDelta(elo.delta)}</span>
        </p>
      ) : (
        result && (
          <p className="conquest-hint" title={t.unratedFull || t.unrated}>
            {t.unrated}
          </p>
        )
      )}
    </header>
  );
};

function formatPlayerScoreSummary(player, t) {
  const bonus = player.bonus ? ` · +${player.bonus} ${t.bonus}` : "";
  return `${player.countries} ${t.countries} · ${player.steals || 0} ${t.steals}${bonus}`;
}

const EndBoard = ({ standings, userId, t }) => {
  if (standings.length === 0) {
    return <EmptyState title={t.boardEmpty} />;
  }
  return (
    <SettingsSection title={t.finalBoard} hideTitle>
      {standings.map((player, index) => {
        const scoreSummary = formatPlayerScoreSummary(player, t);
        return (
          <SettingsRow key={player.user_id}>
            <div className="conquest-end-row">
              <span className="conquest-rank">{index + 1}</span>
              <ConquestPlayerChip
                player={player}
                tag={
                  player.user_id === userId ? (
                    <span className="conquest-tag-me" title={t.you} aria-label={t.you}>
                      <span aria-hidden="true">▸</span>
                      <span className="sr-only">({t.you})</span>
                    </span>
                  ) : null
                }
              >
                <span className="conquest-score" title={scoreSummary} aria-label={scoreSummary}>
                  <span className="conquest-stat">
                    <Flag width={12} height={12} aria-hidden="true" />
                    <span>{player.countries}</span>
                  </span>
                  <span className="conquest-stat">
                    <Sword width={12} height={12} aria-hidden="true" />
                    <span>{player.steals || 0}</span>
                  </span>
                  {player.bonus ? (
                    <span className="conquest-stat">
                      <Gift width={12} height={12} aria-hidden="true" />
                      <span>+{player.bonus}</span>
                    </span>
                  ) : null}
                </span>
              </ConquestPlayerChip>
              <span
                className="conquest-total"
                title={`${player.total} ${t.pts}`}
                aria-label={`${player.total} ${t.pts}`}
              >
                {player.total}
              </span>
            </div>
          </SettingsRow>
        );
      })}
    </SettingsSection>
  );
};

const ConquestEnd = ({ lang, conquest, onExit }) => {
  const t = conquestText(lang);
  const { players, claims, bonuses, userId, match } = conquest;
  const result = match?.result || null;
  const elo = eloChange(result, userId);
  const standings = useMemo(
    () => computeStandings(players, claims, bonuses),
    [players, claims, bonuses]
  );
  const winner = useMemo(
    () => computeWinner(players, claims, bonuses, result),
    [players, claims, bonuses, result]
  );
  const state = rematchState(match);
  const opponent = players?.find((p) => p.user_id !== userId);

  return (
    <div className="conquest-panel conquest-surface conquest-end px-cascade">
      <EndHeader winner={winner} userId={userId} t={t} result={result} elo={elo} onExit={onExit} />
      <EndBoard standings={standings} userId={userId} t={t} />
      {state === "join" && (
        <p className="conquest-rematch-waiting">
          {opponent ? `${opponent.display_name} ${t.rematchWaiting}` : t.rematchWaiting}
        </p>
      )}
      {state && (
        <Button
          variant="primary"
          block
          disabled={conquest?.busy}
          onClick={() => conquest?.rematch?.()}
          aria-label={state === "join" ? t.rematchJoin : t.rematch}
          title={state === "join" ? t.rematchJoin : t.rematch}
        >
          {state === "join" ? t.rematchJoin : t.rematch}
        </Button>
      )}
      <Button variant="secondary" block onClick={onExit} aria-label={t.back} title={t.back}>
        {t.back}
      </Button>
      <p className="conquest-hint">{t.rematchHint}</p>
    </div>
  );
};

export default ConquestEnd;
