import { InfoBox } from "pixelarticons/react";
import React from "react";

import Button from "./ui/Button";

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
  <Button
    variant="ghost"
    block
    className="continents-progress-bars"
    onClick={onViewTable}
    title={t("view_table")}
    ref={containerRef}
  >
    <span className="progress-bars-header">
      <span className="final-score-inline">
        {foundCount} / {total}
      </span>
      <span className="progress-info-icon">
        <InfoBox width={18} height={18} />
      </span>
    </span>

    <span className="progress-bars-grid">
      {order
        .filter((reg) => reg !== "Unknown" && stats[reg].total > 0)
        .map((region) => {
          const data = stats[region];
          const pct = Math.round((data.found / data.total) * 100);
          return (
            <span
              key={region}
              className="progress-item"
              style={{ "--continent-color": colors[region] || "var(--accent)" }}
            >
              <span className="progress-info">
                <span className="progress-title">
                  <span className="progress-dot" />
                  <span className="progress-label">{t(`region_${region}`) || region}</span>
                </span>
                <span className="progress-stats">
                  <span className="progress-track">
                    <span className="progress-fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="progress-count">
                    {data.found}/{data.total}
                  </span>
                </span>
              </span>
            </span>
          );
        })}
    </span>
  </Button>
);

export default React.memo(EndScreenContinents);
