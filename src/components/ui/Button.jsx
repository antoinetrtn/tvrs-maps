import "./Button.css";
import "./ButtonLooks.css";

import React from "react";

import { primeHapticsOnUserGesture, triggerSubtleHapticTick } from "../../utils/haptics";
import { LOOKS } from "./buttonLooks";

const VARIANTS = new Set(["primary", "secondary", "ghost", "danger"]);
const SIZES = new Set(["sm", "md", "lg"]);

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
 * - `look`: one or several named skins from LOOKS (ButtonLooks.css), e.g. look={["tile", "tile-train"]}.
 */
const Button = React.forwardRef(function Button(
  {
    variant = "secondary",
    size = "md",
    block = false,
    look,
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
  const safeVariant = VARIANTS.has(variant) ? variant : "secondary";
  const safeSize = SIZES.has(size) ? size : "md";
  const classes = [
    "ui-btn",
    `ui-btn--${safeVariant}`,
    `ui-btn--${safeSize}`,
    block && "ui-btn--block",
    ...[look]
      .flat()
      .filter(Boolean)
      .map((l) => {
        if (!LOOKS.includes(l) && import.meta.env?.DEV)
          console.error(`Button: unknown look "${l}"`);
        return LOOKS.includes(l) && `ui-btn--${l}`;
      }),
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
    primeHapticsOnUserGesture();
    triggerSubtleHapticTick();
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
