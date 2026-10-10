import React from "react";

import { getPaletteEntry } from "./conquestLogic";

/** Colour swatch + pattern (colour-blind friendly) + name, shared by lobby/HUD/end screen. */
const ConquestPlayerChip = ({ player, tag, children }) => {
  const entry = getPaletteEntry(player.color);
  return (
    <div className="conquest-player-chip">
      <span
        className={`conquest-swatch pattern-${entry.pattern}`}
        style={{ "--player-color": entry.hex }}
        aria-hidden="true"
      />
      <span className="conquest-player-name">{player.display_name}</span>
      {tag ? <span className="conquest-player-tag">{tag}</span> : null}
      {children}
    </div>
  );
};

export default ConquestPlayerChip;
