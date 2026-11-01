import React from "react";

import Button from "../components/ui/Button.jsx";
import { formatClock, getPaletteEntry } from "./conquestLogic";

const CountryIcon = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 10 10"
    fill="currentColor"
    shapeRendering="crispEdges"
    aria-hidden="true"
    className="conquest-country-icon"
  >
    <path d="M3 1h4v1H3V1zm-2 2h8v1H1V3zm-1 2h10v1H0V5zm1 2h8v1H1V7zm2 2h4v1H3V9zm2-7h1v8H5V2z" />
  </svg>
);

const HudScoreLine = ({ player, t }) => {
  const scoreAria = `${player.total} ${t.pts}, ${player.countries} ${t.countries}${
    player.bonus ? `, +${player.bonus}` : ""
  }`;

  return (
    <div
      role="img"
      className="conquest-score conquest-hud-score"
      aria-label={scoreAria}
      title={scoreAria}
    >
      <span className="conquest-hud-score-total">{player.total}</span>
      <span className="conquest-hud-score-sep" aria-hidden="true">
        {" · "}
      </span>
      <CountryIcon />
      <span className="conquest-hud-score-count"> {player.countries}</span>
      {player.bonus > 0 ? <span className="conquest-hud-score-bonus"> +{player.bonus}</span> : null}
    </div>
  );
};

const HudPlayerChip = ({ player, isMe, isLeader, t }) => {
  const entry = getPaletteEntry(player.color);
  return (
    <div
      className={`conquest-hud-chip ${isLeader ? "is-leader" : ""} ${
        isMe ? "is-me" : "is-opponent"
      }`}
    >
      <div className="conquest-hud-chip-head">
        <span
          className={`conquest-swatch pattern-${entry.pattern}`}
          style={{ "--player-color": entry.hex }}
          aria-hidden="true"
        />
        <span className="conquest-player-name">{player.display_name}</span>
        {isMe ? <span className="conquest-player-tag">{t.you}</span> : null}
      </div>
      <HudScoreLine player={player} t={t} />
    </div>
  );
};

export const HudTopBar = ({ standings, userId, phase, clockMs, t }) => {
  const me = standings.find((p) => p.user_id === userId) || standings[0];
  const opponents = standings.filter((p) => p.user_id !== me?.user_id);
  const maxTotal = standings.length > 0 ? Math.max(...standings.map((p) => p.total ?? 0)) : -1;
  const isLeader = (player) =>
    maxTotal > 0 &&
    player.total === maxTotal &&
    standings.filter((p) => (p.total ?? 0) === maxTotal).length === 1;

  const isUrgent = clockMs <= 120000;

  return (
    <div className="conquest-hud-top conquest-surface">
      <div className="conquest-hud-col conquest-hud-col-me">
        {me ? (
          <HudPlayerChip player={me} isMe={me.user_id === userId} isLeader={isLeader(me)} t={t} />
        ) : null}
      </div>
      <div className="conquest-hud-col conquest-hud-col-timer">
        <div className={`conquest-timer ${isUrgent ? "is-urgent" : ""}`}>
          {phase === "countdown" ? (
            <>
              <span className="conquest-countdown-label">{t.countdown}</span>
              <span className="conquest-timer-value">{Math.ceil(clockMs / 1000)}</span>
            </>
          ) : (
            formatClock(clockMs)
          )}
        </div>
      </div>
      <div className="conquest-hud-col conquest-hud-col-opponents">
        {opponents.map((opponent) => (
          <HudPlayerChip
            key={opponent.user_id}
            player={opponent}
            isMe={false}
            isLeader={isLeader(opponent)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
};

export const HudFeed = ({ feed, onFocusCountry, t }) => (
  <aside className="conquest-feed conquest-surface" aria-live="polite">
    <span className="conquest-sr-only">{t.feed}</span>
    {feed.length === 0 ? <p className="conquest-feed-empty">{t.feedEmpty}</p> : null}
    <ul>
      {feed.map((line) => (
        <li key={line.id}>
          {line.countryId ? (
            <Button
              variant="ghost"
              size="sm"
              look="feed-line"
              onClick={() => onFocusCountry(line.countryId)}
            >
              {line.actorColor ? (
                <span
                  className="conquest-feed-swatch"
                  style={{ "--actor-color": line.actorColor }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="conquest-feed-text">{line.text}</span>
            </Button>
          ) : (
            <span className="conquest-feed-line-text">
              {line.actorColor ? (
                <span
                  className="conquest-feed-swatch"
                  style={{ "--actor-color": line.actorColor }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="conquest-feed-text">{line.text}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  </aside>
);
