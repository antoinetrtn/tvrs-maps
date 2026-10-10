import React, { useState } from "react";

import { SettingsRow, SettingsSection } from "../components/ui/Settings.jsx";
import Switch from "../components/ui/Switch.jsx";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import { conquestText } from "./conquestText";

const LobbyEntry = ({ t, busy, onCreate, onJoin }) => {
  const [code, setCode] = useState("");
  return (
    <SettingsSection title={t.room}>
      <button
        type="button"
        className="btn-primary conquest-block"
        disabled={busy}
        onClick={onCreate}
      >
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
          aria-label={t.roomCode}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button type="submit" className="btn-secondary" disabled={busy || code.length < 6}>
          {t.join}
        </button>
      </form>
    </SettingsSection>
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
    <SettingsRow label={t.roomCode}>
      <div className="conquest-room-code">
        <span className="conquest-code">{code}</span>
        <button type="button" className="btn-secondary" onClick={share}>
          {copied ? t.copied : t.share}
        </button>
      </div>
    </SettingsRow>
  );
};

const playerTags = (t, player, match, userId, online) =>
  [
    player.user_id === match.host_id ? t.host : null,
    player.user_id === userId ? t.you : null,
    online.length && !online.includes(player.user_id) ? t.offline : null,
  ]
    .filter(Boolean)
    .join(" · ");

const ConquestLobby = ({ lang, conquest, onBack }) => {
  const t = conquestText(lang);
  const { match, players, userId, online, busy, error } = conquest;
  const isHost = match?.host_id === userId;
  const allReady = players.length >= 2 && players.every((player) => player.ready);

  return (
    <div className="conquest-panel conquest-surface">
      <header className="conquest-header">
        <h2 className="conquest-title">{t.title}</h2>
        <p className="conquest-subtitle">{t.subtitle}</p>
      </header>
      {!match ? (
        <LobbyEntry t={t} busy={busy} onCreate={conquest.create} onJoin={conquest.join} />
      ) : (
        <>
          <SettingsSection title={t.room}>
            <RoomShare t={t} code={match.code} />
          </SettingsSection>
          <SettingsSection title={t.players}>
            {players.map((player) => (
              <SettingsRow key={player.user_id}>
                <ConquestPlayerChip
                  player={player}
                  tag={playerTags(t, player, match, userId, online)}
                >
                  <Switch
                    checked={Boolean(player.ready)}
                    label={`${t.readyLabel} — ${player.display_name}`}
                    disabled={busy || player.user_id !== userId}
                    onChange={(ready) => conquest.setReady(ready)}
                  />
                </ConquestPlayerChip>
              </SettingsRow>
            ))}
            {players.length < 2 && <p className="conquest-hint">{t.waiting}</p>}
          </SettingsSection>
          {isHost ? (
            <button
              type="button"
              className="btn-primary conquest-block"
              disabled={busy || !allReady}
              onClick={conquest.start}
            >
              {t.startMatch}
            </button>
          ) : (
            <p className="conquest-hint">{t.waitingHost}</p>
          )}
        </>
      )}
      {error && <p className="conquest-error">{error}</p>}
      <button type="button" className="btn-secondary conquest-block" onClick={onBack}>
        {match ? t.leave : t.back}
      </button>
    </div>
  );
};

export default ConquestLobby;
