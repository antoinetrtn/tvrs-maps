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
  const visual =
    icon !== undefined ? (
      icon ? (
        <span className="ui-state-glyph" aria-hidden="true">
          {icon}
        </span>
      ) : null
    ) : (
      <span className="ui-state-glyph" aria-hidden="true">
        <SquareAlert width={24} height={24} />
      </span>
    );

  const actionNode =
    action !== undefined ? (
      action
    ) : onRetry ? (
      <Button variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
    ) : null;

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
