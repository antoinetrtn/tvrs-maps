import { InfoBox } from "pixelarticons/react";
import React from "react";

const EndScreenContinents = ({
  stats,
  order,
  colors,
  foundCount,
  total,
  onViewTable,
  containerRef,
  t,
}) => (
  <div
    className="continents-progress-bars"
    role="button"
    tabIndex={0}
    onClick={onViewTable}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onViewTable?.();
      }
    }}
    title={t("view_table")}
    ref={containerRef}
  >
    <div className="progress-bars-header">
      <span className="final-score-inline">
        {foundCount} / {total}
      </span>
      <span className="progress-info-icon">
        <InfoBox width={18} height={18} />
      </span>
    </div>

    <div className="progress-bars-grid">
      {order
        .filter((reg) => reg !== "Unknown" && stats[reg].total > 0)
        .map((region) => {
          const data = stats[region];
          const pct = Math.round((data.found / data.total) * 100);
          return (
            <div
              key={region}
              className="progress-item"
              style={{ "--continent-color": colors[region] || "var(--accent)" }}
            >
              <div className="progress-info">
                <div className="progress-title">
                  <span className="progress-dot" />
                  <span className="progress-label">{t(`region_${region}`) || region}</span>
                </div>
                <div className="progress-stats">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="progress-count">
                    {data.found}/{data.total}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  </div>
);

export default React.memo(EndScreenContinents);
