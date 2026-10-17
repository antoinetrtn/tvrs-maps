import "./ConquestElo.css";

import { Flag, Gift, Sword, Trophy } from "pixelarticons/react";
import React, { useMemo } from "react";

import Button from "../components/ui/Button.jsx";
import { SettingsRow, SettingsSection } from "../components/ui/Settings.jsx";
import { computeStandings, computeWinner, eloChange, formatEloDelta } from "./conquestLogic";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import { conquestText } from "./conquestText";

const EndHeader = ({ winner, userId, t, result, elo }) => {
  const isMe = winner && winner.user_id === userId;
  const headline = winner ? (isMe ? t.youWin : winner.display_name) : t.draw;
  const headlineFull = winner
    ? isMe
      ? t.youWinFull || t.youWin
      : `${t.winner} ${winner.display_name}`
    : t.drawFull || t.draw;

  return (
    <header className="conquest-header">
      <h2 className="conquest-title conquest-title--winner" aria-label={headlineFull}>
        {winner && <Trophy width={20} height={20} aria-hidden="true" />}
        <span>{headline}</span>
      </h2>
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

const EndBoard = ({ standings, userId, t }) => (
  <SettingsSection title={t.finalBoard} hideTitle>
    {standings.map((player, index) => (
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
            <span
              className="conquest-score"
              title={`${player.countries} ${t.countries} · ${player.steals || 0} ${t.steals}${player.bonus ? ` · +${player.bonus} ${t.bonus}` : ""}`}
              aria-label={`${player.countries} ${t.countries} · ${player.steals || 0} ${t.steals}${player.bonus ? ` · +${player.bonus}` : ""}`}
            >
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
    ))}
  </SettingsSection>
);

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

  return (
    <div className="conquest-panel conquest-surface conquest-end">
      <EndHeader winner={winner} userId={userId} t={t} result={result} elo={elo} />
      <EndBoard standings={standings} userId={userId} t={t} />
      <p className="conquest-hint sr-only">{t.rematchHint}</p>
      <Button variant="primary" block onClick={onExit} aria-label={t.back} title={t.back}>
        {t.back}
      </Button>
    </div>
  );
};

export default ConquestEnd;
