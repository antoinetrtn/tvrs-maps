// Build-time stub for `h3-js` (aliased in vite.config.js).
// three-globe statically imports h3-js for its hexBin / hexPolygon layers,
// which TVRS Maps never uses. The real library is a ~550 kB emscripten blob,
// so we replace it with throwing stubs: if a hex layer is ever enabled, this
// fails loudly instead of silently rendering nothing.
const unsupported = (name) => () => {
  throw new Error(`h3-js.${name} is stubbed out in TVRS Maps (hex layers unused)`);
};

export const latLngToCell = unsupported("latLngToCell");
export const cellToLatLng = unsupported("cellToLatLng");
export const cellToBoundary = unsupported("cellToBoundary");
export const polygonToCells = unsupported("polygonToCells");
