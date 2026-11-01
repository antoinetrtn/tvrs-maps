import React from "react";

import IconButton from "./ui/IconButton";

/**
 * GlassIconButton — common primitive for header/bottom actions (settings, profile, leaderboard).
 * Thin wrapper around the shared kit IconButton (variant "glass", size "lg").
 * `label` (optional) renders a visible text label (home dock). Its skin is the "glass-chrome" icon-button look (ButtonLooks.css / index.css).
 */
const GlassIconButton = React.forwardRef(function GlassIconButton(
  { children, className = "", look, onClick, onPointerDown, title, label, style, ...rest },
  ref
) {
  const accessibleLabel = rest["aria-label"] ?? title ?? label;

  return (
    <IconButton
      ref={ref}
      variant="glass"
      size="lg"
      label={accessibleLabel}
      title={title ?? (rest["data-tooltip"] ? null : undefined)}
      look={["glass-chrome", ...[look].flat().filter(Boolean)]}
      className={className || undefined}
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
