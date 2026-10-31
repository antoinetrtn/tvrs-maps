// Clean, symmetrical 2-step 4px square-pixel corner bevel (8px x 8px)
// + 100% square-pixel corner brackets and bezel-set top/bottom crests.

const CARD_PIXEL_CLIP_PATH = [
  "polygon(",
  "0 8px, 4px 8px, 4px 4px, 8px 4px, 8px 0,",
  "calc(100% - 8px) 0, calc(100% - 8px) 4px, calc(100% - 4px) 4px, calc(100% - 4px) 8px, 100% 8px,",
  "100% calc(100% - 8px), calc(100% - 4px) calc(100% - 8px), calc(100% - 4px) calc(100% - 4px), calc(100% - 8px) calc(100% - 4px), calc(100% - 8px) 100%,",
  "8px 100%, 8px calc(100% - 4px), 4px calc(100% - 4px), 4px calc(100% - 8px), 0 calc(100% - 8px)",
  ")",
].join(" ");

export const getModeClipPath = () => CARD_PIXEL_CLIP_PATH;

// Rendered in a 24px x 24px SVG (viewBox="0 0 12 12", 1 unit = 2px x 2px square)
export const OUTER_CORNER_STEP_RECTS = [
  [4, 0, 8, 1],
  [2, 2, 2, 1],
  [3, 1, 1, 1],
  [1, 3, 1, 1],
  [2, 2, 1, 2],
  [0, 4, 1, 8],
];

export const MODE_CORNER_MOTIFS = {
  // 1. Conquête 1v1 — Amber L-bracket + Cyan duel core square (2x2 units = 4px x 4px square)
  conquest: [
    [4, 4, 5, 1, "primary"],
    [4, 5, 1, 4, "primary"],
    [6, 6, 2, 2, "secondary"],
    [9, 3, 2, 2, "spark"],
    [3, 9, 2, 2, "spark"],
  ],
  // 2. Pays du Monde — Classic Atlas Greek-key square corner
  countries: [
    [4, 4, 6, 1, "primary"],
    [4, 5, 1, 5, "primary"],
    [6, 6, 2, 2, "spark"],
    [9, 3, 2, 2, "secondary"],
    [3, 9, 2, 2, "secondary"],
  ],
  // 3. Capitales du Monde — Corner bracket + 4-point star diamond
  capitals: [
    [4, 4, 4, 1, "primary"],
    [4, 5, 1, 3, "primary"],
    [7, 6, 1, 3, "spark"],
    [6, 7, 3, 1, "spark"],
    [9, 3, 2, 2, "primary"],
    [3, 9, 2, 2, "primary"],
  ],
  // 4. Départements Français — Tricolor 3-square corner bar (Blue, Ivory, Red — each 2x2 = 4px square)
  departments: [
    [4, 4, 2, 2, "primary"],
    [6, 4, 2, 2, "spark"],
    [4, 6, 2, 2, "secondary"],
    [9, 3, 2, 2, "primary"],
    [3, 9, 2, 2, "secondary"],
  ],
  // 5. États Américains — Western double corner bracket + star stud
  us_states: [
    [4, 4, 5, 1, "primary"],
    [4, 5, 1, 4, "primary"],
    [6, 6, 2, 2, "spark"],
    [9, 3, 2, 2, "secondary"],
    [3, 9, 2, 2, "secondary"],
  ],
  // 6. Montagnes & Fleuves — Twin stepped chevron bracket (Glacier Cyan + Alpine Ochre)
  rivers_mountains: [
    [4, 4, 5, 1, "primary"],
    [4, 5, 1, 4, "primary"],
    [6, 6, 3, 1, "secondary"],
    [6, 7, 1, 2, "secondary"],
    [9, 3, 2, 2, "spark"],
    [3, 9, 2, 2, "spark"],
  ],
};

// Bezel-set centered crest (viewBox="0 0 24 4", width="48" height="8", 1 unit = 2px x 2px square)
// Sits cleanly inside the 6px bezel between the outer 2px border and inner 6px frame!
export const MODE_BEZEL_CRESTS = {
  conquest: [
    [2, 1, 2, 2, "primary"],
    [6, 1, 2, 2, "secondary"],
    [11, 1, 2, 2, "spark"],
    [16, 1, 2, 2, "primary"],
    [20, 1, 2, 2, "secondary"],
  ],
  countries: [
    [3, 1, 2, 2, "secondary"],
    [7, 1, 2, 2, "primary"],
    [11, 1, 2, 2, "spark"],
    [15, 1, 2, 2, "primary"],
    [19, 1, 2, 2, "secondary"],
  ],
  capitals: [
    [2, 1, 2, 2, "spark"],
    [7, 1, 2, 2, "primary"],
    [11, 1, 2, 2, "spark"],
    [15, 1, 2, 2, "primary"],
    [20, 1, 2, 2, "spark"],
  ],
  departments: [
    [4, 1, 2, 2, "primary"],
    [8, 1, 2, 2, "primary"],
    [11, 1, 2, 2, "spark"],
    [14, 1, 2, 2, "secondary"],
    [18, 1, 2, 2, "secondary"],
  ],
  us_states: [
    [2, 1, 2, 2, "spark"],
    [6, 1, 2, 2, "primary"],
    [11, 1, 2, 2, "spark"],
    [16, 1, 2, 2, "primary"],
    [20, 1, 2, 2, "spark"],
  ],
  rivers_mountains: [
    [3, 1, 2, 2, "primary"],
    [7, 1, 2, 2, "secondary"],
    [11, 1, 2, 2, "spark"],
    [15, 1, 2, 2, "secondary"],
    [19, 1, 2, 2, "primary"],
  ],
};
