# Workspace Customization Rules — TV Glitch & Satellite Wireframes

These rules standardize the retro TV static glitch animation and country polygon behaviors to prevent rendering issues and maintain visual cohesion.

## 1. Selected Country Glitch Effect
* **Solid/Opaque Cap**: The selected country's cap MUST always render as a solid opaque shape (never a wireframe) to show the TV glitch texture properly.
* **Shared GLSL Program**: The selected country shader uses a high-speed monochrome noise/static GLSL code (`GLITCH_FRAGMENT_BODY`) exported from [globeShaders.js](file:///Users/atrtn/.gemini/antigravity/scratch/tvrs-maps/src/globeShaders.js).
* **Speed and Ranges**:
  - Time Speed Factor: `28.0`
  - Dark Theme Range: `[0.12, 0.68]` (dark grey to medium grey noise)
  - Light Theme Range: `[0.65, 0.98]` (bright light grey to white noise)

## 2. Found Countries
* **Satellite Theme Wireframe**: Found countries under the satellite theme MUST render as `wireframe: true`.
* **High-Contrast Neon Colors**: The wireframe lines must use the bright regional label colors (`REGION_COLORS_LABELS`) instead of dark surface colors, ensuring they stand out clearly over the Earth's terrain textures.

## 3. Unfound Countries (Satellite Mode)
* **Smooth Transition Opacity**: Unfound countries must have `material.transparent = true`, and their cap opacity must fade out smoothly to `0.0` upon deselection using `uFadeProgress` in the shader. Side walls must be set to `material.visible = false` to prevent blocky artifacts.

## 4. Mountains & Ranges (Rivers & Mountains Mode)
* **Unified Scaling**: Mountains must always render at `RELIEF.mountainScale` regardless of finding state, preventing visual shifting or scaling popping.
* **Peak Merging & Caching**: Peaks must be drawn as single solid cones (no dual-material snow caps) to limit draw calls. Geometry caches must be keyed strictly by dimensions (`peakRadius` and `peakHeight`) to prevent memory allocations/garbage collection lag on selections.
* **Glitch & Regional/White Visual States**:
  - **Found**: Solid opaque regional surface color matching country mode (e.g., shades of white/grey in the blackout dark theme: `#eeeeee`, `#d4d4d4`, etc.).
  - **Unfound & Selected**: Opaque retro TV static glitch shader (using the shared `mountainGlitchUniforms.uTime`).
  - **Unfound & Unselected**: Solid opaque slate grey (no transparency).
## 5. UI Titles and Section Labels
* **No Uppercase Transform**: Never force section labels or titles to be completely uppercase (e.g., do not use `text-transform: uppercase` in CSS styles). Use natural casing or standard capitalisation.

---

*These rules are backed up by the `GLITCH_EFFECT_SETTINGS` exported configuration in [designSystem.js](file:///Users/atrtn/.gemini/antigravity/scratch/tvrs-maps/src/designSystem.js).*
