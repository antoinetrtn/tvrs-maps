// Subtle 1-step 2px square-pixel corner bevel (px-only geometry).

const CARD_PIXEL_CLIP_PATH = [
  "polygon(",
  "0 2px, 2px 2px, 2px 0,",
  "calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px,",
  "100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%,",
  "2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px)",
  ")",
].join(" ");

export const getModeClipPath = () => CARD_PIXEL_CLIP_PATH;
