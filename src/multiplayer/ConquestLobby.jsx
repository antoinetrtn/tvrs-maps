import "./ConquestReady.css";

import { Copy, Crown, ExternalLink } from "pixelarticons/react";
import React, { useState } from "react";

import Button from "../components/ui/Button.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import IconButton from "../components/ui/IconButton.jsx";
import PanelCloseButton from "../components/ui/PanelCloseButton.jsx";
import { SettingsRow, SettingsSection } from "../components/ui/Settings.jsx";
import TextField from "../components/ui/TextField.jsx";
import { showToast } from "../components/ui/Toast.jsx";
import { buildConquestLink } from "./conquestLink";
import ConquestPlayerChip from "./ConquestPlayerChip.jsx";
import { ConquestRulesButton } from "./ConquestRulesSheet.jsx";
import { conquestText } from "./conquestText";

const LobbyEntry = ({ t, busy, onCreate, onJoin }) => {
  const [code, setCode] = useState("");
  return (
    <SettingsSection title={t.room} hideTitle>
      <Button
        variant="primary"
        block
        loading={busy}
        disabled={busy}
        onClick={onCreate}
        aria-label={t.createFull || t.create}
        title={t.createFull || t.create}
      >
        {t.create}
      </Button>
      <form
        className="conquest-join-form"
        onSubmit={(e) => {
          e.preventDefault();
          onJoin(code);
        }}
      >
        <TextField
          variant="outline"
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
        <Button
          type="submit"
          variant="secondary"
          loading={busy}
          disabled={busy || code.length < 6}
          aria-label={t.join}
          title={t.join}
        >
          {t.join}
        </Button>
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
  const onCopy = async () => {
    if (await copyRoomCode(buildConquestLink(code))) {
      showToast({ message: t.linkCopied, tone: "success", duration: 2200 });
    }
  };
  const onShare = async () => {
    const result = await shareRoomCode(code, globalThis.navigator, t.shareText(code));
    if (result === "copied") {
      showToast({ message: t.linkCopied, tone: "success", duration: 2200 });
    }
  };

  return (
    <SettingsRow layout="stacked">
      <div className="conquest-room-code">
        <span className="conquest-code" aria-label={t.roomCode}>
          {code}
        </span>
        <IconButton
          variant="outline"
          size="md"
          label={t.copyCode}
          look="conquest-copy"
          onClick={onCopy}
        >
          <Copy width={18} height={18} aria-hidden="true" />
        </IconButton>
        <Button
          variant="secondary"
          size="md"
          look="conquest-share"
          icon={<ExternalLink width={16} height={16} aria-hidden="true" />}
          onClick={onShare}
          aria-label={t.share}
          title={t.share}
        >
          <span>{t.share}</span>
        </Button>
      </div>
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
        <div
          className="conquest-player-chip conquest-player-chip--empty"
          role="status"
          aria-label={t.waiting}
        >
          <span className="conquest-swatch conquest-swatch--empty" aria-hidden="true" />
          <span className="conquest-player-waiting">{t.waiting}</span>
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
      <Button
        variant={me?.ready && allReady ? "primary" : "secondary"}
        block
        disabled={busy || !allReady}
        onClick={conquest.start}
        title={t.startMatchFull || t.startMatch}
      >
        {t.startMatch}
      </Button>
    ) : (
      <p className="conquest-hint">{t.waitingHost}</p>
    )}
  </div>
);

/** Big "I'm ready" call to action; becomes "Prêt ✓ / Annuler" once pressed. */
export const ReadyButton = ({ t, ready, busy, onToggle, emphasized = true }) => (
  <Button
    variant="primary"
    size="lg"
    block
    look="ready-cta"
    className={`${ready ? "is-ready" : ""} ${emphasized ? "" : "is-quiet"}`}
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
  </Button>
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
          <div className="conquest-header-actions">
            {onBack && <PanelCloseButton label={t.close} onClick={onBack} />}
          </div>
        </div>
        <p className="conquest-subtitle">
          {t.subtitle}
          {onRules && (
            <>
              {" · "}
              <ConquestRulesButton lang={lang} onClick={onRules} />
            </>
          )}
        </p>
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
      {error && <ErrorState title={error} hint={match ? undefined : t.joinErrorHint} />}
      <Button
        variant="secondary"
        block
        onClick={onBack}
        aria-label={match ? t.leave : t.back}
        title={match ? t.leave : t.back}
      >
        {match ? t.leave : t.back}
      </Button>
    </div>
  );
};

export default ConquestLobby;
