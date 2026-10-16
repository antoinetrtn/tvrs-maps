import "./ConquestReady.css";

import { Copy, Crown, ExternalLink } from "pixelarticons/react";
import React, { useEffect, useState } from "react";

import AtlasState from "../components/AtlasState";
import { SettingsRow, SettingsSection } from "../components/ui/Settings.jsx";
import { buildConquestLink } from "./conquestLink";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import { ConquestRulesButton } from "./ConquestRulesSheet.jsx";
import { conquestText } from "./conquestText";

const LobbyEntry = ({ t, busy, onCreate, onJoin }) => {
  const [code, setCode] = useState("");
  return (
    <SettingsSection title={t.room} hideTitle>
      <button
        type="button"
        className="btn-primary conquest-block"
        disabled={busy}
        onClick={onCreate}
        aria-label={t.createFull || t.create}
        title={t.createFull || t.create}
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
        <button
          type="submit"
          className="btn-secondary"
          disabled={busy || code.length < 6}
          aria-label={t.join}
          title={t.join}
        >
          {t.join}
        </button>
      </form>
    </SettingsSection>
  );
};

/** Copy the code; resolves true on success. Exported for tests. */
export const copyRoomCode = async (code, nav = globalThis.navigator) => {
  if (!nav?.clipboard) return false;
  try {
    await nav.clipboard.writeText(code);
    return true;
  } catch {
    return false;
  }
};

/** Native share sheet when available, clipboard otherwise. Returns "shared" | "copied" | null. */
export const shareRoomCode = async (code, nav = globalThis.navigator, text = "") => {
  const url = buildConquestLink(code);
  if (nav?.share) {
    try {
      await nav.share({ title: "Tvrs Maps — Conquête", text: text || code, url });
      return "shared";
    } catch {
      return null; // user cancelled the share sheet
    }
  }
  return (await copyRoomCode(url, nav)) ? "copied" : null;
};

const RoomShare = ({ t, code }) => {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const onCopy = async () =>
    setToast((await copyRoomCode(buildConquestLink(code))) ? t.linkCopied : null);
  const onShare = async () => {
    const result = await shareRoomCode(code, globalThis.navigator, t.shareText(code));
    if (result === "copied") setToast(t.linkCopied);
  };

  return (
    <SettingsRow layout="stacked">
      <div className="conquest-room-code">
        <span className="conquest-code" aria-label={t.roomCode}>
          {code}
        </span>
        <button
          type="button"
          className="conquest-icon-btn"
          onClick={onCopy}
          aria-label={t.copyCode}
          title={t.copyCode}
        >
          <Copy width={18} height={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn-secondary conquest-share-btn"
          onClick={onShare}
          aria-label={t.share}
          title={t.share}
        >
          <ExternalLink width={16} height={16} aria-hidden="true" />
          <span>{t.share}</span>
        </button>
      </div>
      <p className={`conquest-copy-toast ${toast ? "is-visible" : ""}`} role="status">
        {toast || ""}
      </p>
    </SettingsRow>
  );
};

const PlayerTag = ({ t, isHost, isMe, isOffline }) => {
  if (!isHost && !isMe && !isOffline) return null;
  return (
    <span className="conquest-player-tag">
      {isHost && (
        <span className="conquest-tag-host" title={t.host} aria-label={t.host}>
          <Crown width={14} height={14} aria-hidden="true" />
          <span className="sr-only">({t.host})</span>
        </span>
      )}
      {isMe && (
        <span className="conquest-tag-me" title={t.you} aria-label={t.you}>
          <span aria-hidden="true">▸</span>
          <span className="sr-only">({t.you})</span>
        </span>
      )}
      {isOffline && <span className="conquest-tag-offline sr-only">({t.offline})</span>}
    </span>
  );
};

const PlayerList = ({ t, players, match, userId, online }) => (
  <SettingsSection title={t.players} hideTitle>
    {players.map((player) => (
      <SettingsRow key={player.user_id}>
        <ConquestPlayerChip
          player={player}
          tag={
            <PlayerTag
              t={t}
              isHost={player.user_id === match.host_id}
              isMe={player.user_id === userId}
              isOffline={Boolean(online.length && !online.includes(player.user_id))}
            />
          }
        >
          <span
            className={`conquest-ready-label ${player.ready ? "is-ready" : ""}`}
            data-ready={player.ready ? "true" : "false"}
            title={player.ready ? t.ready : t.notReady}
          >
            <span className="conquest-ready-pip" aria-hidden="true" />
            <span className="sr-only">{player.ready ? t.ready : t.notReady}</span>
          </span>
        </ConquestPlayerChip>
      </SettingsRow>
    ))}
    {players.length < 2 && (
      <SettingsRow>
        <div className="conquest-player-chip conquest-player-chip--empty" aria-label={t.waiting}>
          <span className="conquest-swatch conquest-swatch--empty" aria-hidden="true" />
          <span className="conquest-player-name" aria-hidden="true">
            …
          </span>
          <span className="sr-only">{t.waiting}</span>
        </div>
      </SettingsRow>
    )}
  </SettingsSection>
);

const LobbyFooter = ({ t, isHost, me, allReady, busy, conquest }) => (
  <div className="conquest-lobby-footer">
    <ReadyButton
      t={t}
      ready={Boolean(me?.ready)}
      busy={busy}
      onToggle={() => conquest.setReady(!me?.ready)}
      emphasized={!(isHost && me?.ready && allReady)}
    />
    {isHost ? (
      <button
        type="button"
        className={`${me?.ready && allReady ? "btn-primary" : "btn-secondary"} conquest-block`}
        disabled={busy || !allReady}
        onClick={conquest.start}
        title={t.startMatchFull || t.startMatch}
      >
        {t.startMatch}
      </button>
    ) : (
      <p className="conquest-hint sr-only">{t.waitingHost}</p>
    )}
  </div>
);

/** Big "I'm ready" call to action; becomes "Prêt ✓ / Annuler" once pressed. */
export const ReadyButton = ({ t, ready, busy, onToggle, emphasized = true }) => (
  <button
    type="button"
    className={`conquest-ready-cta ${ready ? "is-ready" : ""} ${emphasized ? "" : "is-quiet"}`}
    aria-pressed={ready}
    disabled={busy}
    onClick={onToggle}
  >
    {ready ? (
      <>
        <span className="conquest-ready-cta-main">
          {t.ready}
          <span aria-hidden="true"> ✓</span>
        </span>
        <span className="conquest-ready-cta-sub">{t.cancelReady}</span>
      </>
    ) : (
      <span className="conquest-ready-cta-main">{t.imReady}</span>
    )}
  </button>
);

const ConquestLobby = ({ lang, conquest, onBack, onRules }) => {
  const t = conquestText(lang);
  const { match, players, userId, online, busy, error } = conquest;
  const isHost = match?.host_id === userId;
  const me = players.find((player) => player.user_id === userId);
  const allReady = players.length >= 2 && players.every((player) => player.ready);

  return (
    <div
      className={`conquest-panel conquest-surface px-cascade ${match ? "conquest-panel--room" : ""}`}
    >
      <header className="conquest-header">
        <div className="conquest-header-row">
          <h2 className="conquest-title">{t.title}</h2>
          {onRules && <ConquestRulesButton lang={lang} onClick={onRules} />}
        </div>
        <p className="conquest-subtitle sr-only">{t.subtitle}</p>
      </header>
      {!match ? (
        <LobbyEntry t={t} busy={busy} onCreate={conquest.create} onJoin={conquest.join} />
      ) : (
        <>
          <SettingsSection title={t.room} hideTitle>
            <RoomShare t={t} code={match.code} />
          </SettingsSection>
          <PlayerList t={t} players={players} match={match} userId={userId} online={online} />
          <LobbyFooter
            t={t}
            isHost={isHost}
            me={me}
            allReady={allReady}
            busy={busy}
            conquest={conquest}
          />
        </>
      )}
      {error &&
        (match ? (
          <p className="conquest-error">{error}</p>
        ) : (
          <AtlasState variant="error" title={error} hint={t.joinErrorHint} />
        ))}
      <button
        type="button"
        className="btn-secondary conquest-block"
        onClick={onBack}
        aria-label={match ? t.leave : t.back}
        title={match ? t.leave : t.back}
      >
        {match ? t.leave : t.back}
      </button>
    </div>
  );
};

export default ConquestLobby;
