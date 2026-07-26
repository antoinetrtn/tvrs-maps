# Quality Rules

Run before pushing:

```sh
npm run check
```

## Development server

Use `npm run dev:5001`. Port `5173` is intentionally banned for this project.

## Design system

`src/config/designSystem.js` is the source of truth for:

- theme colors;
- map/globe colors;
- glass, overlay, tint and shadow values;
- radii, spacing, transition, blur and control-size tokens.

Components and CSS files should consume CSS variables or imported design tokens. Do not add raw hex/rgb/hsl colors outside `src/config/designSystem.js` or the bootstrapping defaults in `src/index.css`.

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

## Where things live (file map)

Keep each concern in its dedicated module — do not re-inline data/constants into components.

| Concern | File |
| --- | --- |
| UI/theme color tokens, globe-theme overrides, color helpers | `src/config/designSystem.js` |
| Per-mode gameplay rules (scramble, altitude, relief, regions, region abbreviations) | `src/config/gameConfig.js` |
| Tunable non-visual constants (durations, breakpoints, timeouts, data URLs, storage keys, perf tiers) | `src/config/gameConstants.js` |
| All user-facing strings (FR/EN) + `useTranslation` | `src/config/i18n.js` |
| Geographic datasets + challenge definitions | `src/data/` (`gameData.js`, `departmentsData.js`, `riversMountainsData.js`, `usStatesData.js`, `challenges.js`) |
| 3D globe rendering (component, useGlobe* hooks, shaders/materials/labels) | `src/globe/` (`GlobeMap.jsx`, `hooks/`, `render/` — GLSL in `render/globeShaders.js`) |
| App/state hooks (game session, profile, geo data, viewport…) | `src/hooks/` |
| Pure cross-cutting helpers (normalization, geometry, gamification/XP, achievements) | `src/utils/` |
| Supabase client and services | `src/services/` |
| Shared panel/overlay CSS system | `src/styles/panelSystem.css` |

Rules:
- **No hardcoded UI strings** in components — add a key to `src/config/i18n.js` and use `t("key")`. The language toggle labels (`FR`/`EN`) are language codes, not copy, and stay literal.
- **No magic numbers** (durations, breakpoints, timeouts) inline — add them to `src/config/gameConstants.js`.
- **No duplicated lists** — region keys come from `GAME_REGIONS` (`gameConfig`); region gauge abbreviations from `getRegionAbbr`.
- **Moving a file?** Update its path keys in `RATCHET_LIMITS`/`LEGACY_BASES` (and any allowlists) in `scripts/quality-check.js`, otherwise the moved file silently falls back to the default 500-line limit.

## Theme model (satellite vs blackout)

The UI chrome (panels, text, accents, glass) comes entirely from the base `THEME[light|dark]` and is **shared by every globe theme**. A globe theme may only override globe-scene concerns (globe material, atmosphere glow, graticules, stroke widths, label color mode, continent/department palettes) via `GLOBE_THEMES[theme].globeSettings`. `getThemeColors()` merges those on top of the base theme, so anything not listed automatically stays identical across globe themes. **Switching the globe theme must change the globe, not the interface.**

### Globe atmosphere / load flicker

The custom inner-glow halo (Fresnel shader) is **snapped** to its theme target color on first build (`justCreatedLighting` in `updateGlobeLighting`); only later theme changes lerp smoothly via `animateScene`. This avoids the "globe slowly drifts color on load" flicker. Do not reintroduce a default glow color that gets lerped from on first paint. The inner glow is intentionally hidden in blackout and on mobile.

## Known tech debt (future work, not yet addressed)

Refreshed during the 2026-07 structure pass. Done since the last pass: GlobeMap
decomposed into `src/globe/` (component + 16 hooks + pure render helpers),
App.jsx slimmed to ~520 lines behind app hooks, pure XP/badge math extracted to
`src/utils/gamification.js`, `App.css`/`panelSystem.css` orphans dissolved.
Still open:

- **GameHUD prop drilling**: ~35 props (incl. learn-toggle pairs and session meta). Consider grouping into cohesive objects assembled in `useGameSessionProps` (memoized per group).
- **Design token duplication**: the `:root` defaults in `src/index.css` and `getThemeCssVariables()` in `src/config/designSystem.js` are two hand-synced lists — drift-prone. Candidate: generate the CSS defaults from the JS source (plus a staleness check in `scripts/quality-check.js`).
- **No typography scale**: font sizes are hardcoded per CSS file (~30 distinct values); add `--font-size-*` tokens and migrate opportunistically.
- **GameHUD.css size**: near its 1000-line ratchet; split along its existing section banners before the next HUD feature.
- **Cheat codes** `WIN100`/`LOSE100` in `useGameSession.handleInput` ship in production unconditionally — gate behind a debug flag.
- **Mobile/desktop learn-toggle i18n keys differ** (`show_*` vs `labels_*`) — intentional (long vs short) but worth documenting per-call.
- **Material cache growth**: per-country cap/side materials in `sharedMaterialsRef` are disposed on theme/mode change, not per selection — monitor if memory grows over very long sessions.

## Verifying the globe renders

Headless Chrome needs software WebGL: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. Plain `--headless --disable-gpu` fails with "Error creating WebGL context" (environment limitation, not an app bug).

## CI/CD & Supabase Workflow

### Branching Model
- **`main`** : Stable production branch. Direct pushes are banned (enforced via GitHub settings). All changes must merge from `dev` via a release PR.
- **`dev`** : Staging/Development branch. Direct pushes are banned. Developers work on feature/fix branches and merge them into `dev` via PRs.
- **`feat/*` or `fix/*`** : Feature or bugfix branches branched off `dev`.

### CI Quality Pipeline
A GitHub Action (`.github/workflows/quality.yml`) runs on push/PR to `main` and `dev`. It performs:
1. `npm run format:check` (Prettier).
2. `npm run lint` (checks formatting, design tokens, bans, ESLint, and runs Knip dead code audit).
3. `npm run test:run` (runs all unit tests in Vitest).
4. `npm run build` (ensures Vite builds successfully).

### Quality Tooling (ESLint, Prettier, Husky, Sonar, etc.)
- **ESLint** (flat config): strict rules + react, hooks, a11y (some warn), security, promise, simple-import-sort, prettier, unused-imports.
  - `npm run lint:eslint` (reports)
  - `npm run lint:fix`
- **Prettier**: formatting standard (double quotes, 2 spaces, semi, 100 cols). `npm run format`
- **Husky + lint-staged**: fast checks on `git commit` (eslint + prettier on staged files only). Full `npm run check` on `git push`.
- **Commitlint**: enforces Conventional Commits (e.g. `feat:`, `fix:`, `chore:`) via commit-msg hook.
- **Knip**: dead code / unused exports detection.
- **SonarQube Cloud** (optional but recommended): deeper static analysis (bugs, vulnerabilities, code smells, duplication, maintainability, hotspots). See `.github/workflows/sonar.yml` and `sonar-project.properties`.
  - Requires two GitHub secrets:
    - `SONAR_TOKEN` (from sonarcloud.io → User > My Account > Security > Tokens)
    - `SONAR_ORG` (your SonarCloud organization key, e.g. "antoinetrtn" — find it under your org > Administration > Organization key)
  - Once scans run, you can connect **SonarQube MCP Server** (https://github.com/SonarSource/sonarqube-mcp-server) in your AI coding agent (Cursor, Claude, VS Code, this Grok session, etc.). This lets the agent query live quality issues, hotspots and gates during development and reviews for even stronger feedback loops.
- **Custom quality ratchets** in `scripts/quality-check.js` remain the project-specific guardrails (file sizes, no magic colors, nesting limits, globe rules, z-index, etc.).

Run `npm run check` locally before pushing (now also enforced by pre-push).

### Database Migrations (Supabase)
Any database schema changes must be version-controlled in the repository:
1. Create a migration locally: `npm run supabase:migration <name>`
2. Edit the generated SQL file under `supabase/migrations/`
3. Apply migration to the database: `npm run supabase:push` (automatically deployed on push to `dev`/`main` via GitHub Actions once GitHub secrets are configured).

