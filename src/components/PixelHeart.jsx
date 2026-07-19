// Filled pixel-art heart matching the pixelarticons `Heart` silhouette.
// pixelarticons' own `Heart` only strokes the outline (hollow interior), which
// reads as a contour. Hardcore lives need a solid fill, so we redraw the same
// 24x24 / 2px-pixel silhouette but filled edge-to-edge.
const ROWS = [
  { x: 5, w: 4, y: 2, h: 2 },
  { x: 15, w: 4, y: 2, h: 2 },
  { x: 3, w: 8, y: 4, h: 2 },
  { x: 13, w: 8, y: 4, h: 2 },
  { x: 1, w: 22, y: 6, h: 6 },
  { x: 3, w: 18, y: 12, h: 2 },
  { x: 5, w: 14, y: 14, h: 2 },
  { x: 7, w: 10, y: 16, h: 2 },
  { x: 9, w: 6, y: 18, h: 2 },
  { x: 11, w: 2, y: 20, h: 2 },
];

export const PixelHeart = ({ width = 24, height = 24, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    {ROWS.map((r, i) => (
      <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
    ))}
  </svg>
);
