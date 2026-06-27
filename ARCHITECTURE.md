# Architecture — TVRS Maps

> Doc destinée aux agents IA (et humains) qui reprennent ce code. Elle décrit
> **où vivent les choses, comment les données circulent, et les pièges**.
> Règles d'édition et dette technique : voir `QUALITY.md`. Ne pas dupliquer ici
> ce qui se déduit du code — ce doc explique le *pourquoi* et la *forme*.

## 1. Vue d'ensemble

Application **React 19 + Vite 8** : un quiz géographique sur un **globe 3D**
(`react-globe.gl` au-dessus de `three`). Pas de backend — les données
géographiques sont des modules JS statiques + deux GeoJSON servis depuis
`public/data/`. Pas de routeur : un seul `App` bascule entre deux écrans
(`home` / `game`) via état local.

Build/serve : `npm run dev:5001` (port 5173 banni), `npm run check` (lint + build).

## 2. Carte des fichiers

```
src/
  main.jsx              Point d'entrée React.
  App.jsx               ~1000 l. Orchestrateur : état global, logique de jeu,
                        routage d'écran, montage de GlobeMap/GameHUD/écrans.
  GlobeMap.jsx          ~3300 l. LE rendu 3D. Tout three.js vit ici.
  GameHUD.jsx           HUD de jeu (input, suggestions, jauges, focus badge).
  HomeScreen.jsx        Menu d'accueil (choix mode, durée, langue, thème globe).
  EndScreen.jsx         Écran de fin de partie.
  ResultsModal.jsx      Tableau des résultats par continent (+ modale info).
  Logo.jsx              Logo SVG animé.

  designSystem.js       SOURCE DE VÉRITÉ couleurs/thèmes/tokens + helpers couleur.
  gameConfig.js         Règles de jeu PAR MODE (scramble, altitude, reliefs,
                        régions GAME_REGIONS, abréviations de régions).
  gameConstants.js      Constantes non-visuelles (durées, breakpoints, timeouts,
                        URLs data, clés localStorage, paliers de perf).
  globeShaders.js       GLSL (Fresnel) du halo d'atmosphère du globe.
  i18n.js               TOUTES les chaînes UI (fr/en) + hook useTranslation.
  utils.js              Helpers purs : normalisation, géométrie GeoJSON,
                        getGameStats (stats par continent), getFlagEmoji…

  gameData.js           countryDataMap (pays : iso2, noms fr/en, capitale, lat/lng, region).
  departmentsData.js    departmentsDataMap (départements FR).
  riversMountainsData.js riversMountainsDataMap (fleuves + reliefs).
  LowPolyBiomes.js      Génération des objets 3D low-poly (montagnes).
  buildData.js          Script hors-runtime de génération des datasets.

public/data/
  countries-50m-low.json     GeoJSON polygones pays (basse résolution = runtime).
  departements-1000m.geojson  GeoJSON départements FR.
```

**Invariants** (détaillés dans `QUALITY.md`) : pas de chaîne UI en dur (→ `i18n.js`),
pas de magic number en dur (→ `gameConstants.js`), pas de couleur brute hors
`designSystem.js`/`index.css`/`Logo.jsx`, listes de régions via `GAME_REGIONS`.
Le lint (`scripts/quality-check.js`) fait respecter une partie de ça
mécaniquement (couleurs, port 5173, certains termes bannis dans GlobeMap).

## 3. Modes de jeu

5 modes, pilotés par la string `mode` dans `App` :

| `mode`            | Dataset actif (`activeDataMap`) | Particularités |
| ----------------- | ------------------------------- | -------------- |
| `countries`       | `countryDataMap`                | Mode par défaut. |
| `capitals`        | `countryDataMap`                | On compare la capitale, pas le nom. |
| `departments`     | `departmentsDataMap`            | Zoom sur la France ; "ghost countries" autour. |
| `rivers_mountains`| `riversMountainsDataMap`        | Reliefs/fleuves rendus comme paths/objets 3D. |
| `learn`           | dataset courant + reliefs       | Pas de score/timer ; labels jamais brouillés ; toggles d'affichage. |

`gameConfig.PLAY_MODES` = modes "quiz" (tout sauf `learn`). Les règles communes
(brouillage du label, altitude d'extrusion, taille des reliefs) sont
centralisées dans `gameConfig.js` pour que les modes ne divergent pas visuellement.

## 4. Flux de données et état (App.jsx)

`App` détient ~20 `useState` (jeu + UI). Les plus structurants :

- **Écran** : `currentScreen` (`home`|`game`), `showEndScreen`, `showResultsTable`, `showInfoModal`.
- **Jeu** : `mode`, `foundList` (clés trouvées), `score`, `timeLeft`/`gameDuration`,
  `isPlaying`, `isGameOver`, `selectedCountry` (cible "focus" courante).
- **Thème** : `theme` (`dark`|`light`, = chrome UI), `globeTheme` (`satellite`|`blackout`, = apparence du globe). Persistés via `localStorage` (`STORAGE_KEYS.globeTheme`). `setGlobeTheme('blackout')` force `theme='dark'`.
- **Langue** : `lang` (`fr`|`en`).
- **Learn toggles** : `learnShow{CountryLabels,Capitals,Rivers,Mountains}`.
- **Viewport/clavier mobile** : `viewport` (via `visualViewport`), détection clavier
  par comparaison de hauteur à une baseline (`initialWidth/Height`).

**Boucle de saisie** (cœur du gameplay) :

```
GameHUD (input) ── onEnter(val) ──▶ App
   ├─ mode === 'learn'      → handleSearch  (sélectionne sans scorer)
   ├─ selectedCountry set   → specificCountryGuess (compare à la cible focus)
   └─ sinon                 → handleInput   (cherche dans tout activeDataMap)
        match → push dans foundList, popupSuccess, auto-navigation vers la
        cible non-trouvée la plus proche (getClosestUnfound), re-focus input.
```

Navigation focus (flèches ←/→ ou boutons HUD) : `navigateFocus` maintient un
"trail" d'historique dans des refs (`navigationTrailRef`) ; quand on sort du
trail, `getClosestUnfound` choisit le prochain pays (même région prioritaire).

`activeDataMap`, `allCountryKeys`, `perfProfile`, `appStyle` (variables CSS) sont
mémoïsés. `App` passe ~25 props à `GlobeMap` et ~30 à `GameHUD` (prop drilling
assumé — voir dette technique dans QUALITY.md).

## 5. GlobeMap.jsx — le rendu 3D

Gros fichier, mais structuré en blocs (dans l'ordre) :

1. **Constantes & accessors hoistés** (haut du fichier) — les accessors `path*`
   du layer paths DOIVENT garder une identité stable (sinon `react-globe.gl`
   re-tessellise toute la géométrie à chaque render). Shaders → `globeShaders.js`.
2. **Refs** — `globeEl` (handle react-globe.gl → `.scene()`, `.camera()`),
   caches de matériaux (`polygonMaterialCacheRef`), refs lues dans la boucle rAF
   (`selectedCountryRef`, `isErrorRef`, `isSuccessRef`) pour éviter de recréer la
   boucle à chaque sélection.
3. **Pointer/touch handlers** — tap-detection, sélection, OrbitControls, suivi
   POV caméra, "nudge" de drag (écritures DOM coalescées en 1 rAF/frame).
4. **Palettes de région** — un seul memo produit `REGION_COLORS`,
   `REGION_COLORS_ATTENUATED`, `REGION_COLORS_LABELS` (mêmes clés `GAME_REGIONS`,
   mêmes deps `[globeTheme, theme]`). `UI_COLORS = getThemeColors(globeTheme, theme)`.
5. **Logique polygones** — `getPolygonColor/Stroke/SideColor`, `getPolygonMaterial`
   (compile des ShaderMaterials, mis en cache par clé). Brouillage du label =
   `shouldScrambleLabel` (gameConfig).
6. **Labels** — `labelsData` (memo) + `createLabelElement` (construit du HTML brut,
   avec effet glitch/scramble). Utilise `t()` pour les préfixes (ex. `Dpt`).
7. **Reliefs & fleuves** — `rivers*PathData`, `mountains*PathData`, objets 3D biomes.
8. **Matériau du globe & texture** — `globeMaterial` (memo) : `MeshBasicMaterial`
   sombre en blackout, `MeshPhong` + texture blue-marble en satellite (chargée en
   async → un seul swap au load).
9. **Éclairage & halo (`updateGlobeLighting`)** — lights attachées à la caméra +
   un mesh "inner glow" (sphère BackSide, shader Fresnel). Voir §6 pour le flicker.
10. **Boucle rAF (`animateScene`)** — lerp du glow vers sa cible, pulse du pays
    sélectionné, fenêtre bornée de re-styling des graticules. **Se met en pause**
    quand il n'y a rien à animer (`hasWork`) pour ne pas pomper le CPU à l'accueil ;
    un effet séparé la relance sur changement de sélection/feedback.
11. **JSX `<Globe>`** — branche tous les accessors/data. `globeImageUrl={null}`,
    `globeMaterial={globeMaterial}`, atmosphère intégrée (`showAtmosphere`).

Composant exporté en `React.memo`.

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
  changements de thème *ultérieurs* gardent le lerp doux dans `animateScene`.
- Inner glow **caché en blackout et sur mobile** (intentionnel).
- L'atmosphère intégrée (`atmosphereColor`) est stable pour un même `theme`.

## 7. i18n

`i18n.js` exporte `translations.{fr,en}` (objet plat clé→string) et
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

1. `npm run check` (lint + build) — obligatoire avant push.
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

Voir la section "Known tech debt" de `QUALITY.md` (state sprawl d'App,
prop drilling de GameHUD, extraction des gros blocs de GlobeMap, cheat codes
`WIN100`/`LOSE100`, etc.).
