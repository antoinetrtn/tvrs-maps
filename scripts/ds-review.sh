#!/usr/bin/env bash
# ds-review.sh — revue design system d'une PR avant merge dans dev (sur la box, via Antigravity CLI).
# Usage : scripts/ds-review.sh [base=origin/dev] [model=gemini-3.8-flash-high]
# Sans crédits Gemini (ou sans agy), affiche le diff + la checklist : la revue est alors faite à la main.
set -uo pipefail
BASE="${1:-origin/dev}"
MODEL="${2:-gemini-3.8-flash-high}"
AGY="${AGY:-$HOME/.local/bin/agy}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 1
git fetch -q origin dev || true

echo "== 1. check:ds (bloquant)"
npm run -s check:ds || { echo "check:ds en échec : corriger avant toute revue."; exit 1; }

DIFF="$(git diff "$BASE"...HEAD -- src ':!src/tests')"
[ -z "$DIFF" ] && { echo "Aucun diff src/ : rien à revoir."; exit 0; }

PROMPT="N'utilise aucun outil. Tu es le relecteur design system de TVRS Maps. Règle : chaque élément (bouton, modal valider+croix, slider, toggle, input, carte, layout, animation, couleur/token) est défini UNE fois dans src/components/ui, src/styles/keyframes.css/motion.css et src/config/designSystem.js. Voici les règles du repo :
$(cat docs/design-system-lint.md)

Relis ce diff. Liste UNIQUEMENT les recompositions/duplications d'atomes (fichier:ligne, atome du DS à utiliser à la place). Termine par une ligne 'VERDICT: OK' ou 'VERDICT: A CORRIGER'. N'édite aucun fichier.

DIFF:
$DIFF"

echo "== 2. revue Gemini ($MODEL)"
if [ -x "$AGY" ] && OUT="$(timeout 600 "$AGY" --model "$MODEL" -p "$PROMPT" 2>&1)" \
   && grep -q 'VERDICT:' <<<"$OUT"; then
  echo "$OUT"
  grep -q 'VERDICT: A CORRIGER' <<<"$OUT" && exit 2
  exit 0
fi
echo "Gemini indisponible (crédits épuisés ou agy absent) : revue manuelle requise."
echo "Checklist : pas de <button>/<input>/modal hors ui/, pas de @keyframes local, pas de classe -btn/-modal/-card locale, pas de couleur/durée/z-index en dur, variantes ajoutées au primitive plutôt que dupliquées."
git diff --stat "$BASE"...HEAD
exit 3
