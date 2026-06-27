# Quality Rules

Run before pushing:

```sh
npm run check
```

## Development server

Use `npm run dev:5001`. Port `5173` is intentionally banned for this project.

## Design system

`src/designSystem.js` is the source of truth for:

- theme colors;
- map/globe colors;
- glass, overlay, tint and shadow values;
- radii, spacing, transition, blur and control-size tokens.

Components and CSS files should consume CSS variables or imported design tokens. Do not add raw hex/rgb/hsl colors outside `designSystem.js` or the bootstrapping defaults in `src/index.css`.

## Globe rendering

The globe should favor stable geometry and frame rate:

- do not swap low/high-res country geometry on selection;
- do not load `countries-50m.json` in the runtime app unless the rendering strategy changes;
- do not add selected-country `pathsData` outline overlays without visual verification;
- do not add 2D light overlays or sprite/canvas glow textures over the globe.

Selection feedback should stay cheap: material color/emissive, altitude pulse, rings, and CSS transforms are preferred.

## Motion and layout

- Keep mobile/tablet pixel ratio conservative.
- Avoid negative letter spacing.
- Use existing CSS variables for transitions and repeated sizes.
- For globe drag feel, prefer wrapper-level CSS transforms over extra Three.js objects.

## Theme & Mode Modifying Rules

- **Theme Completeness**: Every theme overrides object in `src/designSystem.js` must declare overrides for all variables defined in the base `THEME` structure to avoid partial variables or broken colors when switching modes or states.
- **Independent Game Modes**: Any code modifying game layouts, filters, or scoring must be guarded by mode checks (e.g. `mode === 'learn'`, `isDepartmentMode`) to prevent regressions in other modes.
- **Mobile Layout Consistency**: Never duplicate or split mobile layouts when adding features. Use the unified compact top-HUD and visual popover dropdown system.
- **Stable Mobile Viewports**: Keep WebGL canvases fixed to un-contracted viewport dimensions (`maxWindowHeightRef`/`maxWindowWidthRef`) to prevent keyboard-resize canvas jumps, adjusting only the Point of View offsets.
