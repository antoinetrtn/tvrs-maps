import "../components/ui/ui.css";
import "./ConquestScreen.css";
import "./ConquestElo.css";

import React, { useEffect, useState } from "react";

import AtlasState from "../components/AtlasState";
import { SettingsSection } from "../components/ui/Settings.jsx";
import { getConquestLeaderboard } from "./conquestApi";
import { conquestText } from "./conquestText";

const BoardRow = ({ row, isMe }) => (
  <tr className={isMe ? "is-me" : undefined}>
    <td className="col-rank">{row.rank}</td>
    <td className="col-player">{row.display_name || "?"}</td>
    <td className="col-score conquest-board-elo">{row.elo}</td>
    <td className="col-time">
      {row.wins} / {row.losses} / {row.draws}
    </td>
    <td className="col-time">{row.steals}</td>
  </tr>
);

/** « Conquête » tab of the leaderboard: public Elo board + the player's rank. */
const ConquestLeaderboard = ({ lang = "fr", isSignedIn = false }) => {
  const t = conquestText(lang);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    getConquestLeaderboard(50)
      .then((data) => alive && setBoard(data || { top: [], me: null }))
      .catch((err) => alive && setError(err?.message || String(err)));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <AtlasState variant="error" title={error} />;
  if (!board) return <AtlasState variant="loading" title="…" />;

  const { top = [], me = null } = board;
  const meInTop = me && top.some((row) => row.user_id === me.user_id);
  return (
    <SettingsSection title={t.boardTitle} className="conquest-board">
      {top.length === 0 ? (
        <AtlasState title={t.boardEmpty} />
      ) : (
        <div className="leaderboard-table-container scrollbar-styled">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th className="col-player">{t.players}</th>
                <th className="col-score">{t.elo}</th>
                <th className="col-time">{t.boardRecord}</th>
                <th className="col-time">{t.steals}</th>
              </tr>
            </thead>
            <tbody>
              {top.map((row) => (
                <BoardRow key={row.user_id} row={row} isMe={row.user_id === me?.user_id} />
              ))}
              {me && !meInTop && <BoardRow row={me} isMe />}
            </tbody>
          </table>
        </div>
      )}
      {!me && <p className="conquest-hint">{isSignedIn ? t.boardEmpty : t.boardGuest}</p>}
    </SettingsSection>
  );
};

export default ConquestLeaderboard;
