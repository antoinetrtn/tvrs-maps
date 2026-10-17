# Sélection Explicite des Réponses (TVRS Maps)

Ce document décrit le fonctionnement et les choix d'architecture de l'autocomplétion et de la sélection de réponses dans TVRS Maps.

## 1. Contexte & Problématique

Dans l'ancien comportement du HUD de jeu (`GameHUD`), un joueur pouvait saisir le nom exact d'une entité puis appuyer sur Entrée pour la valider sans passer par les suggestions. De plus, les suggestions ne s'affichaient qu'à partir de 4 caractères et 80% du mot, et Entrée / Tab validait automatiquement la première suggestion. En pratique, cela permettait de deviner au hasard avec des débuts de mots courts.

## 2. Nouveau Comportement

Dans tous les modes de jeu de quiz (`countries`, `capitals`, `departments`, `us_states`, `rivers_mountains` — tout mode distinct de `learn`) :
- Une réponse n'est envoyée au moteur de jeu (`onEnter`) **que si une suggestion a été choisie explicitement** :
  - par clic ou tap tactile direct sur une option,
  - ou par navigation au clavier (touches `ArrowDown` / `ArrowUp` pour surligner l'option) puis `Enter`.
- Appuyer sur `Enter` avec du texte saisi mais sans suggestion surlignée déclenche un **rejet sobre** :
  - `onEnter` n'est pas appelé.
  - Aucune pénalité n'est comptée (aucune vie perdue en mode hardcore).
  - Léger shake de `.input-island` en steps CSS (classe `is-rejected`, durée ~280ms, pas de glow ni easing lisse).
  - La liste de suggestions se (ré)ouvre immédiatement.
  - Annonce discrète pour lecteur d'écran via une zone `aria-live="polite"` (`t("answer_pick_hint")`).
- Appuyer sur `Enter` avec un champ vide ne fait rien.

## 3. Décisions de Design

### 3.1. Aucune pré-surbrillance (`activeIndex = -1`)
Par défaut, aucune suggestion n'est activement pré-surlignée dans la liste, même si la chaîne saisie correspond exactement au nom ou à un préfixe d'un pays.
**Justification** : Si la première suggestion était pré-surlignée, taper "ma" puis Entrée validerait Madagascar (ou une autre entrée) au hasard. L'intention du joueur doit être explicite.

### 3.2. Univers complet avec marquage "trouvé"
La liste de suggestions inclut **toutes les entités du mode**, y compris celles déjà trouvées (`foundList`).
**Justification** : Exclure les pays déjà trouvés révélerait par élimination ce qui reste à trouver, voire le pays ciblé lorsque le focus est actif.
Les entités déjà trouvées sont :
- Atténuées visuellement (`opacity: 0.5`).
- Accompagnées d'un glyphe `✓` (`aria-hidden="true"`) et d'un texte accessible `sr-only` (`t("suggestion_found")`).
- Porteuses de l'attribut `data-found="true"`.
- Choisir une entité déjà trouvée transmet normalement sa valeur à `onEnter`, qui affiche l'avertissement existant `ALREADY_FOUND`.

### 3.3. Règles de matching & seuil
- Texte normalisé via `normalizeString` (insensible aux accents, à la casse, tirets/apostrophes convertis en espaces).
- Seuil d'apparition : **>= 3 caractères normalisés**, OU **égalité exacte** sous le seuil (ex. aliases courts "UK", départements courts "Ain").
- Conditions de correspondance :
  1. Préfixe du nom (ou capitale selon le mode).
  2. Préfixe d'un des mots du nom (ex: "unis" -> "États-Unis").
  3. Préfixe d'un alias dans les modes dont `targetCheck === "name"`.
- Tri : égalité exacte d'abord, puis préfixe du nom, puis préfixe de mot / alias, puis ordre alphabétique (`localeCompare`).
- Dédoublonnage : par nom affiché normalisé (si au moins une clé dupliquée n'est pas trouvée, `found = false`).
- Limite : 5 suggestions maximum.

### 3.4. Navigation Clavier & Accessibilité (ARIA 1.2 Combobox)
- `Tab` : n'est plus intercepté en mode de jeu (comportement navigateur natif préservé).
- `Escape` : referme la liste de suggestions.
- `ArrowDown` / `ArrowUp` : déplacent la surbrillance avec boucle (wrap) et `preventDefault`. Toute nouvelle frappe réinitialise `activeIndex` à `-1`.
- Motif ARIA : `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` pointant vers la liste `role="listbox"`, options en `role="option"`, `aria-selected` synchronisé et `aria-activedescendant` absent quand aucune suggestion n'est surlignée.

### 3.5. Mode Apprendre (`learn`)
Le mode `learn` conserve son comportement historique à l'identique :
- Recherche sur le nom ET la capitale.
- Seuil à 4 caractères.
- `Enter` et `Tab` sélectionnent la première suggestion s'il y en a, sinon valident la recherche.

### 3.6. Conquête 1v1 (Multijoueur)
Le mode multijoueur Conquête n'utilise pas de composant d'autocomplétion (interaction globe et validation RPC serveur) et reste strictement hors du périmètre de cette fonctionnalité front-end.
