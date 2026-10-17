import "./StateViews.css";

import React from "react";

import StateBlock from "./StateBlock";

const LoadingTrack = () => (
  <div className="ui-state-track" aria-hidden="true">
    <span className="ui-state-cell" />
    <span className="ui-state-cell" />
    <span className="ui-state-cell" />
    <span className="ui-state-cell" />
    <span className="ui-state-cell" />
    <span className="ui-state-runner" />
  </div>
);

export default function LoadingState({ title, hint, srOnly = false, className = "", ...rest }) {
  return (
    <StateBlock
      variant="loading"
      role="status"
      ariaLive="polite"
      title={title}
      hint={hint}
      srOnly={srOnly}
      visual={<LoadingTrack />}
      className={className}
      {...rest}
    />
  );
}
