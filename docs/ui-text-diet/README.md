# UI Text Diet — Mesure du texte visible

Mesure le volume de texte visible par écran (FR/EN, mobile 390×844 et desktop 1280×800) sans requêtes réseau réelles.

## Commandes d'exécution

```bash
# 1. Démarrer le serveur de développement
VITE_ENABLE_CONQUEST=true VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=mock-anon-key npm run dev:5001

# 2. Lancer la mesure
node scripts/ui-text-diet.mjs --base-url http://127.0.0.1:5001 --out docs/ui-text-diet --shots docs/ui-text-diet/shots --label before
```

## Définition d'un « mot visible »

Jeton séparé par des espaces contenant au moins une lettre, issu d'un nœud texte ou d'un champ affiché (`placeholder`, `value`), non masqué (`display: none`, `visibility: hidden`, opacité cumulée < 0,05, `hidden`, `.sr-only`), dans le viewport et non occulté (`document.elementFromPoint`). Les nombres purs sont décomptés séparément.

## Budgets textuels

- **Écrans de menu** : ≤ 12 mots visibles par écran.
- **Boutons** : ≤ 3 mots par bouton (`button`, `[role=button]`, `a.btn*`).
- **Panneaux** : ≤ 1 phrase par panneau (feuille des règles `ConquestRulesSheet` exclue).
