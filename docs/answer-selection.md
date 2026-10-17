# Sélection sur le globe obligatoire

Ce document décrit le fonctionnement de la saisie de réponse et de la sélection géographique dans TVRS Maps.

## 1. La Règle Fondamentale

Dans tous les modes de jeu solo (`countries`, `capitals`, `departments`, `us_states`, `rivers_mountains` — tout mode distinct de `learn`) :
- Une réponse ne peut être validée que si une entité est activement **sélectionnée sur le globe** (`selectedCountry` non nul).
- Taper une réponse (ex: « France ») puis appuyer sur Entrée sans sélection sur le globe **ne fait rien** : aucune validation, aucune vie perdue en mode hardcore, aucune faute comptée, aucun effacement du champ.
- **Objectif pédagogique** : apprendre à localiser précisément sur le globe plutôt que de deviner des noms au hasard.

## 2. Flux par Mode

### Modes Solo Quiz (`countries`, `capitals`, `departments`, `us_states`, `rivers_mountains`)

Le comportement est rigoureusement identique pour l'ensemble des modes solo :

1. **Sans entité sélectionnée sur le globe (`requireSelection = true`)** :
   - Placeholder du champ : « Sélectionne sur le globe » (`answer_placeholder_select`).
   - Liste de suggestions complètement masquée (`suggestions = []`, aucun `role="listbox"` dans le DOM).
   - Appuyer sur `Enter` avec du texte non vide déclenche un rejet visuel sobre :
     - Shake CSS `.input-island.is-rejected` (rejouable à chaque frappe d'Entrée consécutive, durée 280 ms).
     - Le champ n'est pas vidé.
     - `onEnter` n'est pas appelé.
     - Annonce d'accessibilité discrète via `aria-live="polite"` : « Sélectionne un pays sur le globe » (`select_on_globe_hint`).
   - Appuyer sur `Enter` avec un champ vide ne fait rien.
   - Tout appel à `choose()` est bloqué.

2. **Avec une entité sélectionnée sur le globe (`requireSelection = false`)** :
   - Placeholder habituel du mode.
   - La liste de suggestions sert d'aide orthographique.
   - `Enter` **sans suggestion surlignée** : transmet directement le texte saisi au moteur (`onEnter(currentValue)`). Si la réponse est acceptée, le champ est vidé, la liste fermée et le focus conservé.
   - `Enter` **avec suggestion surlignée** (`ArrowDown` / `ArrowUp`) : valide la suggestion (`choose(activeIndex)`).
   - Clic / tap sur une suggestion : valide la suggestion.

### Mode Apprendre (`learn`)

Strictement inchangé :
- Aucune sélection sur le globe n'est requise.
- Recherche sur le nom et la capitale.
- `Enter` et `Tab` sélectionnent la première suggestion s'il y en a une, sinon valident la recherche globale.

### Débogage DEV

En environnement de développement (`import.meta.env.DEV`), les mots-clés de test `WIN100` et `LOSE100` restent fonctionnels sans sélection préalable sur le globe.

### Conquête 1v1 (Multijoueur)

Hors périmètre : la saisie en Conquête 1v1 envoie directement le nom saisi au serveur via RPC sans exiger de sélection préalable sur le globe. Ce flux n'est pas modifié.

## 3. Bilan par Rapport à la PR #175

### Ce qui est annulé
- L'obligation de choisir impérativement une suggestion dans la liste déroulante pour pouvoir valider.
- Le message et le shake de rejet « Choisis dans la liste » (`answer_pick_hint` supprimé).

### Ce qui est conservé
- **Aucune pré-surbrillance** (`activeIndex = -1` par défaut) : la sélection sur le globe fait foi, la liste n'est qu'une aide d'orthographe. `Enter` n'auto-valide jamais la première suggestion par hasard.
- **Univers complet** : les entités déjà trouvées restent visibles dans la liste avec `✓`, état atténué et `data-found="true"`.
- **Seuil de 3 caractères** normalisés (ou correspondance exacte sous le seuil).
- **Touche `Tab` native** non interceptée en cours de partie.
- **Accessibilité ARIA 1.2 Combobox** complète (`role="combobox"`, `aria-expanded`, `aria-activedescendant`).
- **Compatibilité multi-modes** : respect du `targetCheck` (y compris fix `us_states`).
