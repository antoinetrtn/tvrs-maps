import React from "react";

/**
 * GlassIconButton — common primitive for header/bottom actions (settings, profile, leaderboard).
 * Guarantees consistent glass, blur, hover/active, size.
 * Use for any "icon in glass" trigger to prevent future style drift.
 */
const GlassIconButton = React.forwardRef(function GlassIconButton(
  { children, className = "", onClick, onPointerDown, title, style, ...rest },
  ref
) {
  const classes = ["glass-icon-btn", className].filter(Boolean).join(" ");
  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      onClick={onClick}
      onPointerDown={onPointerDown}
      title={title}
      style={style}
      {...rest}
    >
      {children}
    </button>
  );
});

export default GlassIconButton;
