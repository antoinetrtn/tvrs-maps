import React from "react";

/**
 * StateBlock — internal foundation for LoadingState, EmptyState, and ErrorState.
 * Handles container classes, accessibility roles/aria-live, srOnly behavior,
 * and standard slots (visual, title, hint, action).
 */
export default function StateBlock({
  variant = "empty",
  role = "status",
  ariaLive = "polite",
  title,
  hint,
  srOnly = false,
  visual,
  action,
  className = "",
  ...rest
}) {
  const rootTitle = rest.title ?? (srOnly && typeof title === "string" ? title : undefined);

  return (
    <div
      className={["ui-state", `ui-state--${variant}`, className].filter(Boolean).join(" ")}
      role={role}
      aria-live={ariaLive || undefined}
      title={rootTitle}
      {...rest}
    >
      {visual ? <div className="ui-state-visual">{visual}</div> : null}
      {title ? (
        <p className={["ui-state-title", srOnly ? "sr-only" : null].filter(Boolean).join(" ")}>
          {title}
        </p>
      ) : null}
      {hint ? (
        <p className={["ui-state-hint", srOnly ? "sr-only" : null].filter(Boolean).join(" ")}>
          {hint}
        </p>
      ) : null}
      {action ? <div className="ui-state-action">{action}</div> : null}
    </div>
  );
}
