# Sources des données cartographiques

Fichiers d'origine, **non servis** par l'app. `npm run build:geodata` (script
`scripts/build-geodata.mjs`) les transforme en GeoJSON compacts dans `public/data/`.
Ne pas éditer `public/data/*` à la main : modifier la source ou le script puis régénérer.
`npm run check:geodata` (et le test `src/tests/geodataBuild.test.js`) échouent si
`public/data/*` n'est pas à jour.

| Source | Sortie | Origine |
|---|---|---|
| `countries-50m-low.source.json` | `countries-50m-low.json` | Natural Earth « Admin 0 – Countries » 1:50m, version déjà simplifiée du dépôt (241 entités, 71 propriétés Natural Earth). |
| `departements-1000m.source.geojson` | `departements-1000m.geojson` | Contours des départements français (109 entités, métropole et outre-mer, propriétés `code`, `nom`, `region`). |
| `us-states.source.json` | `us-states.json` | Contours des États américains (52 entités avec DC et Porto Rico, propriétés `name`, `density`, `id` FIPS). |

## Transformations appliquées (sans changer le format GeoJSON)

1. Coordonnées arrondies à **3 décimales** (≈ 110 m ; erreur maximale mesurée : 0,0007° ≈ 78 m,
   soit moins d'un pixel à l'altitude de caméra la plus basse). L'arrondi est identique pour
   toutes les entités : les frontières partagées restent exactement confondues.
2. Points consécutifs identiques supprimés après arrondi (anneaux toujours refermés ; un anneau
   de moins de 4 points ou une entité vide ferait échouer le script).
3. Propriétés réduites à celles que le code lit (voir `DATASETS` dans le script) :
   - pays : `ADMIN` (clé de jeu, fusion Somalie/Somaliland) et `ISO_A3` (identifiant stable) ;
   - départements : `code`, `nom`, `region` ; États : `name` (+ `id` FIPS au niveau entité).
   Les 69 autres propriétés Natural Earth et `density` ne sont lues nulle part dans `src/`.
4. JSON compact (sans indentation), sortie déterministe.

Pour changer la précision ou une propriété conservée : éditer `DATASETS`, lancer
`npm run build:geodata`, puis vérifier les captures et `src/tests/polygonCapSag.test.js`.
