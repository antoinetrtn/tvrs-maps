import "./CardLooks.css";

import React from "react";

import { CARD_LOOKS } from "./cardLooks";

/**
 * Card — the kit's single content surface (stat tiles, XP cards, rules cards, mode cards).
 *
 * - `as`: element to render (default "div"; e.g. "article").
 * - `look`: one or several named skins from CARD_LOOKS, defined once in CardLooks.css.
 * - `glass`: adds the shared `.glass-panel` surface (index.css).
 * Screens only add layout deltas through `className`; they never restyle a card themselves.
 */
const Card = React.forwardRef(function Card(
  { as: Tag = "div", look, glass = false, className = "", ...rest },
  ref
) {
  const classes = [
    "ui-card",
    ...[look]
      .flat()
      .filter(Boolean)
      .map((l) => {
        if (!CARD_LOOKS.includes(l) && import.meta.env?.DEV)
          console.error(`Card: unknown look "${l}"`);
        return CARD_LOOKS.includes(l) && `ui-card--${l}`;
      }),
    glass && "glass-panel",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <Tag ref={ref} className={classes} {...rest} />;
});

export default Card;
