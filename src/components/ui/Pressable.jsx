import React from "react";

/**
 * Pressable — the kit's bare interactive surface (single source of the native <button>
 * for selection tiles: swatches, avatar/badge tiles, table rows, pagination dots).
 *
 * Renders ONLY `<button type="button">` with the given className: no chrome, no haptics.
 * Visual styling stays with the caller's class. Use <Button> / <IconButton> for actions.
 */
const Pressable = React.forwardRef(function Pressable({ type = "button", ...rest }, ref) {
  return <button ref={ref} type={type} {...rest} />;
});

export default Pressable;
