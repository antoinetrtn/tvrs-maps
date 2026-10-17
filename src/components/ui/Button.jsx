import "./Button.css";

import React from "react";

const VARIANTS = ["primary", "secondary", "ghost", "danger"];
const SIZES = ["sm", "md", "lg"];

/**
 * Button — the single text-button primitive of the kit.
 *
 * - `variant`: primary (accent fill) · secondary (glass surface) · ghost (no chrome) · danger.
 * - `size`: sm · md (default) · lg.
 * - `block`: full-width.
 * - `loading`: keeps the label, shows a 3-cell stepped indicator, sets `aria-busy` and ignores
 *   clicks (it is NOT natively disabled, so focus is not lost mid-request).
 * - `type` defaults to "button" so a Button never submits a form by accident.
 * - `icon`: optional leading decorative node (aria-hidden).
 *
 * All states (hover, pressed, focus-visible, disabled, loading) live in Button.css and are
 * shared by every variant; screens only add layout deltas through `className`.
 */
const Button = React.forwardRef(function Button(
  {
    variant = "secondary",
    size = "md",
    block = false,
    loading = false,
    disabled = false,
    icon = null,
    type = "button",
    className = "",
    onClick,
    children,
    ...rest
  },
  ref
) {
  const safeVariant = VARIANTS.includes(variant) ? variant : "secondary";
  const safeSize = SIZES.includes(size) ? size : "md";
  const classes = [
    "ui-btn",
    `ui-btn--${safeVariant}`,
    `ui-btn--${safeSize}`,
    block && "ui-btn--block",
    loading && "is-loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = (event) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...rest}
    >
      {icon ? (
        <span className="ui-btn__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
});

export default Button;
