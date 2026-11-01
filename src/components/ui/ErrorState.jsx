import "./StateViews.css";

import { SquareAlert } from "pixelarticons/react";
import React from "react";

import Button from "./Button";
import StateBlock from "./StateBlock";

export default function ErrorState({
  title,
  hint,
  icon,
  onRetry,
  retryLabel = "Réessayer",
  action,
  srOnly = false,
  className = "",
  ...rest
}) {
  let visual = (
    <span className="ui-state-glyph" aria-hidden="true">
      <SquareAlert width={24} height={24} />
    </span>
  );
  if (icon !== undefined) {
    visual = icon ? (
      <span className="ui-state-glyph" aria-hidden="true">
        {icon}
      </span>
    ) : null;
  }

  let actionNode = null;
  if (action !== undefined) {
    actionNode = action;
  } else if (onRetry) {
    actionNode = (
      <Button variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
    );
  }

  return (
    <StateBlock
      variant="error"
      role="alert"
      ariaLive="polite"
      title={title}
      hint={hint}
      srOnly={srOnly}
      visual={visual}
      action={actionNode}
      className={className}
      {...rest}
    />
  );
}
