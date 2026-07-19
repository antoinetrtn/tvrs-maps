import React from "react";

import { AVATAR_COLORS } from "../config/designSystem";

const INVADER_DESIGNS = {
  invader_1: [
    "00100000100",
    "00010001000",
    "00111111100",
    "01101110110",
    "11111111111",
    "10111111101",
    "10100000101",
    "00011011000",
  ],
  invader_2: [
    "00011111000",
    "01111111110",
    "11100110011",
    "11111111111",
    "00011111000",
    "00110001100",
    "01100000110",
    "11000000011",
  ],
  invader_3: [
    "00001110000",
    "00111111100",
    "01111111110",
    "11011011011",
    "11111111111",
    "00110011000",
    "01101101100",
    "11000000110",
  ],
  invader_4: [
    "00001110000",
    "00011111000",
    "00110101100",
    "00111111100",
    "01110001110",
    "01000000010",
    "01100001100",
    "10010010010",
  ],
  invader_5: [
    "00111111100",
    "01111111110",
    "11001110011",
    "11111111111",
    "11111111111",
    "01100000110",
    "01100000110",
    "00110001100",
  ],
  invader_6: [
    "00011111000",
    "01111111110",
    "11011111011",
    "11111111111",
    "01111111110",
    "00101010100",
    "01001010010",
    "10000000001",
  ],
  invader_7: [
    "01100000110",
    "01101110110",
    "11111111111",
    "11011111011",
    "11111111111",
    "01111111110",
    "00100000100",
    "01100000110",
  ],
  invader_8: [
    "00011111000",
    "01111111110",
    "11110001111",
    "11110001111",
    "11111111111",
    "11111111111",
    "01101010110",
    "10001010001",
  ],
  invader_9: [
    "00011111000",
    "00100000100",
    "01010001010",
    "10001110001",
    "10111111101",
    "10011111001",
    "01000000010",
    "00110001100",
  ],
  invader_10: [
    "00100000100",
    "10010001001",
    "10111111101",
    "11101110111",
    "11111111111",
    "01111111110",
    "00100000100",
    "01000000010",
  ],
  invader_11: [
    "01111111110",
    "10000000001",
    "10100000101",
    "10100100101",
    "10001110001",
    "10100000101",
    "10011111001",
    "01100000110",
  ],
  invader_12: [
    "00001110000",
    "00111111100",
    "01101110110",
    "11111111111",
    "10111111101",
    "00100000100",
    "01010001010",
    "10000000001",
  ],
};

/* eslint-disable react-refresh/only-export-components -- shared design helper for avatar variants */
export const getProceduralDesign = (id) => {
  if (!id) return INVADER_DESIGNS.invader_1;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  const design = [];
  for (let r = 0; r < 8; r++) {
    const halfRow = [];
    for (let c = 0; c < 6; c++) {
      // Deterministic pseudo-randomness based on ID
      const x = Math.sin(hash + r * 17 + c * 31) * 10000;
      const rand = x - Math.floor(x);

      let threshold = 0.52;
      if (r === 0) threshold = 0.72; // antennae
      if (r === 7) threshold = 0.65; // feet
      if (c === 0) threshold = 0.68; // edges

      halfRow.push(rand > threshold ? "1" : "0");
    }

    // Mirror design: columns 0-4, column 5 (center), columns 4-0
    const fullRow = [
      halfRow[0],
      halfRow[1],
      halfRow[2],
      halfRow[3],
      halfRow[4],
      halfRow[5],
      halfRow[4],
      halfRow[3],
      halfRow[2],
      halfRow[1],
      halfRow[0],
    ].join("");

    design.push(fullRow);
  }

  // Count total pixels to make sure it looks reasonable
  let totalPixels = 0;
  design.forEach((row) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === "1") totalPixels++;
    }
  });

  if (totalPixels < 12 || totalPixels > 60) {
    // Fallback invader
    return [
      "00100000100",
      "00010001000",
      "00111111100",
      "01101110110",
      "11111111111",
      "10111111101",
      "10100000101",
      "00011011000",
    ];
  }
  return design;
};

// AVATAR_COLORS is imported from designSystem to satisfy the lint rules

const InvaderAvatar = ({ invaderId = "invader_1", color = "cyan", size = 48, className = "" }) => {
  // Safe design retrieval with fallback
  const design = INVADER_DESIGNS[invaderId] || getProceduralDesign(invaderId);
  const hexColor = AVATAR_COLORS[color] || color;

  // Build rectangles for pixels set to '1'
  const pixels = [];
  design.forEach((row, rowIndex) => {
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      if (row[colIndex] === "1") {
        pixels.push(
          <rect key={`${rowIndex}-${colIndex}`} x={colIndex} y={rowIndex} width={1} height={1} />
        );
      }
    }
  });

  return (
    <svg
      viewBox="0 0 11 8"
      width={size}
      height={Math.round((size * 8) / 11)}
      className={`invader-avatar ${className}`}
      style={{
        fill: hexColor,
        display: "inline-block",
        verticalAlign: "middle",
        shapeRendering: "crispEdges",
      }}
    >
      {pixels}
    </svg>
  );
};

export default React.memo(InvaderAvatar);
