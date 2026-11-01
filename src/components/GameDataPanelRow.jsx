import { Check, Minus } from "pixelarticons/react";
import React from "react";

import { scrambleText } from "../utils/utils";
import Pressable from "./ui/Pressable";

function renderRowStatus(mode, found) {
  if (mode === "learn") {
    return <span className="status-dot" />;
  }
  if (found) {
    return <Check width={14} height={14} />;
  }
  return <Minus width={14} height={14} />;
}

const GameDataPanelRow = ({ row, isSelected, mode, onSelect, unrevealedLabel }) => {
  const isRevealed = mode === "learn" || row.revealed;
  const displayName = isRevealed ? row.name : scrambleText(row.name || "");
  let displaySub = "";
  if (row.sublabel) {
    displaySub = isRevealed ? row.sublabel : scrambleText(row.sublabel);
  }
  // The flag is always visible (it already shows on the globe labels);
  // only the name stays scrambled until the country is found.
  const showFlag = Boolean(row.iso2);
  const isLearnSelected = mode === "learn" && isSelected;

  return (
    <Pressable
      type="button"
      role="row"
      data-country-key={row.key}
      className={`data-panel-row ${showFlag ? "has-flag" : ""} ${row.found ? "found" : "missed"} ${isSelected ? "selected" : ""} ${isRevealed ? "revealed" : ""} ${isLearnSelected ? "learn-selected" : ""}`}
      onClick={() => onSelect(row.key)}
      title={isRevealed ? row.name : unrevealedLabel}
    >
      <span className="data-panel-row-status" aria-hidden="true">
        {renderRowStatus(mode, row.found)}
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
    </Pressable>
  );
};

export default React.memo(GameDataPanelRow);
