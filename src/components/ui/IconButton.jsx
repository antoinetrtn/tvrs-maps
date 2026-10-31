import "./Button.css";
import "./IconButtonLooks.css";

import React from "react";

import { primeHapticsOnUserGesture, triggerSubtleHapticTick } from "../../utils/haptics";
import { ICON_LOOKS } from "./buttonLooks";

const VARIANTS = ["glass", "outline", "ghost", "danger"];
const SIZES = ["sm", "md", "lg"];

/**
 * IconButton — square icon-only button of the kit.
 *
 * - `title={null}` removes the native tooltip (when a custom `data-tooltip` is used).
 * - `label` is REQUIRED: it becomes `aria-label` and the native tooltip (`title`). In development
 *   a missing label is reported through `console.error` (the button still renders).
 * - `variant`: glass (solid glass surface, default) · outline (bordered, transparent) ·
 *   ghost (no chrome, e.g. close / back) · danger.
 * - `size`: sm = --control-sm · md = --control-md · lg = --control-lg (default).
 * - `look`: one or several named skins from ICON_LOOKS (IconButtonLooks.css).
 * - `type` defaults to "button".
 */
const IconButton = React.forwardRef(function IconButton(
  {
    label,
    variant = "glass",
    size = "lg",
    look,
    type = "button",
    className = "",
    title,
    onClick,
    children,
    ...rest
  },
  ref
) {
  if (!label && import.meta.env?.DEV) {
    console.error("IconButton: the `label` prop is required (accessible name).");
  }
  const safeVariant = VARIANTS.includes(variant) ? variant : "glass";
  const safeSize = SIZES.includes(size) ? size : "lg";
  const classes = [
    "ui-icon-btn",
    `ui-icon-btn--${safeVariant}`,
    `ui-icon-btn--${safeSize}`,
    ...[].concat(look || []).map((l) => {
      if (!ICON_LOOKS.includes(l) && import.meta.env?.DEV)
        console.error(`IconButton: unknown look "${l}"`);
      return ICON_LOOKS.includes(l) && `ui-icon-btn--${l}`;
    }),
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = (event) => {
    primeHapticsOnUserGesture();
    triggerSubtleHapticTick();
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      aria-label={label}
      title={title !== undefined ? title : label}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  );
});

export default IconButton;
