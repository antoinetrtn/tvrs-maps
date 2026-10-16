import "./ConquestReady.css";

import { Copy, ExternalLink } from "pixelarticons/react";
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
    <SettingsRow label={t.roomCode} layout="stacked">
      <div className="conquest-room-code">
        <span className="conquest-code">{code}</span>
        <button
          type="button"
          className="conquest-icon-btn"
          onClick={onCopy}
          aria-label={t.copyLink}
          title={t.copyLink}
        >
          <Copy width={18} height={18} />
        </button>
        <button type="button" className="btn-secondary conquest-share-btn" onClick={onShare}>
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

const playerTags = (t, player, match, userId, online) =>
  [
    player.user_id === match.host_id ? t.host : null,
    player.user_id === userId ? t.you : null,
    online.length && !online.includes(player.user_id) ? t.offline : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
                  <span
                    className={`conquest-ready-label ${player.ready ? "is-ready" : ""}`}
                    data-ready={player.ready ? "true" : "false"}
                  >
                    <span className="conquest-ready-pip" aria-hidden="true" />
                    {player.ready ? t.ready : t.notReady}
                  </span>
                </ConquestPlayerChip>
              </SettingsRow>
            ))}
            {players.length < 2 && <p className="conquest-hint">{t.waiting}</p>}
          </SettingsSection>
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
              >
                {t.startMatch}
              </button>
            ) : (
              <p className="conquest-hint">{t.waitingHost}</p>
            )}
          </div>
        </>
      )}
      {error &&
        (match ? (
          <p className="conquest-error">{error}</p>
        ) : (
          <AtlasState variant="error" title={error} hint={t.joinErrorHint} />
        ))}
      <button type="button" className="btn-secondary conquest-block" onClick={onBack}>
        {match ? t.leave : t.back}
      </button>
    </div>
  );
};

export default ConquestLobby;
