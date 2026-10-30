# Design system — lint atomique

Règle : chaque type d'élément (bouton, modal avec bouton valider + croix, slider, toggle, champ, carte, layout, animation) est défini **une seule fois** dans le design system, puis réutilisé partout. Rien n'est recomposé dans le jeu.

## Source unique

| Élément | Défini dans |
| --- | --- |
| Boutons | `src/components/ui/Button.jsx`, `IconButton.jsx`, `PanelCloseButton.jsx` |
| Modal / sheet (titre, valider, croix) | `src/components/ui/Dialog.jsx` |
| Slider / Toggle / Choix | `ui/Slider.jsx`, `ui/Switch.jsx`, `ui/OptionGroup.jsx` |
| Champs | `ui/TextField.jsx` |
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

## Agent de vérification Gemini (prévu, pas encore actif)

Job GitHub Action `ds-review` sur `pull_request` → `dev` : récupère le diff, lance `npm run check:ds` (bloquant), puis Gemini 3.8 (clé en secret de repo) relit le diff avec ce document en contexte pour repérer ce que les regex ratent (carte ou layout recomposé, variante dupliquée). Il commente la PR et met un statut `ds-review` en échec si un atome est recomposé. Pour bloquer le merge : ajouter `Lint, Test, and Build` puis `ds-review` aux checks requis de la protection de branche `dev`.
