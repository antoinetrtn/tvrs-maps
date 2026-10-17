import { Close } from "pixelarticons/react";
import React from "react";

import IconButton from "./IconButton";

/**
 * PanelCloseButton — the ghost "×" shared by every panel header (settings, profile,
 * leaderboard, data panel, auth). `label` is the accessible name (already translated).
 * `stopPropagation` keeps a click from reaching the globe layer behind the panel.
 */
export default function PanelCloseButton({
  label,
  onClick,
  iconSize = 20,
  stopPropagation = false,
  ...rest
}) {
  return (
    <IconButton
      variant="ghost"
      size="sm"
      label={label}
      className="panel-close-btn"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onClick?.(e);
      }}
      {...rest}
    >
      <Close width={iconSize} height={iconSize} />
    </IconButton>
  );
}
