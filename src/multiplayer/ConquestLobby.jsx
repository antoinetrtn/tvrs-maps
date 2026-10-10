import React, { useState } from "react";

import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import { conquestText } from "./conquestText";

const LobbyEntry = ({ t, busy, onCreate, onJoin }) => {
  const [code, setCode] = useState("");
  return (
    <div className="conquest-lobby-entry">
      <button type="button" className="conquest-btn primary" disabled={busy} onClick={onCreate}>
        {t.create}
      </button>
      <form
        className="conquest-join-form"
        onSubmit={(e) => {
          e.preventDefault();
          onJoin(code);
        }}
      >
        <input
          className="conquest-input conquest-code-input"
          value={code}
          maxLength={8}
          placeholder={t.codePlaceholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button type="submit" className="conquest-btn" disabled={busy || code.length < 6}>
          {t.join}
        </button>
      </form>
    </div>
  );
};

const RoomShare = ({ t, code }) => {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Tvrs Maps", text: code });
      else await navigator.clipboard?.writeText(code);
      setCopied(true);
    } catch {
      /* user cancelled */
    }
  };
  return (
    <div className="conquest-room-code">
      <span className="conquest-label">{t.roomCode}</span>
      <span className="conquest-code">{code}</span>
      <button type="button" className="conquest-btn small" onClick={share}>
        {copied ? t.copied : t.share}
      </button>
    </div>
  );
};

const ConquestLobby = ({ lang, conquest, onBack }) => {
  const t = conquestText(lang);
  const { match, players, userId, online, busy, error } = conquest;
  const me = players.find((player) => player.user_id === userId);
  const isHost = match?.host_id === userId;
  const allReady = players.length >= 2 && players.every((player) => player.ready);

  return (
    <div className="conquest-panel glass-panel">
      <h2 className="conquest-title">{t.title}</h2>
      <p className="conquest-subtitle">{t.subtitle}</p>
      {!match ? (
        <LobbyEntry t={t} busy={busy} onCreate={conquest.create} onJoin={conquest.join} />
      ) : (
        <>
          <RoomShare t={t} code={match.code} />
          <ul className="conquest-player-list">
            {players.map((player) => (
              <li key={player.user_id}>
                <ConquestPlayerChip
                  player={player}
                  tag={[
                    player.user_id === match.host_id ? t.host : null,
                    player.user_id === userId ? t.you : null,
                    online.length && !online.includes(player.user_id) ? t.offline : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  <span className={`conquest-ready ${player.ready ? "is-ready" : ""}`}>
                    {player.ready ? t.ready : t.notReady}
                  </span>
                </ConquestPlayerChip>
              </li>
            ))}
          </ul>
          {players.length < 2 && <p className="conquest-hint">{t.waiting}</p>}
          <div className="conquest-actions">
            <button
              type="button"
              className="conquest-btn"
              disabled={busy || !me}
              onClick={() => conquest.setReady(!me?.ready)}
            >
              {me?.ready ? t.cancelReady : t.imReady}
            </button>
            {isHost ? (
              <button
                type="button"
                className="conquest-btn primary"
                disabled={busy || !allReady}
                onClick={conquest.start}
              >
                {t.startMatch}
              </button>
            ) : (
              <p className="conquest-hint">{t.waitingHost}</p>
            )}
          </div>
        </>
      )}
      {error && <p className="conquest-error">{error}</p>}
      <button type="button" className="conquest-btn ghost" onClick={onBack}>
        {match ? t.leave : t.back}
      </button>
    </div>
  );
};

export default ConquestLobby;
