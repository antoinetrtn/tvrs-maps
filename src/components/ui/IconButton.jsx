import "./Button.css";

import React from "react";

const VARIANTS = ["glass", "outline", "ghost", "danger"];
const SIZES = ["sm", "md", "lg"];

/**
 * IconButton — square icon-only button of the kit.
 *
 * - `label` is REQUIRED: it becomes `aria-label` and the native tooltip (`title`). In development
 *   a missing label is reported through `console.error` (the button still renders).
 * - `variant`: glass (solid glass surface, default) · outline (bordered, transparent) ·
 *   ghost (no chrome, e.g. close / back) · danger.
 * - `size`: sm = --control-sm · md = --control-md · lg = --control-lg (default).
 * - `type` defaults to "button".
 */
const IconButton = React.forwardRef(function IconButton(
  {
    label,
    variant = "glass",
    size = "lg",
    type = "button",
    className = "",
    title,
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
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      aria-label={label}
      title={title ?? label}
      {...rest}
    >
      {children}
    </button>
  );
});

export default IconButton;
