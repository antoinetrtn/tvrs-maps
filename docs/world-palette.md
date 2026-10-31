# Palette « monde » — base pixel du globe

Objectif : quand la carte est activée (pays trouvés, accueil illuminé), la terre affiche des couleurs crédibles de la vraie Terre, en **pixels carrés stricts** (NearestFilter, pas d'étirement, pas de flou). L'océan n'est pas touché. Les pays non trouvés restent en blackout (avec un léger indice de teinte à 34 % × 0,3 hors modes régionaux).

## Références (URLs vérifiées le 30/10/2026)

| Source | Usage | URL |
|---|---|---|
| NASA Blue Marble 2002 (copie Wikimedia Commons, 24000×12000) | **Donnée source** : classification par texel + échantillonnage des couleurs | https://commons.wikimedia.org/wiki/File:Whole_world_-_land_and_oceans_12000.jpg |
| NASA Visible Earth — collection Blue Marble | Référence visuelle (BMNG) | https://visibleearth.nasa.gov/collection/1484/blue-marble |
| NASA Earth Observatory — Blue Marble | Méthode / contexte | https://earthobservatory.nasa.gov/features/BlueMarble |
| ESA CCI Land Cover | Nomenclature des classes (forêt, prairie, zones humides…) | https://climate.esa.int/en/projects/land-cover/ |
| Copernicus Global Dynamic Land Cover | Contrôle de cohérence des classes | https://land.copernicus.eu/en/products/global-dynamic-land-cover |
| Köppen-Geiger (Beck et al. 2018, Scientific Data) | Seuils de latitude (taïga/toundra, steppe/désert) | https://www.nature.com/articles/sdata2018214 — carte : https://www.gloh2o.org/koppen/ |
| Natural Earth raster (relief ombré) | Référence de lecture cartographique | https://www.naturalearthdata.com/downloads/10m-raster-data/ (bloque les robots, OK navigateur) |
| WWF Terrestrial Ecoregions | Répartition des biomes (savane, steppe, toundra) | https://www.worldwildlife.org/publications/terrestrial-ecoregions-of-the-world (bloque les robots, OK navigateur) |

## Éléments de terrain

Eau intérieure (lacs), eaux peu profondes côtières (bordure terre uniquement, shader océan intact), glace / inlandsis, toundra, taïga (forêt boréale), forêt tempérée, prairie / bocage, forêt tropicale, savane, steppe, désert de sable (ergs), désert de roche (regs, centre australien), montagne + neige d'altitude, zones humides.

Détails pixel-art (runtime, sur la vraie luminance) : tramage Bayer 4×4, couronnes de canopée 2×2 en forêt, acacias épars en savane/steppe, lichens en toundra, crêtes de dunes, neige sur les sommets (niveau ≥ 11), crevasses sur la glace.

## Palette

Échantillon brut = percentiles 15/50/85 % mesurés sur la Blue Marble pour les texels de la classe. Version « éveillée » = [ombre, base, lumière, accent] utilisée par le shader (rehaussée pour l'affichage sombre de l'app, teintes conservées). Version « blackout » = éveillée × 0,3 mélangée à 34 % sur les pays non trouvés.

| Élément | Blue Marble brut (15/50/85) | Éveillé (ombre / base / lumière / accent) |
|---|---|---|
| Lacs | #0b0a32 #0f132c #25304a | #1d3b5a #24506e #2f6584 #4f86a0 |
| Eaux peu profondes | #0e2932 #0f2f38 #10323c | #1f5868 #2a7080 #3a8a94 #5aa8a8 |
| Glace | #8c9092 #b1aea9 #d5d1ca (Groenland #fefefe) | #9fb3c4 #c6d3dd #e4ecf1 #7f9db8 |
| Toundra | #41461d #4d4e2a #655e3d | #5b6034 #6f7240 #878452 #8a5f5a |
| Taïga | #263210 #2c3d0e #364614 | #1f4a32 #2a5a3a #386a44 #4f7d50 |
| Forêt tempérée | #223312 #2d4112 #354913 | #2f5a1e #3e6c24 #52802e #6d9436 |
| Prairie | #3d4e18 #44561e #555f2c | #4f7425 #5f832e #77963c #9aa84a |
| Forêt tropicale | #20360d #2a3e10 #364714 | #1b5a1c #237022 #33872a #5aa632 |
| Savane | #404e1a #515925 #746f3d | #6f7a2e #8a8a3c #a89a52 #3f6224 |
| Steppe | #56512f #70653f #85774d | #7a7444 #938652 #ad9b63 #6c7a3c |
| Désert de sable | #c5a87e #efc694 #fcecaf | #c9995e #ddb273 #edca8c #f5dca4 |
| Désert de roche | #9b6d4c #9f875b #b2956a | #8f5a3a #a8704a #bf8a5e #6f4430 |
| Montagne / neige | #6a6864 #85817a #9b968c | #7d7a76 #9a958c #b8b2a6 #e8ecef |
| Zones humides | #1a251e #27351b #3a462c | #2a4a3c #345a40 #44694a #2f6070 |

Points témoins : Rub al-Khali #fdf8b6, centre rouge australien #8e6244, Amazonie #21390b, Sahel #5c7226, steppe kazakhe #89754a, Bahamas (hauts-fonds) #0d2e44.

## Construction de la donnée

`scripts/build-world-landcover.py <blue-marble.jpg>` réduit la Blue Marble en 1440×720 (0,25°), retire la mer par remplissage depuis des graines océaniques (Méditerranée, mer Noire, mer Rouge, Baltique, golfe Persique, Caspienne… comprises), classe chaque texel (couleur + latitude, sable testé avant glace), propage la terre de 3 texels sur la côte, et écrit `public/textures/world-landcover-1440.png` en gris : `classe*16 + niveau de luminance (0–15)`. Pas de pseudo-aléatoire.

Runtime : `biomeTexture.js` charge le PNG, `worldPalette.js#bakeLandcover` convertit en RGBA dans une DataTexture 1440×720 NearestFilter sans mipmaps (alpha = donnée présente), échantillonnée en coordonnées lat/lng (`cartUv`). Coût GPU : 1 lecture de texture par fragment de terre.

Parité : bloc GLSL dans `globeShaders.js` et jumeau TSL dans `webgpu/biomeNodes.js` (mêmes poids : révélation 0,92, indice 0,34 × 0,3, désactivé en fantôme et satellite, indice coupé en mode régional).
