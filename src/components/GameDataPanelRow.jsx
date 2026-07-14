import React from "react";
import { Check, Minus } from "pixelarticons/react";
import { scrambleText } from "../utils/utils";

const GameDataPanelRow = ({
  row,
  isSelected,
  mode,
  onSelect,
  unrevealedLabel,
}) => {
  const displayName = row.revealed ? row.name : scrambleText(row.name || "");
  const displaySub = row.revealed
    ? row.sublabel
    : row.sublabel
      ? scrambleText(row.sublabel)
      : "";

  return (
    <button
      type="button"
      role="row"
      className={`data-panel-row ${row.found ? "found" : "missed"} ${isSelected ? "selected" : ""} ${row.revealed ? "revealed" : ""}`}
      onClick={() => onSelect(row.key)}
      title={row.revealed ? row.name : unrevealedLabel}
    >
      <span className="data-panel-row-status" aria-hidden="true">
        {mode === "learn" ? (
          <span className="status-dot" />
        ) : row.found ? (
          <Check width={14} height={14} />
        ) : (
          <Minus width={14} height={14} />
        )}
      </span>
      <span className="data-panel-row-name">{displayName}</span>
      {displaySub && <span className="data-panel-row-sub">{displaySub}</span>}
    </button>
  );
};

export default React.memo(GameDataPanelRow);