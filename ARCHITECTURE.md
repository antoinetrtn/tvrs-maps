# Architecture — TVRS Maps

> Doc destinée aux agents IA (et humains) qui reprennent ce code. Elle décrit
> **où vivent les choses, comment les données circulent, et les pièges**.
> Règles d'édition et dette technique : voir `QUALITY.md`. Ne pas dupliquer ici
> ce qui se déduit du code — ce doc explique le *pourquoi* et la *forme*.

## 1. Vue d'ensemble

Application **React 19 + Vite 8** : un quiz géographique sur un **globe 3D**
(`react-globe.gl` au-dessus de `three`). Backend optionnel **Supabase**
(profils, records, leaderboard) — le jeu fonctionne aussi en mode invité 100%
local. Les données géographiques sont des modules JS statiques + trois GeoJSON
servis depuis `public/data/`. Pas de routeur : un seul `App` bascule entre deux
écrans (`home` / `game`) via état local.

Build/serve : `npm run dev:5001` (port 5173 banni), `npm run check`
(format + lint + tests + build).

## 2. Carte des fichiers

```
src/
  main.jsx                    Entrée React (importe index.css puis styles/panelSystem.css).
  App.jsx                     ~520 l. Orchestrateur : écran courant, thèmes, langue,
                              montage des écrans. Délègue la logique aux hooks d'app.
  App.css                     Coquille app : .app-container, transition d'écran
                              (screen-soft-in/scanline), vignette panique.
  index.css                   Tokens CSS bootstrap (:root + [data-theme="light"]) et
                              composants globaux réutilisables (.btn-primary, glitch…).
  styles/
    panelSystem.css           Système unifié panneaux/overlays : sheet-panel,
                              panel-header, segmented-control, nav-chips, dialogs.

  globe/                      TOUT le rendu 3D vit ici.
    GlobeMap.jsx              ~590 l. Compose <Globe> (react-globe.gl) et branche
                              les hooks ci-dessous. Exporté en React.memo.
    GlobeMap.css              Shell du globe, labels, wrapper, overlay studio.
    hooks/                    16 hooks useGlobe* : polygons, camera, labels, lighting,
                              markers, material, paths, rings, biomes, interactions,
                              renderData, sceneAnimation + animationLoop (boucle rAF),
                              selectionTransition, panelShift.
    render/                   Helpers de rendu purs (pas de React) :
                              globeShaders.js (GLSL Fresnel du halo), polygonGlitchShader,
                              selectionTransitionShader, globePolygonMaterial,
                              polygonColorResolver, foundGreenPalette,
                              applyPolygonFeedbackUniforms, globeAltitude,
                              globeLabelBuilder (HTML des labels), LowPolyBiomes
                              (montagnes 3D low-poly).

  components/                 Écrans & UI (CSS co-localisé par composant) :
                              HomeScreen (+ HomeScreenCategoryCarousel), GameSessionView
                              (monte GlobeMap + GameHUD + GameDataPanel + EndScreen),
                              GameHUD, GameDataPanel (tableau de résultats — remplace
                              l'ancien ResultsModal), EndScreen, LeaderboardScreen,
                              ProfilePanel, AuthModal, ConfirmationModal, Logo,
                              SpaceBackground, PixelFireworks, XpOrbsAnimation…

  hooks/                      Hooks d'app/état (AUCUN rendu globe ici) :
                              useGameSession (logique de partie : foundList, score,
                              timer, saisie, cheat codes), useGameSessionProps
                              (assemble les props de GlobeMap/GameHUD),
                              useUserProfile (profil/XP/records + sync Supabase),
                              useGeoData (chargement GeoJSON), useViewport,
                              useCountrySelectHandler, useHudAnswerHandler,
                              useGameDataPanelState.

  config/
    designSystem.js           SOURCE DE VÉRITÉ couleurs/thèmes/tokens + helpers couleur.
    gameConfig.js             Règles de jeu PAR MODE (scramble, altitude, reliefs,
                              GAME_REGIONS, abréviations de régions).
    gameConstants.js          Constantes non-visuelles (durées, breakpoints, timeouts,
                              URLs data, clés localStorage, paliers de perf).
    i18n.js                   TOUTES les chaînes UI (fr/en) + hook useTranslation.

  data/                       Datasets statiques (exemptés du ratchet de taille) :
                              gameData.js (countryDataMap), departmentsData.js,
                              riversMountainsData.js, usStatesData.js, challenges.js
                              (définitions des défis/badges).

  utils/                      Helpers purs transverses : utils.js (normalisation,
                              géométrie GeoJSON, getGameStats, getFlagEmoji,
                              generateUUID…), gamification.js (XP/niveaux/badges,
                              evaluateGameRewardsAndBadges), achievementEvaluator.js
                              (checkChallengesRealTime), recordSuccessfulGuessSideEffects.js.

  services/                   supabaseClient.js (auth, profils, records, leaderboard),
                              TaskService.js.
  tests/                      Tests Vitest (purs : shaders, gamification, i18n, config…).
  types/                      supabase.ts (types générés).

public/data/
  countries-50m-low.json      GeoJSON polygones pays (basse résolution = runtime).
  departements-1000m.geojson  GeoJSON départements FR.
  us-states.json              GeoJSON états US.
```

**Invariants** (détaillés dans `QUALITY.md`) : pas de chaîne UI en dur (→ `config/i18n.js`),
pas de magic number en dur (→ `config/gameConstants.js`), pas de couleur brute hors
`config/designSystem.js`/`index.css`/`Logo.jsx`, listes de régions via `GAME_REGIONS`.
Le lint (`scripts/quality-check.js`) fait respecter une partie de ça mécaniquement
(couleurs, port 5173, certains termes bannis dans `globe/GlobeMap.jsx`, ratchet de
taille par fichier — **mettre à jour les clés de chemin de `RATCHET_LIMITS`/
`LEGACY_BASES` quand un fichier est déplacé**).

## 3. Modes de jeu

6 modes, pilotés par la string `mode` dans `App` :

| `mode`            | Dataset actif (`activeDataMap`) | Particularités |
| ----------------- | ------------------------------- | -------------- |
| `countries`       | `countryDataMap`                | Mode par défaut. |
| `capitals`        | `countryDataMap`                | On compare la capitale, pas le nom. |
| `departments`     | `departmentsDataMap`            | Zoom sur la France ; "ghost countries" autour. |
| `rivers_mountains`| `riversMountainsDataMap`        | Reliefs/fleuves rendus comme paths/objets 3D. |
| `us_states`       | `usStatesDataMap`               | États des USA (GeoJSON dédié `us-states.json`). |
| `learn`           | dataset du sous-mode + reliefs  | Pas de score/timer ; labels jamais brouillés ; sous-modes `learnSubMode` (mêmes clés que PLAY_MODES) + toggles d'affichage. |

`gameConfig.PLAY_MODES` = modes "quiz" (tout sauf `learn`). Les règles communes
(brouillage du label, altitude d'extrusion, taille des reliefs) sont
centralisées dans `config/gameConfig.js` pour que les modes ne divergent pas
visuellement. S'ajoute un axe **hardcore/peaceful** (toggle persisté,
`hardcoreMode` dans `App`) : le hardcore ajoute des vies (`livesLeft`) et marque
les records/scores leaderboard correspondants.

## 4. Flux de données et état

`App.jsx` (~520 l.) garde l'état "shell" : `currentScreen` (`home`|`game`),
thèmes, langue, mode, learn toggles. La logique est déléguée :

- **`useGameSession`** : état de partie (foundList, score, `timeLeft`/`gameDuration`,
  `isPlaying`, `isGameOver`, vies hardcore), saisie (`handleInput`, cheat codes
  `WIN100`/`LOSE100`), popups de feedback, navigation focus.
- **`useUserProfile`** : profil invité/connecté (XP, niveau, badges), records
  locaux + historique, sync Supabase. Le calcul pur XP/badges vit dans
  `utils/gamification.js` (`evaluateGameRewardsAndBadges`).
- **`useGameSessionProps`** : assemble `globeProps`/`hudProps` — c'est LE point
  de passage des ~25 props de `GlobeMap` et ~35 props de `GameHUD`
  (prop drilling assumé — voir dette technique dans QUALITY.md).
- **`useGeoData`** : fetch des GeoJSON runtime. **`useViewport`** : viewport +
  détection clavier mobile (comparaison à une baseline `initialWidth/Height`).
- **Thème** : `theme` (`dark`|`light`, = chrome UI), `globeTheme`
  (`satellite`|`blackout`, = apparence du globe). Persistés via `localStorage`
  (`STORAGE_KEYS.globeTheme`). `setGlobeTheme('blackout')` force `theme='dark'`.
- **Langue** : `lang` (`fr`|`en`).

**Boucle de saisie** (cœur du gameplay) :

```
GameHUD (input) ── onEnter(val) ──▶ useHudAnswerHandler
   ├─ mode === 'learn'      → handleSearch  (sélectionne sans scorer)
   ├─ selectedCountry set   → specificCountryGuess (compare à la cible focus)
   └─ sinon                 → handleInput   (cherche dans tout activeDataMap)
        match → push dans foundList, popupSuccess, auto-navigation vers la
        cible non-trouvée la plus proche (getClosestUnfound), re-focus input.
```

Navigation focus (flèches ←/→ ou boutons HUD) : `navigateFocus` maintient un
"trail" d'historique dans des refs (`navigationTrailRef`) ; quand on sort du
trail, `getClosestUnfound` choisit le prochain pays (même région prioritaire).

## 5. src/globe — le rendu 3D

`GlobeMap.jsx` (~590 l.) est un composeur : il branche `<Globe>` sur 16 hooks
`globe/hooks/useGlobe*` + les helpers purs de `globe/render/`. Concerns :

1. **Accessors hoistés** (haut de `GlobeMap.jsx`) — les accessors `path*` du
   layer paths DOIVENT garder une identité stable (sinon `react-globe.gl`
   re-tessellise toute la géométrie à chaque render). Ils sont exportés par
   `useGlobePaths` et hoistés au niveau module.
2. **`useGlobeCamera`** — handle `globeEl` (→ `.scene()`, `.camera()`), suivi
   POV, clamps d'altitude (`render/globeAltitude.js`), auto-rotation.
3. **`useGlobeInteractions`** — tap-detection, sélection, OrbitControls,
   "nudge" de drag (écritures DOM coalescées en 1 rAF/frame).
4. **Palettes de région** — memo unique produisant `REGION_COLORS`,
   `REGION_COLORS_ATTENUATED`, `REGION_COLORS_LABELS` (mêmes clés `GAME_REGIONS`,
   mêmes deps `[globeTheme, theme]`). `UI_COLORS = getThemeColors(globeTheme, theme)`.
5. **`useGlobePolygons`** — couleurs/stroke/matériaux des polygones ;
   ShaderMaterials compilés et cachés (`render/globePolygonMaterial.js`,
   `render/polygonGlitchShader.js`, résolution des couleurs via
   `render/polygonColorResolver.js` + `render/foundGreenPalette.js`).
6. **`useGlobeLabels`** — `labelsData` (memo) + éléments HTML construits par
   `render/globeLabelBuilder.js` (effet glitch/scramble, préfixes via `t()`).
7. **`useGlobePaths` / `useGlobeBiomes`** — fleuves (paths) et reliefs
   (objets 3D `render/LowPolyBiomes.js`).
8. **`useGlobeMaterial`** — matériau du globe : `MeshBasicMaterial` sombre en
   blackout, `MeshPhong` + texture blue-marble en satellite (chargée en async →
   un seul swap au load).
9. **`useGlobeLighting`** — lights attachées à la caméra + mesh "inner glow"
   (sphère BackSide, shader Fresnel de `render/globeShaders.js`). Voir §6 pour
   le flicker.
10. **`useGlobeSceneAnimation` / `useGlobeAnimationLoop`** — boucle rAF : lerp
    du glow vers sa cible, pulse du pays sélectionné, fenêtre bornée de
    re-styling des graticules. **Se met en pause** quand il n'y a rien à animer
    (`hasWork`) pour ne pas pomper le CPU à l'accueil ; relancée sur changement
    de sélection/feedback.

Composant exporté en `React.memo`, monté par `components/GameSessionView.jsx`.

## 6. Système de thèmes (CRITIQUE)

Deux axes **orthogonaux** :

- `theme` : `light` / `dark` → **chrome UI** (panneaux, texte, accents, verre).
- `globeTheme` : `satellite` / `blackout` → **apparence du globe**.

`designSystem.getThemeColors(globeTheme, theme)` = `{ ...THEME[theme], ...GLOBE_THEMES[globeTheme].globeSettings }`.
→ Le chrome vient du `THEME` de base **partagé**. Un `globeTheme` ne doit
overrider QUE des concerns "scène globe" (matériau, glow, graticules, largeur de
trait, mode de couleur des labels, palettes continents/départements). **Conséquence
voulue : changer le thème du globe change le globe, pas l'interface.** Tout ce qui
n'est pas listé dans `globeSettings` reste identique entre satellite et blackout.

Helpers de couleur région : `getThemeRegionColor` (surface), `…Attenuated`
(non-trouvé), `…Label`. Blackout n'a pas de palette `attenuated`/`label` → fallback
calculé par mélange programmatique (pas de `color-mix` CSS, indispo dans three.js).

### Anti-flicker (ne pas régresser)

- Le **inner glow** est *snappé* sur sa couleur cible à la **première** construction
  (`justCreatedLighting` dans `updateGlobeLighting`), au lieu de lerper depuis un
  bleu par défaut → supprime la dérive de couleur lente au chargement. Les
  changements de thème *ultérieurs* gardent le lerp doux dans la boucle d'animation.
- Inner glow **caché en blackout et sur mobile** (intentionnel).
- L'atmosphère intégrée (`atmosphereColor`) est stable pour un même `theme`.

## 7. i18n

`config/i18n.js` exporte `translations.{fr,en}` (objet plat clé→string) et
`useTranslation(lang)` → `t(key, params)`. Interpolation `{param}`. Fallback :
`fr|en` demandé → `en` → la clé elle-même. **Toute chaîne visible passe par `t()`.**
Exceptions assumées : `FR`/`EN` (codes de langue), noms géographiques (datasets).

## 8. Rendu : pièges & perf

- **Identité des accessors `<Globe>`** : garder stables (memo/hoist) sinon
  re-tessellation. Le lint interdit les substrings `pathsData`/`pathStroke`
  littéraux → le JSX les compose par concaténation de clés (`["paths"+"Data"]`).
- **Géométrie** : ne pas swap basse/haute résolution à la sélection ; ne pas
  charger `countries-50m.json` (haute réso) au runtime. (Lint-enforced.)
- **Feedback de sélection** = pas cher : couleur/emissive de matériau, pulse
  d'altitude, rings, transforms CSS. Pas d'overlays 2D ni textures sprite/canvas.
- **Mobile** : boucle rAF throttlée ~30fps ; `perfProfile` réduit labels et
  résolution de courbure ; canvas figé sur le viewport non-contracté
  (`maxWindow*Ref`) pour éviter les sauts au clavier.
- **Caches matériaux** : `polygonMaterialCacheRef`/`sharedMaterialsRef` disposés
  au changement de thème/mode (pas par sélection).

## 9. Comment vérifier un changement

1. `npm run check` (format + lint + tests + build) — obligatoire avant push.
2. Rendu réel : `npm run dev:5001` puis Chrome **avec WebGL logiciel** —
   `--headless=new --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
   --screenshot=out.png --virtual-time-budget=12000 http://localhost:5001/`.
   (`--disable-gpu` seul échoue : "Error creating WebGL context" = limite
   d'environnement, pas un bug.)
3. Vérifier chaque **mode** ET chaque **globeTheme** (satellite/blackout) ET
   `theme` (light/dark) — beaucoup de bugs sont spécifiques à une combinaison.
4. Sur changement de thème : vérifier qu'il n'y a PAS de dérive/clignotement de
   l'atmosphère, et que seul le globe change (pas le chrome UI).

## 10. Dette technique connue

Voir la section "Known tech debt" de `QUALITY.md` (prop drilling de GameHUD,
duplication des tokens designSystem/index.css, cheat codes `WIN100`/`LOSE100`,
etc.).
