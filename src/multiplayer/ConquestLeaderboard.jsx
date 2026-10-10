import "../components/ui/ui.css";

import React, { useEffect, useState } from "react";

import AtlasState from "../components/AtlasState";
import LeaderboardRow, { LeaderboardList, LeaderboardNotice } from "../components/LeaderboardRow";
import { getConquestLeaderboard } from "./conquestApi";
import { conquestText } from "./conquestText";

/** "9V · 2D · 1N · 14 vols" — letters come from the « V / D / N » label. */
export const formatRecord = (t, row) => {
  const [w, l, d] = t.boardRecord.split(" / ");
  return `${row.wins}${w} · ${row.losses}${l} · ${row.draws}${d} · ${row.steals} ${t.steals}`;
};

const BoardRow = ({ row, isMe, t }) => (
  <LeaderboardRow
    rank={row.rank}
    podium={row.rank <= 3}
    name={row.display_name || "?"}
    sub={formatRecord(t, row)}
    stat={row.elo}
    meta={t.elo}
    isMe={isMe}
    youLabel={t.you}
  />
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
  if (!board) return <AtlasState variant="loading" title={t.loading} />;

  const { top = [], me = null } = board;
  const meInTop = me && top.some((row) => row.user_id === me.user_id);
  return (
    <>
      {!isSignedIn && <LeaderboardNotice>{t.boardGuest}</LeaderboardNotice>}
      {top.length === 0 ? (
        <AtlasState title={t.boardEmpty} />
      ) : (
        <LeaderboardList label={t.boardTitle}>
          {top.map((row) => (
            <BoardRow key={row.user_id} row={row} t={t} isMe={row.user_id === me?.user_id} />
          ))}
          {me && !meInTop && <BoardRow row={me} t={t} isMe />}
        </LeaderboardList>
      )}
    </>
  );
};

export default ConquestLeaderboard;
