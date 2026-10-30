# Design system — lint atomique

Règle : chaque type d'élément (bouton, modal avec bouton valider + croix, slider, toggle, champ, carte, layout, animation) est défini **une seule fois** dans le design system, puis réutilisé partout. Rien n'est recomposé dans le jeu.

## Source unique

| Élément | Défini dans |
| --- | --- |
| Boutons | `src/components/ui/Button.jsx`, `IconButton.jsx`, `PanelCloseButton.jsx` ; surface cliquable nue (pastille, tuile avatar/badge, ligne de tableau) : `ui/Pressable.jsx` |
| Modal / sheet (titre, valider, croix) | `src/components/ui/Dialog.jsx` |
| Slider / Toggle / Choix | `ui/Slider.jsx`, `ui/Switch.jsx`, `ui/OptionGroup.jsx` |
| Champs | `ui/TextField.jsx` (`variant="bare"` : input nu stylé par son conteneur, ex. îlot de réponse) |
| Onglets, états, toasts, réglages | `ui/TabBar.jsx`, `ui/StateBlock.jsx` (+ Empty/Error/Loading), `ui/Toast.jsx`, `ui/Settings.jsx` |
| Animations (`@keyframes`) | `src/styles/motion.css` / `src/styles/keyframes.css` (ou interne à un primitive `ui/`) |
| Couleurs / tokens | `src/config/designSystem.js` + `:root` de `src/index.css` (`check:tokens`, `check:css-rules`) |

## Règles lint (`npm run check:ds`, `scripts/check-ds-atoms.mjs`)

| Règle | Interdit hors `src/components/ui/` |
| --- | --- |
| `raw-button` | `<button>` natif |
| `raw-input` | `<input>`, `<select>`, `<textarea>` natifs |
| `raw-dialog` | `<dialog>`, `role="dialog"`, `aria-modal` (modal recomposée) |
| `local-keyframes` | `@keyframes` hors `src/styles/motion.css` / `keyframes.css` |
| `adhoc-atom-class` | sélecteur CSS `.xxx-btn / -button / -modal / -slider / -toggle / -switch` (restyle local d'un atome) |

Fonctionnement en ratchet : les violations existantes sont figées dans `scripts/ratchet-baselines/ds-atoms.json`. Toute nouvelle violation fait échouer `npm run check` et la CI (`Quality Check`, PR vers `dev`/`main`). Une règle à 0 devient donc bloquante à 100 %. Après une correction : `npm run check:ds -- --update`. Ne jamais remonter la baseline.

Exception revue en PR : commentaire `ds-atoms-allow: <règle> — raison` sur la ligne ou la ligne du dessus.

Complète les garde-fous existants : `check:tokens` (tokens fantômes, sync dark), `check:css-rules` (hex, durées, z-index, radius, ombres… en ratchet), `check:a11y`, ESLint + jsx-a11y.

## Blocage du merge (GitHub)

Protection de la branche `dev` : PR obligatoire (0 review requise), check requis **`Lint, Test, and Build`** (workflow `Quality Check`, qui lance `check:ds`), branche à jour avec `dev` exigée (strict). `main` n'est pas modifiée.

## Revue design system avant chaque merge dans dev

Pas de clé API, pas d'Action Gemini : la revue tourne sur la box avec l'abonnement existant via Antigravity CLI.

1. `scripts/ds-review.sh` (ou `scripts/ds-review.sh origin/dev gemini-3.8-flash-medium`) :
   - lance `npm run check:ds` (bloquant) ;
   - envoie le diff `src/` + ce document à Gemini (`agy --model gemini-3.8-flash-high -p …`) qui liste les atomes recomposés et rend `VERDICT: OK` / `VERDICT: A CORRIGER`.
2. Corriger les duplications signalées, relancer jusqu'à `VERDICT: OK`.
3. Si Gemini n'a plus de crédits (code de sortie 3), le script affiche la checklist et le diff : la revue est faite à la main avant le merge.

Codes de sortie : 0 OK · 1 check:ds en échec · 2 Gemini demande des corrections · 3 revue manuelle requise.
