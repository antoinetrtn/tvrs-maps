# Project: TVRS Maps 3D Globe GPU Engine Rebuild

## Architecture
- Custom Three.js GPU Batched/Instanced Mesh rendering pipeline replacing `react-globe.gl` multi-mesh extrusion.
- GPU `DataTexture` uniform for dynamically mapping state attributes (found status, regional colors, glitch progress, `uFadeProgress`).
- Offscreen RGBA Color-ID WebGL render target for zero-latency (<1ms, 0% CPU main thread) picking via `gl.readPixels`.
- Strict AGENTS.md compliance: TV glitch shader (`GLITCH_FRAGMENT_BODY`), satellite wireframes with high-contrast neon colors (`REGION_COLORS_LABELS`), cone peak geometry caching in Rivers & Mountains mode, natural UI label casing, border-radius token alignment.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Performance Audit & Baseline Instrumentation | Build KPI measurement framework (FPS, frame time, draw calls, picking time, memory) | None | IN_PROGRESS |
| 2 | GPU Batched Geometry & DataTexture Engine | Implement single-buffer geometry generation & DataTexture shader pipeline | M1 | PLANNED |
| 3 | Offscreen WebGL GPU Color-ID Raycasting | Implement offscreen RGBA render-target picking with `gl.readPixels` | M2 | PLANNED |
| 4 | Visual Parity & AGENTS.md Rule Compliance | Integrate visual shaders, satellite neon wireframes, Rivers & Mountains peaks, natural UI casing | M2, M3 | PLANNED |
| 5 | E2E Integration & Performance Verification | Pass 100% test suite, meet all KPI targets (<15 draw calls, ≥60 FPS, <1ms latency) | M1, M2, M3, M4 | PLANNED |

## E2E Testing Track
| Track | Scope | Status |
|-------|-------|--------|
| E2E Testing Track | Independent requirement-driven test suite creation (Tiers 1-4), publishes `TEST_READY.md` | IN_PROGRESS |

## Interface Contracts
### BatchedGlobe ↔ Game Engine
- Data input: GeoJSON features (Countries, Departments, US States, Rivers & Mountains).
- State uniform: DataTexture holding per-feature attributes `[r, g, b, stateFlags]`.
- Output picking: `getPickedFeatureId(x, y): string | null` returning feature ID in <1ms.
- Render API: `updateFeatureState(featureId, state)`, `setTheme(theme)`, `setTime(time)`.

## Code Layout
- `src/globe/`: GPU Batched Mesh engine, DataTexture shaders, offscreen picking render target.
- `src/globeShaders.js`: Glitch GLSL shaders (`GLITCH_FRAGMENT_BODY`) and uniforms.
- `src/designSystem.js`: Theme colors (`REGION_COLORS_LABELS`), glitch settings.
- `src/components/`: UI components (React wrapper around BatchedGlobe).
- `tests/`: Vitest unit tests & Playwright E2E tests.
