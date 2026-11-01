import "./XpBar.css";

import React from "react";

const XpBar = ({ percent = 0, variant = "bar", cells, label, className = "", style, ...rest }) => {
  const numeric = typeof percent === "number" ? percent : Number(percent);
  const clampedPercent = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
  const roundedPercent = Math.round(clampedPercent);

  const defaultCells = variant === "mini" ? 8 : 20;
  const totalCells = Number.isInteger(cells) && cells > 0 ? cells : defaultCells;

  const filledCells =
    clampedPercent <= 0
      ? 0
      : Math.min(totalCells, Math.max(1, Math.floor(clampedPercent / (100 / totalCells))));

  const xPercent = 100 - (filledCells * 100) / totalCells;

  return (
    <div
      role="progressbar" // NOSONAR
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={roundedPercent}
      aria-label={label}
      className={`xp-bar xp-bar-${variant} ${className}`.trim()}
      style={{
        "--xp-cells": totalCells,
        ...style,
      }}
      {...rest}
    >
      <div className="xp-bar-track" />
      <div
        className="xp-bar-fill"
        style={{
          clipPath: `inset(0 ${xPercent}% 0 0)`,
        }}
      />
    </div>
  );
};

export default React.memo(XpBar);
