# E2E Test Infrastructure & Coverage Specification — TVRS Maps

## 1. Test Philosophy

TVRS Maps utilizes a **100% requirement-driven, opaque-box E2E testing methodology** implemented via Playwright.

### Core Principles:
- **No Internal State Dependency**: Tests do not access React internal component states, private hooks, or Three.js scene graphs (`__reactFiber`, window debug globals, or internal canvas objects).
- **Public DOM & Canvas Interface**: All assertions and user actions evaluate visible DOM elements, HTML data attributes, ARIA attributes, keyboard inputs, mouse pointer/touch gestures, and CSS computed styles.
- **Visual & Behavioral Verification**: Tests verify user interaction flows, WebGL theme transitions, HUD dynamic states, feedback animations, and visual rules defined in `AGENTS.md`.
- **Bypass Authentication for Testing**: Tests set `localStorage.setItem('tvrs-guest-mode', 'true')` via Playwright's `addInitScript` before page navigation to bypass `AuthModal` in automated runs.

---

## 2. Feature Inventory

| Category | Component / Feature | Test Target & Selectors | Key Requirements |
|---|---|---|---|
| **Game Modes** | Countries | `.deck-mode-card[data-mode="countries"] .card-play-btn` | Locate world countries on 3D globe |
| | Capitals | `.deck-mode-card[data-mode="capitals"] .card-play-btn` | Quiz mode matching country capitals |
| | Departments | `.deck-mode-card[data-mode="departments"] .card-play-btn` | French department codes/names |
| | US States | `.deck-mode-card[data-mode="us_states"] .card-play-btn` | Locate 50 US States |
| | Rivers & Mountains | `.deck-mode-card[data-mode="rivers_mountains"] .card-play-btn` | Major mountain ranges, peaks & rivers |
| **Learn Sub-Modes** | Learn Mode Explorer | `.card-learn-btn`, `.learn-carousel-control` | Non-scoring globe exploration & data panel search across all 5 datasets |
| **UI & Globe Themes** | Interface Theme | `SegmentedControl` -> Dark / Light | Data attribute `.app-container[data-theme="dark/light"]` |
| | Globe Theme | `SegmentedControl` -> Dark, Satellite, Blackout, Retro | Shader materials & background theme styling |
| **HUD Controls** | Answer Input | `#q-resp-field` (`input[name="q-resp"]`) | Auto-clears on correct answer, error/warning/success island states |
| | Auto-Suggestions | `.suggestions-list`, `.suggestion-item` | Triggers at 4+ input chars, tap submits suggestion |
| | HUD Counter & Timer | `.score-pill`, `.timer-pill`, `.island-font` | Score increment flash, formatted countdown M:SS |
| | Hardcore Lives | `.hud-hearts`, `.heart-full`, `.heart-lost` | 3 lives in hardcore mode, lost heart shake & red flash |
| | Regional Gauges | `.hud-bottom-right .gauge-item` | Desktop regional progress percentages (EU, AM, AS, AF, OC, AN) |
| | Focus Navigation | `.prev-btn`, `.next-btn` | Cycle active focus between unfound targets |
| **AGENTS.md Compliance** | Selected Country Glitch | Glitch shader GLSL (`GLITCH_FRAGMENT_BODY`) | Solid opaque cap, speed `28.0`, dark range `[0.12, 0.68]`, light range `[0.65, 0.98]` |
| | Satellite Wireframe | Satellite mode found countries | `wireframe: true` using bright regional label colors (`REGION_COLORS_LABELS`) |
| | Satellite Fade | Satellite mode unfound deselection | `uFadeProgress` smooth opacity fade to `0.0`, hidden side walls |
| | Mountain Scaling & Cache | `RELIEF.mountainScale` | Unified scaling regardless of state, cached single-cone peaks |
| | UI Casing Rule | Section labels & titles | Natural casing (NO `text-transform: uppercase` in CSS) |
| | Border-Radius Tokens | Cards, HUD & Modals | Standard compact border-radius (`var(--radius-md)`, ~8px max) |

---

## 3. Test Architecture

```
tests/
├── helpers/
│   ├── fixtures.js               # Guest mode fixture & custom page extensions
│   └── pageObjects.js            # Page Object Models (HomeScreen, GameHUD, EndScreen, GameDataPanel)
├── game.spec.js                  # Smoke & fundamental flow tests
├── tier1_features.spec.js        # Tier 1: Feature Coverage (≥20 tests)
├── tier2_boundary.spec.js        # Tier 2: Boundary & Corner Cases (≥30 tests)
├── tier3_combinations.spec.js    # Tier 3: Cross-Feature Combinations (≥10 tests)
└── tier4_scenarios.spec.js       # Tier 4: Real-World Scenarios (≥4 tests)
```

### WebServer & Port Strategy
- Dev Server binds to `127.0.0.1:5001` via `npx vite --host 127.0.0.1 --port 5001` to prevent macOS `listen EPERM 0.0.0.0` socket errors in sandbox execution.
- WebGL Hardware Acceleration flags configured for Chromium headless runs (`--use-gl=angle`, `--use-gl=swiftshader`, `--ignore-gpu-blocklist`, `--enable-gpu-rasterization`).

---

## 4. 4-Tier Coverage Methodology & Matrix

```
+-----------------------------------------------------------------------------------+
|                            TVRS MAPS E2E TEST MATRIX                              |
+----------------------+---------------------------------+-------------+------------+
| Tier                 | Focus & Scope                   | Target Min  | Actual     |
+----------------------+---------------------------------+-------------+------------+
| Tier 1: Features     | All 5 Game Modes, Learn Mode,   |  20 tests   |  20 tests  |
|                      | Theme Switch, Answer Input, HUD |             |            |
+----------------------+---------------------------------+-------------+------------+
| Tier 2: Boundary     | Rapid Clicks, Drag/Hover, Zoom  |  30 tests   |  30 tests  |
|                      | Limits, ESC Deselect, Resize,   |             |            |
|                      | Accented/Hyphen Data Matching   |             |            |
+----------------------+---------------------------------+-------------+------------+
| Tier 3: Combinations | Mid-Selection Theme Switch,     |  10 tests   |  10 tests  |
|                      | Mode Switch Glitch, Satellite   |             |            |
|                      | Wireframe & Neon Labels,        |             |            |
|                      | Hardcore Life Depletion         |             |            |
+----------------------+---------------------------------+-------------+------------+
| Tier 4: Scenarios    | Complete End-to-End Game Rounds |   4 tests   |   4 tests  |
|                      | on Desktop & Mobile Viewports   |             |            |
+----------------------+---------------------------------+-------------+------------+
| TOTAL                | Full E2E Test Suite             |  64 tests   |  64 tests  |
+----------------------+---------------------------------+-------------+------------+
```

### Breakdown of Test Cases by File:

#### 1. `tests/tier1_features.spec.js` (20 Tests)
- `T1-MODE-01`: Countries Mode Launch & Initial State
- `T1-MODE-02`: Capitals Mode Launch & Placeholder
- `T1-MODE-03`: Departments Mode Launch & Validation ("75" -> Paris)
- `T1-MODE-04`: US States Mode Launch & Validation ("California")
- `T1-MODE-05`: Rivers & Mountains Mode Launch & Validation ("Everest")
- `T1-MODE-06`: Carousel Navigation Arrow Right (Countries -> Capitals)
- `T1-MODE-07`: Carousel Navigation Arrow Left (Wrap back)
- `T1-MODE-08`: Carousel Indicator Dots Direct Select (Departments card)
- `T1-MODE-09`: Learn Mode Launch from Home Card
- `T1-MODE-10`: Learn Mode Sub-Mode Carousel Switching
- `T1-THEME-01`: Interface Theme Switch (Dark -> Light)
- `T1-THEME-02`: Globe Theme Switch (Satellite)
- `T1-THEME-03`: Globe Theme Switch (Blackout)
- `T1-THEME-04`: Interface Theme Switch Persistence across Reload
- `T1-HUD-01`: Answer Input Auto-Clearing on Correct Answer
- `T1-HUD-02`: Auto-Suggestions Display at 4+ Characters
- `T1-HUD-03`: Auto-Suggestion Click Submits Answer
- `T1-HUD-04`: Target Focus Navigation Next/Prev Buttons
- `T1-HUD-05`: Settings Panel Open & Close
- `T1-HUD-06`: Leaderboard Panel Open & Close

#### 2. `tests/tier2_boundary.spec.js` (30 Tests)
- `T2-CLICK-01`: Rapid Click Carousel Right Arrow 15 Times
- `T2-CLICK-02`: Rapid Click Carousel Left Arrow 15 Times
- `T2-CLICK-03`: Rapid Double-Click Play Button
- `T2-CLICK-04`: Rapid Toggle Interface Theme (Dark/Light 10x)
- `T2-CLICK-05`: Rapid Toggle Globe Theme (Satellite/Blackout 10x)
- `T2-CLICK-06`: Rapid Suggestion Click Ignored After Input Clear
- `T2-HOVER-01`: Canvas Mouse Drag Pan Gesture
- `T2-HOVER-02`: Fast Pointer Sweeps Across Canvas
- `T2-HOVER-03`: Mouse Drag Outside Window Boundary
- `T2-HOVER-04`: Fast Mouse Wheel Zoom In Threshold
- `T2-HOVER-05`: Fast Mouse Wheel Zoom Out Threshold
- `T2-DESEL-01`: ESC Key Closes Settings Panel
- `T2-DESEL-02`: ESC Key Closes Profile Panel
- `T2-DESEL-03`: ESC Key Closes Leaderboard Panel
- `T2-DESEL-04`: Clear Search Input in Learn Data Panel
- `T2-DESEL-05`: Input Field Focus Retention on Canvas Interaction
- `T2-RESIZE-01`: Desktop Viewport (1280x800) Layout Verification
- `T2-RESIZE-02`: Mobile Viewport (375x667) Layout Verification
- `T2-RESIZE-03`: Resize Desktop to Mobile Dynamic Adaption
- `T2-RESIZE-04`: Resize Mobile to Desktop Dynamic Adaption
- `T2-RESIZE-05`: Mobile Landscape Viewport (667x375) Adaption
- `T2-DATA-01`: Accented Character Answer Matching ("Égypte" / "Egypte")
- `T2-DATA-02`: Hyphenated & Compound Name Handling ("Saint-Marin" / "saint marin")
- `T2-DATA-03`: Case Insensitive Answer Submission ("fRAncE")
- `T2-DATA-04`: Non-Existent Answer Submission Error Island Feedback
- `T2-DATA-05`: Duplicate Correct Answer Submission Warning/Error Feedback
- `T2-DATA-06`: Game Duration Stepper Decrement (-1 Min)
- `T2-DATA-07`: Game Duration Stepper Increment (+1 Min)
- `T2-DATA-08`: Language Switch FR to EN Card Title Update
- `T2-DATA-09`: Language Switch EN to FR Restoration

#### 3. `tests/tier3_combinations.spec.js` (10 Tests)
- `T3-COMB-01`: Mid-Selection Interface Theme Switch (Dark -> Light during active game)
- `T3-COMB-02`: Mid-Selection Globe Theme Switch (Satellite during active game)
- `T3-COMB-03`: Satellite Theme Found Country Wireframe Rules (AGENTS.md Rule 2)
- `T3-COMB-04`: Satellite Theme High-Contrast Neon Label Color Conformance
- `T3-COMB-05`: Unfound Country Opacity Fade Out on Deselection (AGENTS.md Rule 3)
- `T3-COMB-06`: Rivers & Mountains Mountain Scale Consistency (AGENTS.md Rule 4)
- `T3-COMB-07`: Game Mode Switch Mid-Session via Return Home Logo
- `T3-COMB-08`: Peaceful to Hardcore Mode Toggle & Hearts Display
- `T3-COMB-09`: Hardcore Mode Wrong Answer Heart Depletion & Vignette Flash
- `T3-COMB-10`: Hardcore 0 Lives Game Over EndScreen Launch

#### 4. `tests/tier4_scenarios.spec.js` (4 Tests)
- `T4-SCEN-01`: Complete Desktop Round Simulation (1280x800) — Countries mode, multiple answers, stop round, EndScreen summary & minimize/restore.
- `T4-SCEN-02`: Complete Desktop Learn Mode Exploration (1280x800) — Learn mode, sub-mode switching, data table filtering & row selection.
- `T4-SCEN-03`: Complete Mobile Round Simulation (375x812 iPhone 13) — Touch navigation, Departments mode, answer submission, mobile data panel overlay.
- `T4-SCEN-04`: Complete Mobile Landscape Simulation (667x375) — Landscape viewport layout, US States mode, round completion & Return Home.

---

## 5. Execution Commands & Pipeline

```bash
# Run full 4-tier Playwright E2E suite
npm run test:e2e

# Run with interactive Playwright UI runner
npm run test:e2e:show

# Run Vitest unit test suite
npm run test

# Complete project quality & test check before push
npm run check
```
