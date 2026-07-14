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
  const isRevealed = mode === "learn" || row.revealed;
  const displayName = isRevealed ? row.name : scrambleText(row.name || "");
  const displaySub = isRevealed
    ? row.sublabel
    : row.sublabel
      ? scrambleText(row.sublabel)
      : "";
  const showFlag = row.iso2 && (mode === "learn" || isRevealed);

  return (
    <button
      type="button"
      role="row"
      data-country-key={row.key}
      className={`data-panel-row ${showFlag ? "has-flag" : ""} ${row.found ? "found" : "missed"} ${isSelected ? "selected" : ""} ${isRevealed ? "revealed" : ""}`}
      onClick={() => onSelect(row.key)}
      title={isRevealed ? row.name : unrevealedLabel}
    >
      <span className="data-panel-row-status" aria-hidden="true">
        {mode === "learn" ? (
          !isSelected ? <span className="status-dot" /> : null
        ) : row.found ? (
          <Check width={14} height={14} />
        ) : (
          <Minus width={14} height={14} />
        )}
      </span>
      {showFlag && (
        <img
          src={`/flags/${row.iso2.toLowerCase()}.svg`}
          className="data-panel-row-flag"
          alt=""
          width={28}
          height={21}
        />
      )}
      <span className="data-panel-row-name">{displayName}</span>
      {displaySub && <span className="data-panel-row-sub">{displaySub}</span>}
    </button>
  );
};

export default React.memo(GameDataPanelRow);