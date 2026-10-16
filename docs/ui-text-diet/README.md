# UI Text Diet — Mesure du texte visible

Mesure le volume de texte visible par écran (FR/EN, mobile 390×844 et desktop 1280×800) sans requêtes réseau réelles.

## Commandes d'exécution

```bash
# 1. Démarrer le serveur de développement
VITE_ENABLE_CONQUEST=true VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=mock-anon-key npm run dev:5001

# 2. Lancer la mesure
npm run audit:text -- --base-url http://127.0.0.1:5001 --out docs/ui-text-diet --shots docs/ui-text-diet/shots --label before
```

## Définition d'un « mot visible »

Jeton séparé par des espaces contenant au moins une lettre, issu d'un nœud texte ou d'un champ affiché (`placeholder`, `value`), non masqué (`display: none`, `visibility: hidden`, opacité cumulée < 0,05, `hidden`, `.sr-only`), dans le viewport et non occulté (`document.elementFromPoint`). Les nombres purs sont décomptés séparément.

## Budgets textuels

- **Écrans de menu** : ≤ 12 mots visibles par écran.
- **Boutons** : ≤ 3 mots par bouton (`button`, `[role=button]`, `a.btn*`).
- **Panneaux** : ≤ 1 phrase par panneau (feuille des règles `ConquestRulesSheet` exclue).

## Résultat (FR, avant → après)

Lancer `npm run audit:text -- --label after` (voir commandes ci-dessus). Rapports : `report-before.*` (dev avant la diète) et `report-after.*`.

| Écran | Viewport | Avant | Après |
| :--- | :--- | ---: | ---: |
| home-conquest | mobile | 18 | 4 |
| home-countries | mobile | 16 | 4 |
| settings | mobile | 57 | 12 |
| profile | mobile | 14 | 14 |
| leaderboard | mobile | 26 | 4 |
| auth | mobile | 10 | 7 |
| conquest-entry | mobile | 14 | 6 |
| conquest-lobby | mobile | 30 | 10 |
| conquest-lobby-2p | mobile | 28 | 11 |
| game-hud | mobile | 2 | 2 |
| conquest-hud | mobile | 10 | 10 |
| conquest-end | mobile | 23 | 5 |
| home-conquest | desktop | 18 | 4 |
| home-countries | desktop | 16 | 4 |
| settings | desktop | 44 | 12 |
| profile | desktop | 14 | 14 |
| leaderboard | desktop | 26 | 9 |
| auth | desktop | 10 | 7 |
| conquest-entry | desktop | 14 | 6 |
| conquest-lobby | desktop | 30 | 10 |
| conquest-lobby-2p | desktop | 28 | 11 |
| game-hud | desktop | 8 | 8 |
| conquest-hud | desktop | 10 | 10 |
| conquest-end | desktop | 23 | 5 |

Les écrans « profile » (Succès/Stats), « conquest-hud » et « game-hud » ne sont volontairement pas modifiés par ce ticket.
