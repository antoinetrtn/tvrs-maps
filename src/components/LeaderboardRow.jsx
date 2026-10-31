import "./LeaderboardRow.css";

import React from "react";

/**
 * LeaderboardRow — one list row shared by every leaderboard tab
 * (global records, personal history, Conquête Elo).
 * Layout: rank · [avatar] name + sub-line · main stat + secondary stat.
 */
const LeaderboardRow = ({
  rank,
  podium = false,
  avatar = null,
  name,
  sub = null,
  stat,
  meta = null,
  trend = null,
  isMe = false,
  youLabel = "",
}) => (
  <li className={`lb-row ${isMe ? "is-me" : ""}`}>
    <span className={`lb-rank ${podium ? `is-podium rank-${rank}` : ""}`}>{rank}</span>
    <span className="lb-who">
      {avatar}
      <span className="lb-name-block">
        <span className="lb-name">
          <span className="lb-name-text">{name}</span>
          {isMe && youLabel ? <span className="lb-you">{youLabel}</span> : null}
        </span>
        {sub ? <span className="lb-sub">{sub}</span> : null}
      </span>
    </span>
    <span className="lb-stats">
      <span className="lb-stat">{stat}</span>
      {meta ? <span className="lb-meta">{meta}</span> : null}
    </span>
    {trend}
  </li>
);

/** Wrapper list so all tabs share spacing and scrolling. */
export const LeaderboardList = ({ children, label }) => (
  <ul className="lb-list px-cascade scrollbar-styled" aria-label={label}>
    {children}
  </ul>
);

/** Inline notice used for the guest sign-in prompt. */
export const LeaderboardNotice = ({ children, className = "", ...props }) => (
  <p className={`lb-notice ${className}`} {...props}>
    {children}
  </p>
);

export default LeaderboardRow;
