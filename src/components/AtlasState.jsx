import "./AtlasState.css";

import React from "react";

/**
 * AtlasState — shared loading / empty / error placeholder in the atlas style.
 * loading: a compass rose whose needle sweeps; empty: a dashed "terra incognita"
 * coastline; error: the same coastline inked in the error colour.
 */
const CompassRose = () => (
  <svg className="atlas-state-compass" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="21" className="atlas-state-ring" />
    <circle cx="24" cy="24" r="16" className="atlas-state-ring atlas-state-ring--inner" />
    <g className="atlas-state-needle">
      <path d="M24 6 L28 24 L24 22 L20 24 Z" className="atlas-state-needle-north" />
      <path d="M24 42 L20 24 L24 26 L28 24 Z" className="atlas-state-needle-south" />
    </g>
    <circle cx="24" cy="24" r="1.6" className="atlas-state-pin" />
  </svg>
);

const Coastline = () => (
  <svg className="atlas-state-coast" viewBox="0 0 64 40" aria-hidden="true">
    <path
      d="M6 28 C10 18 18 22 22 14 S34 6 38 12 S50 10 54 18 S58 30 50 32 S36 30 30 34 S14 36 6 28 Z"
      className="atlas-state-coast-path"
    />
    <path d="M44 22 l4 4 M48 22 l-4 4" className="atlas-state-cross" />
  </svg>
);

const AtlasState = ({ variant = "empty", title, hint, srOnly = false }) => (
  <div
    className={`atlas-state atlas-state--${variant}`}
    role={variant === "error" ? "alert" : "status"}
    aria-live="polite"
    title={srOnly && title ? title : undefined}
  >
    {variant === "loading" ? <CompassRose /> : <Coastline />}
    {title && <p className={`atlas-state-title ${srOnly ? "sr-only" : ""}`}>{title}</p>}
    {hint && <p className={`atlas-state-hint ${srOnly ? "sr-only" : ""}`}>{hint}</p>}
  </div>
);

export default AtlasState;
