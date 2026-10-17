import "./StateViews.css";

import React from "react";

import StateBlock from "./StateBlock";

const DashedFrame = () => (
  <svg
    className="ui-state-glyph ui-state-glyph--dashed"
    viewBox="0 0 32 32"
    width="32"
    height="32"
    aria-hidden="true"
  >
    <rect
      x="4"
      y="4"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="4 3"
    />
  </svg>
);

export default function EmptyState({
  title,
  hint,
  icon,
  action,
  srOnly = false,
  className = "",
  ...rest
}) {
  const visual = icon ? (
    <span className="ui-state-glyph" aria-hidden="true">
      {icon}
    </span>
  ) : (
    <DashedFrame />
  );

  return (
    <StateBlock
      variant="empty"
      role="status"
      ariaLive="polite"
      title={title}
      hint={hint}
      srOnly={srOnly}
      visual={visual}
      action={action}
      className={className}
      {...rest}
    />
  );
}

export { EmptyState };
