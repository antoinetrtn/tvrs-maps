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
  const showLearnStatus = mode === "learn" && !isSelected;
  const isLearnSelected = mode === "learn" && isSelected;

  return (
    <button
      type="button"
      role="row"
      data-country-key={row.key}
      className={`data-panel-row ${showFlag ? "has-flag" : ""} ${row.found ? "found" : "missed"} ${isSelected ? "selected" : ""} ${isRevealed ? "revealed" : ""} ${isLearnSelected ? "learn-selected" : ""}`}
      onClick={() => onSelect(row.key)}
      title={isRevealed ? row.name : unrevealedLabel}
    >
      {(mode !== "learn" || showLearnStatus) && (
        <span className="data-panel-row-status" aria-hidden="true">
          {mode === "learn" ? (
            <span className="status-dot" />
          ) : row.found ? (
            <Check width={14} height={14} />
          ) : (
            <Minus width={14} height={14} />
          )}
        </span>
      )}
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