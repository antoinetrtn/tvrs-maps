# Changelog - Session tvrs-maps

**Date** : 2026-07-12  
**Branche** : `feature/vercel-limits-and-leaderboard-history`  
**Objectif principal** : Audit structuré + corrections de bugs + refactor pour maintenabilité et "cleanitude" (pas de patches).

---

## 1. Nouveau composant commun pour uniformité (Design System)

- **Nouveaux fichiers** :
  - `src/components/SegmentedControl.jsx` (composant réutilisable pour toggles)
  - `src/components/GlassIconButton.jsx` (bouton icône avec fond glass/blur cohérent)

- Remplacement des toggles custom dans :
  - HomeScreen (profile, leaderboard, settings)
  - ProfilePanel (onglets Profil / Stats)
  - LeaderboardScreen (Classement / Historique)
- Uniformisation des styles via `panelSystem.css` (`.segmented-control`, `.segmented-opt`)
- Amélioration des transitions (spécifiques au lieu de `all` pour éviter le flicker)

---

## 2. Design System & Responsive / Scaling (1080p Windows)

- `src/config/designSystem.js` :
  - Ajout de `uiScale` dans `getThemeCssVariables()`
  - Calcul de scale dynamique selon la largeur viewport (0.78 → 1.0)
  - Variables `--control-*`, `--island-width`, clamps sur polices et tailles
- `src/index.css` et panels : utilisation de `var(--ui-scale)` + `clamp()`
- Correction des UI "énormes" sur écrans 1080p

---

## 3. ProfilePanel - Gros refactor UI/UX

### Scroll & Layout
- Suppression du double scroll (mobile + desktop)
- `.profile-form-header` (username) déplacé **dans** `.profile-form-middle`
- `.avatar-grid` passe en `flex: none; overflow: visible; height: auto`
- Réutilisation exacte de la logique mobile pour tout le monde (sticky name + un seul bloc scrollable)
- Ajout `.profile-sticky-footer`

### Centrage & Taille
- Wrapper `.profile-icon` + `.widget-avatar` avec `position:absolute; transform:translate(-50%,-50%)`
- Alignement cohérent avec le badge de niveau
- Réduction du padding du podium widget (`.home-podium-widget`)
- Correction du bouton profil (taille + glass background manquant)

### Guest mode + Close button (mobile)
- Correction critique : la croix (et le bouton guest) ne fermait plus le panel en mode guest, surtout sur mobile (seul élément cliquable)
- Ajout `if (!isOpen) return null;` **après** tous les hooks (règle React)
- `onClick` de la croix passe à `onClose` (pas `onGuest`)
- Backdrop et header restent cliquables
- `position: relative + z-index: 300/301` sur `.panel-header` et `.panel-close-btn` dans le contexte profile
- `.profile-tab-content { position: relative; }` pour contenir l'overlay blur
- `stopPropagation` explicite sur le handler de fermeture
- Callback stable (`useCallback`) passé depuis HomeScreen
- Overlay blur ne couvre plus le header

### Autres
- `handleSignOutClick` nettoyé
- Sync des inputs avec `userProfile` améliorée

---

## 4. AuthModal - Refactor complet du flux d'authentification

### Hooks & Règles React
- Tous les hooks (`useState`, `useRef`, `useEffect`) déclarés **avant** tout `if` ou early return
- Suppression de l'early return avant les hooks (causait "Rendered more hooks than during the previous render")

### Flux simplifié & robuste
- Suppression du pre-check `checkIfEmailRegistered` (source de 400/422 et d'emails "nouveaux" bloqués sur "vérifier mail")
- Étape unique "password" après email
- Logique **try signin → si échec signup** (dans `handleSubmit`)
- `knownAccountExists` (null/true/false) pour choisir dynamiquement le label du bouton ("Se connecter" / "Créer le compte")
- Plus de ré-écriture du mot de passe après erreur

### Protection rate limit & appels répétés
- `submittingRef` (useRef) pour bloquer les doubles soumissions
- Cooldown 8s sur erreur (useEffect + `isCooldown`)
- Gardes : `if (isCooldown || submittingRef.current || loading)`
- `setPassword('')` + `onClose()` systématique après succès
- Reset de l'état interne quand `!isOpen`

### Fermeture & UX
- `onClose` sur backdrop + bouton X
- `onGuest` seulement sur le bouton dédié
- Succès → fermeture automatique (délai)
- Plus de "verify your email" bloquant

---

## 5. Leaderboard

- `src/components/LeaderboardScreen.css` + `src/panelSystem.css`
- Correction : "en mobile le slider de catégories est pas aligné à gauche"
- Suppression du `padding-left/right: var(--spacing-md)` sur `.leaderboard-panel .nav-chips`
- Les chips (Pays, Capitales, Départements, Reliefs & Fleuves) sont maintenant alignés à gauche du contenu (même bord que le tableau et les stats)
- Règle déplacée/nettoyée pour desktop + mobile

---

## 6. Globe & Animations / Visuels

- `src/config/globeShaders.js` + hooks :
  - Correction du fade-out bizarre au déselection de pays (thème glitch subtil)
  - Radar plus dense et discret en mode capitales
  - Couleurs par continent incohérentes en mode satellite → utilisation cohérente des variables DS
- `src/hooks/useGlobeCamera.js`, `useGlobePolygons.js`, `useGlobeRings.js`, `useGlobeAnimationLoop.js`
- `src/GlobeMap.jsx`, `src/hooks/useGameSession.js`
- Améliorations home offset, transitions, interactions

---

## 7. Autres corrections & nettoyages

- **HomeScreen** :
  - Podium widget + profile trigger uniformisés
  - Gestion `profileOpen` / `leaderboardOpen`
  - Intégration des nouveaux composants communs
- **App.jsx** : logique guest (`tvrs-guest-mode`), `showAuthModal`, `onOpenAuth`
- **useUserProfile.js** : nettoyage + guest handling
- **supabaseClient.js** : suppression de `checkIfEmailRegistered`, ajustement signIn/signUp
- **HomeScreen.css** + **panelSystem.css** : beaucoup de nettoyage (glass, z-index, mobile safe-area, transitions, `.panel-close-btn`)
- **EndScreen.jsx**, **utils/globeLabelBuilder.js**, **tests/gamification.test.js**
- `scripts/quality-check.js` : mise à jour importante
- Ajout `TempTest.jsx` (outil temporaire)

---

## 8. Principes appliqués pendant la session

- Toujours **refactor structurel** plutôt que patch
- Hooks Rules respectées à 100 % (aucun hook après return conditionnel)
- Composants communs pour éviter la dérive de style
- Mobile-first + safe areas
- Protection contre rate limits et double appels
- `if (!isOpen) return null` après hooks pour les panels/modals
- Cohérence Design System (`--glass-*`, `--spacing-*`, `--ui-scale`)

---

**Total** : ~23 fichiers modifiés, +850 insertions / -418 suppressions.

Prêt pour commit ou review.

---

*Généré automatiquement à la fin de la session de travail.*