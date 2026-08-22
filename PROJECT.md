# Project: TVRS Maps Coherence Cleanup

## Architecture
TVRS Maps is a 3D Earth / Geography React application built with Three.js / `react-globe.gl`, Vite, Supabase, and Playwright.
- **Core Globe & Rendering**:
  - `src/globe/hooks/useGlobePaths.js`: River polyline generation, coordinate smoothing, layered paths (base, selected outer glow, selected animated core dash).
  - `src/globe/GlobeMap.jsx`: Integrates globe hooks and handles user click raycasting on paths and polygons.
  - `src/globe/render/polygonColorResolver.js` & `polygonGlitchShader.js`: Shaders and color resolution for country polygons with defensive fallbacks.
  - `src/config/designSystem.js`: Canonical theme tokens, colors, glitch parameters, and river configuration (`RIVER_CONFIG`).
  - `src/config/gameConfig.js`: Altitudes (`POLYGON_ALTITUDE`, `RIVER_ALTITUDE`), relief settings (`RELIEF`), game modes.
- **HUD & UI**:
  - `src/components/GameHUD.jsx` & `GameHUD.css`: Main HUD, central pill progress, bottom-right info button with keyboard fade and accessibility.
  - `src/components/EndScreen.jsx` & `EndScreen.css`: Post-game summary and regional progress bars styled with design system tokens.
  - `src/components/GameDataPanel.jsx` & `GameDataPanel.css`: Information panel with regional entity breakdown styled with design system tokens.
  - `src/components/HomeScreenCategoryCarousel.jsx`: Homepage category selection carousel with natural casing badge labels.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Git branch creation | Create dedicated branch `fix/coherence-cleanup-gauges-rivers` | M0 | ORIGINAL_REQUEST §R4 | DONE |
| 2 | Remove bottom-right continent sub-gauges | Remove `hud-bottom-right` / `island-sub-gauges` JSX, `regionStats`, `activeContinent`, `gaugeRegions`, `REGION_COLORS` from GameHUD | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 3 | Preserve HUD info button | Retain `.hud-btn-circular` in `.hud-bottom-right` with `keyboard-mode` fade, proper ARIA label and accessibility | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 4 | Clean dead HUD gauge CSS & configs | Remove `.hud-top-gauges`, `.island-sub-gauges`, `.circular-gauge`, `@keyframes aura-pulse`, `REGION_ABBR`, `getRegionAbbr`, and `RELIEF.targetHintScale` | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 5 | Remove legacy UI continent colors | Standardize `EndScreen` progress bars and `GameDataPanel` dots to design system tokens (`var(--accent)`, `var(--text-muted)`) | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 6 | Centralize River Configuration | Export canonical `RIVER_CONFIG` in `designSystem.js` and `RIVER_ALTITUDE` in `gameConfig.js` | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 7 | Unify River Rendering & Animations | Standardize `useGlobePaths.js` across Learn, Play, Homepage; fix core dash color inversion (bright highlight); support `isSuccess` | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 8 | Fix River Click Raycast | Strip `_core` suffix in `GlobeMap.jsx` `onPathClick` to allow selecting rivers when clicking top dashed layer | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 9 | Knip & Latent Bug Fix | Remove unused export `updateCanonicalPositionsCache` in `polygonGlitchShader.js` and fix undefined `GLOBE_STYLE.base.mapBase` in `polygonColorResolver.js` | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 10 | Rule Compliance: Casing & Radius | Enforce natural casing on carousel badges (Rule 5) and standardize border radii to tokens (Rule 8) | M3 | ORIGINAL_REQUEST §R3 & AGENTS.md | DONE |
| 11 | Automated Quality & Test Suite | Run and pass `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run check` with 0 errors | M4 | ORIGINAL_REQUEST §R4 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Branch Setup | Create dedicated fix branch `fix/coherence-cleanup-gauges-rivers` | none | DONE |
| M1 | Gauges & Continent Colors Cleanup | Remove bottom-right sub-gauges, position info button, remove dead CSS/configs, tokenize EndScreen & GameDataPanel | M0 | DONE |
| M2 | Unify River Rendering & Animations | Centralize `RIVER_CONFIG`, unify `useGlobePaths.js` across all modes, fix core color & click raycasting | M1 | DONE |
| M3 | Codebase Coherence & Token Audit | Fix knip unused export, fix `polygonColorResolver.js` fallback bug, fix carousel natural casing (Rule 5), token radius (Rule 8) | M2 | DONE |
| M4 | Automated Quality Checks & Test Suite | Execute full validation suite (`lint`, `test`, `test:e2e`, `check`) | M3 | DONE |

## Interface Contracts
- **Design System (`src/config/designSystem.js`)**:
  - `RIVER_CONFIG`: Single source of truth for river colors (`active`, `inactive`, `selectedFound`, `selectedUnfound`, `core`, `error`, `success`), stroke widths, dash parameters, and smoothing point count.
- **Game Config (`src/config/gameConfig.js`)**:
  - `RIVER_ALTITUDE`: Standardized altitudes (`base: 0.006`, `selectedOuter: 0.007`, `selectedCore: 0.008`).
  - No obsolete `REGION_ABBR` or `getRegionAbbr`.
- **HUD Layout (`src/components/GameHUD.jsx`)**:
  - Clean bottom-right container housing solely the Info button with keyboard fade and accessibility attributes.
  - No `island-sub-gauges` or heavy memoized continent progress calculations.
- **UI Styling (`src/components/EndScreen.jsx`, `src/components/GameDataPanel.jsx`)**:
  - Uniform token usage (`var(--accent)`, `var(--text-muted)`) for category dots and progress bars without arbitrary per-continent color overrides.

## Code Layout
- `src/config/designSystem.js`, `src/config/gameConfig.js`
- `src/globe/hooks/useGlobePaths.js`, `src/globe/GlobeMap.jsx`, `src/globe/render/polygonColorResolver.js`, `src/globe/render/polygonGlitchShader.js`
- `src/components/GameHUD.jsx`, `src/components/GameHUD.css`, `src/components/EndScreen.jsx`, `src/components/EndScreen.css`, `src/components/GameDataPanel.jsx`, `src/components/GameDataPanel.css`, `src/components/HomeScreenCategoryCarousel.jsx`
- `src/tests/` (16 test files, 171 tests, all passing)
