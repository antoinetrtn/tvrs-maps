/** Selection + unfound-land look, shared by the GLSL shaders and their TSL twins. */
// Selected-country surface: warm umber tint and bright amber pixel outline.
export const SELECT_LAND_TINT_RGB = [1.3, 1.0, 0.66];
export const SELECT_EDGE_RGB_VALUE = [1.0, 0.76, 0.32];
// Soft halo inside the thin border: opacity per ring value, gentle stepped pulse.
export const SELECT_HALO_ALPHA_VALUE = 0.55;
export const SELECT_PULSE_S_VALUE = 2.4;
export const SELECT_PULSE_STEPS_VALUE = 4;
// Unfound land in game: warm night umber; Home/End keep the original cool grey.
export const BLACKOUT_TINT_RGB = [1.08, 0.97, 0.8];
export const BLACKOUT_TINT_HOME_RGB = [0.97, 0.99, 1.03];

const v3 = (rgb) => `vec3(${rgb.map((v) => v.toFixed(3)).join(", ")})`;
export const SELECTION_STYLE_DEFS = `
  #define SELECT_LAND_TINT ${v3(SELECT_LAND_TINT_RGB)}
  #define SELECT_EDGE_RGB ${v3(SELECT_EDGE_RGB_VALUE)}
  #define BLACKOUT_TINT ${v3(BLACKOUT_TINT_RGB)}
  #define BLACKOUT_TINT_HOME ${v3(BLACKOUT_TINT_HOME_RGB)}
  #define SELECT_HALO_ALPHA ${SELECT_HALO_ALPHA_VALUE.toFixed(3)}
  #define SELECT_PULSE_S ${SELECT_PULSE_S_VALUE.toFixed(3)}
  #define SELECT_PULSE_STEPS ${SELECT_PULSE_STEPS_VALUE.toFixed(1)}
`;
