import React from "react";

import IconButton from "./ui/IconButton";

/**
 * GlassIconButton — common primitive for header/bottom actions (settings, profile, leaderboard).
 * Thin wrapper around the shared kit IconButton (variant "glass", size "lg").
 * `label` (optional) renders a visible text label (home dock). Keeps .glass-icon-btn class so existing CSS selectors continue to match.
 */
const GlassIconButton = React.forwardRef(function GlassIconButton(
  { children, className = "", onClick, onPointerDown, title, label, style, ...rest },
  ref
) {
  const classes = ["glass-icon-btn", className].filter(Boolean).join(" ");
  const accessibleLabel = rest["aria-label"] ?? title ?? label;

  return (
    <IconButton
      ref={ref}
      variant="glass"
      size="lg"
      label={accessibleLabel}
      title={title}
      className={classes}
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={style}
      {...rest}
    >
      {children}
      {label && <span className="home-dock-label">{label}</span>}
    </IconButton>
  );
});

export default GlassIconButton;
