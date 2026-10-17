const FONT_MAP = {
  0: ["###", "#.#", "#.#", "#.#", "###"],
  1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["###", "..#", "###", "#..", "###"],
  3: ["###", "..#", "###", "..#", "###"],
  4: ["#.#", "#.#", "###", "..#", "..#"],
  5: ["###", "#..", "###", "..#", "###"],
  6: ["###", "#..", "###", "#.#", "###"],
  7: ["###", "..#", "..#", "..#", "..#"],
  8: ["###", "#.#", "###", "#.#", "###"],
  9: ["###", "#.#", "###", "..#", "###"],
  "+": ["...", ".#.", "###", ".#.", "..."],
  "-": ["...", "...", "###", "...", "..."],
  x: ["...", "#.#", ".#.", "#.#", "..."],
  s: ["###", "#..", "###", "..#", "###"],
  " ": ["...", "...", "...", "...", "..."],
};

function getCharRects(char, charIdx, startX, startY, unit) {
  const bitmap = FONT_MAP[char];
  if (!bitmap) {
    return [];
  }
  const rects = [];
  const charX = startX + charIdx * 4 * unit;
  for (let row = 0; row < 5; row += 1) {
    const rowStr = bitmap[row];
    for (let col = 0; col < 3; col += 1) {
      if (rowStr[col] === "#") {
        rects.push(
          <rect
            key={`${charIdx}-${row}-${col}`}
            x={charX + col * unit}
            y={startY + row * unit}
            width={unit}
            height={unit}
          />
        );
      }
    }
  }
  return rects;
}

export function PixelText({ text = "", x = 0, y = 0, unit = 1, fill = "currentColor", className }) {
  const chars = String(text).split("");
  const rects = chars.flatMap((char, charIdx) => getCharRects(char, charIdx, x, y, unit));

  return (
    <g className={className} fill={fill}>
      {rects}
    </g>
  );
}
