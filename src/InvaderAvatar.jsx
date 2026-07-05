import React from "react";
import { AVATAR_COLORS } from "./designSystem";

export const INVADER_DESIGNS = {
  invader_1: [
    "00100000100",
    "00010001000",
    "00111111100",
    "01101110110",
    "11111111111",
    "10111111101",
    "10100000101",
    "00011011000"
  ],
  invader_2: [
    "00011111000",
    "01111111110",
    "11100110011",
    "11111111111",
    "00011111000",
    "00110001100",
    "01100000110",
    "11000000011"
  ],
  invader_3: [
    "00001110000",
    "00111111100",
    "01111111110",
    "11011011011",
    "11111111111",
    "00110011000",
    "01101101100",
    "11000000110"
  ],
  invader_4: [
    "00001110000",
    "00011111000",
    "00110101100",
    "00111111100",
    "01110001110",
    "01000000010",
    "01100001100",
    "10010010010"
  ],
  invader_5: [
    "00111111100",
    "01111111110",
    "11001110011",
    "11111111111",
    "11111111111",
    "01100000110",
    "01100000110",
    "00110001100"
  ],
  invader_6: [
    "00011111000",
    "01111111110",
    "11011111011",
    "11111111111",
    "01111111110",
    "00101010100",
    "01001010010",
    "10000000001"
  ],
  invader_7: [
    "01100000110",
    "01101110110",
    "11111111111",
    "11011111011",
    "11111111111",
    "01111111110",
    "00100000100",
    "01100000110"
  ],
  invader_8: [
    "00011111000",
    "01111111110",
    "11110001111",
    "11110001111",
    "11111111111",
    "11111111111",
    "01101010110",
    "10001010001"
  ]
};

// AVATAR_COLORS is imported from designSystem to satisfy the lint rules

const InvaderAvatar = ({
  invaderId = "invader_1",
  color = "cyan",
  size = 48,
  className = ""
}) => {
  // Safe design retrieval with fallback
  const design = INVADER_DESIGNS[invaderId] || INVADER_DESIGNS.invader_1;
  const hexColor = AVATAR_COLORS[color] || color;

  // Build rectangles for pixels set to '1'
  const pixels = [];
  design.forEach((row, rowIndex) => {
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      if (row[colIndex] === "1") {
        pixels.push(
          <rect
            key={`${rowIndex}-${colIndex}`}
            x={colIndex}
            y={rowIndex}
            width={1}
            height={1}
          />
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
        shapeRendering: "crispEdges"
      }}
    >
      {pixels}
    </svg>
  );
};

export default React.memo(InvaderAvatar);
