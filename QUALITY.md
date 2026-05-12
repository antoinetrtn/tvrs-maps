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
