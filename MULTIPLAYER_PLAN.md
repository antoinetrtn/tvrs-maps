# Plan d'Implémentation : Multijoueur Supabase pour TVRS Maps

Ce plan détaille la mise en place de la persistance, du classement et du mode 1v1 Splatoon-style en utilisant **Supabase** (le service de base de données et de synchronisation temps réel gratuit).

---

## 🛠️ Répartition des Tâches

Pour ce projet, **je m'occupe de 100% de la programmation**. Voici la répartition :

### Ce que JE vais coder entièrement pour toi :
1.  **Installation et Configuration** : Ajout du package `@supabase/supabase-js` et création du client de configuration (`src/services/supabase.js`).
2.  **Création des Écrans React** :
    *   `src/ProfileScreen.jsx` : L'interface complète des comptes, choix d'avatar pixel-art, et classement global.
    *   `src/MultiplayerLobby.jsx` : L'écran de création et de jonction de salons via code unique.
3.  **Refonte de l'interface et du Globe** :
    *   Adaptation de `src/App.jsx` pour orchestrer les sessions, les requêtes et les canaux de synchronisation temps réel Supabase.
    *   Mise à jour de `src/GlobeMap.jsx` pour le rendu bicolore fluide (Cyan/Magenta), la gestion des wireframes et des montagnes conquises.
    *   Modification de `src/GameHUD.jsx` pour la jauge de dominance territoriale et le flux de logs d'action.
4.  **Écriture du Schema de Base de Données** : Je fournis le script SQL prêt à copier-coller.
5.  **Fichier de Configuration `.env.example`** : Pour guider le branchement des clés d'API.

### Ce que TU devras faire manuellement (Très simple) :
1.  **Créer un projet gratuit** sur [Supabase](https://supabase.com) (prend 2 minutes).
2.  **Copier-coller le script SQL** ci-dessous dans l'éditeur SQL de ton projet Supabase pour créer les tables.
3.  **Créer un fichier `.env`** à la racine de ton projet TVRS Maps avec l'URL de ton projet et la clé anonyme (Anon Key) fournie par Supabase.

---

## 💾 Schema SQL à exécuter dans Supabase

Pour initialiser la base de données, il te suffira de coller ce script dans l'onglet **SQL Editor** de ton tableau de bord Supabase :

```sql
-- Active l'extension UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des Profils Utilisateurs
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(30) UNIQUE NOT NULL,
  avatar_id VARCHAR(50) NOT NULL DEFAULT 'invader_1',
  avatar_color VARCHAR(30) NOT NULL DEFAULT 'cyan',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des Records Personnels
CREATE TABLE public.user_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  game_mode VARCHAR(50) NOT NULL,
  max_score INT NOT NULL DEFAULT 0,
  best_time_seconds INT,
  games_played INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_profile_mode UNIQUE(profile_id, game_mode)
);

-- Table du Leaderboard Global (Top Scores)
CREATE TABLE public.leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  game_mode VARCHAR(50) NOT NULL,
  score INT NOT NULL,
  time_spent_seconds INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activation de Supabase Realtime pour les leaderboards et les canaux virtuels
ALTER TABLE public.leaderboards REPLICA IDENTITY FULL;
```

---

## PARTIE 1 : Comptes Utilisateurs, Avatars Invaders & Leaderboard
*   **Difficulté** : Moyenne (3/10)
*   **Temps estimé** : **11 à 15 heures**

### 1. Analyse du Design System (DS) & Réutilisation des composants
Pour rester en phase avec le thème CRT/Blackout de TVRS Maps, nous allons concevoir les éléments suivants :

*   **Avatars Pixel Space Invaders** :
    *   Au lieu de charger de lourdes images externes ou d'utiliser une bibliothèque de tierce partie, nous allons implémenter un composant SVG autonome `<InvaderAvatar invaderId={id} color={color} size={size} />` qui dessine **8 modèles originaux d'envahisseurs de l'espace en pixel-art** sous forme de grilles de rectangles (pixel grid de 8x8 ou 11x8).
    *   Les couleurs d'avatars sélectionnables proviennent de la palette néon rétro existante dans `designSystem.js` :
        *   **Cyan** : `#00f0ff` (gauche/hôte)
        *   **Magenta** : `#ff007f` (droite/invité)
        *   **Lime Green** : `#00ff88` (vert néon)
        *   **Yellow** : `#ffeb3b` (jaune rétro)
        *   **Electric Purple** : `#bd00ff`
*   **Glitch & Scramble Text** :
    *   Le podium exploitera la fonction `scrambleText(text, seed)` de `src/utils.js` pour animer le chargement des pseudos du Top 3.
    *   La police monospace pixelisée et l'opacité glow de la classe `.glass-panel` seront réutilisées pour conserver le style épuré et premium du projet.
*   **Casing Naturel** :
    *   Conformément aux consignes de design du projet, tous les nouveaux labels de sections ("Top Explorers", "Records par Mode", "Leaderboard Mondial") utiliseront une casse de texte naturelle (sans forçage majuscule automatique via CSS).

### 2. Persistance locale (LocalStorage Schema)
Pour conserver une expérience fluide en mode solo hors-ligne (offline-first), le profil et les statistiques locales seront stockés sous cette forme dans le navigateur :
```json
// Clé : "tvrs-user-profile"
{
  "id": "uuid-local-genere-temporaire",
  "username": "Player123",
  "avatarId": "invader_3",
  "avatarColor": "#00f0ff"
}

// Clé : "tvrs-local-records"
{
  "countries": { "maxScore": 42, "bestTime": 180, "gamesPlayed": 5 },
  "capitals": { "maxScore": 20, "bestTime": 240, "gamesPlayed": 2 },
  "departments": { "maxScore": 12, "bestTime": 120, "gamesPlayed": 1 },
  "rivers_mountains": { "maxScore": 8, "bestTime": 300, "gamesPlayed": 1 }
}
```
Lors de la première connexion à Supabase, ces scores locaux seront automatiquement synchronisés pour peupler le profil distant.

### 3. Étapes d'exécution
1.  **Installation & Client** : Configuration de `@supabase/supabase-js` dans `src/services/supabase.js`.
2.  **Création du Composant `<InvaderAvatar>`** dans un nouveau fichier de composant partagé.
3.  **Création du composant `ProfileScreen.jsx`** : Vue tabulée avec édition du profil, grilles de statistiques en verre, et table de classement mondial.
4.  **Intégration du Podium CRT sur `HomeScreen.jsx`** : Intégration en haut du menu, requêtage du top 3 et affichage néon réactif.

---

## PARTIE 2 : Mode 1v1 Temps Réel (Splatoon-style)
*   **Difficulté** : Haute (8/10)
*   **Temps estimé** : **24 à 32 heures**

### 1. Mécaniques de Synchronisation 1v1 via Supabase Broadcast
Pour assurer un jeu 1v1 fluide et sans latence (Splatoon-style) :
*   L'hôte crée un salon virtuel Supabase Realtime avec le canal `realtime:lobby:CODE`.
*   L'invité se branche sur ce canal.
*   Chaque capture de pays ou vol ("steal") émet instantanément un message de type `broadcast` contenant :
    ```json
    {
      "event": "country_conquered",
      "payload": {
        "player": "playerA", -- ou playerB
        "countryKey": "FRA",
        "isSteal": true
      }
    }
    ```
*   Le client local intercepte l'événement, met à jour sa table locale `countryOwners`, applique les points, et déclenche une vibration ou secousse ainsi que des anneaux colorés.

### 2. Adaptation du Rendu 3D (GlobeMap.jsx)
Pour peindre les pays aux couleurs néon (Cyan pour Joueur A, Magenta pour Joueur B) :
*   **`getPolygonColor`** lira la table des propriétaires : si le pays appartient à A, il renvoie le Cyan, si à B, il renvoie le Magenta. Sinon, il applique le style neutre (Blackout ou Satellite standard).
*   **`getPolygonMaterial`** (Règles Satellite) :
    *   Si le pays est conquis, `material.wireframe` passe à `true`. La ligne prend la couleur néon du joueur (Cyan ou Magenta). L'opacité interne (cap) passe à `0.0`.
    *   Si le pays n'est pas conquis, il s'estompe vers `0.0` (cap transparent) et les parois latérales restent masquées.
    *   Le pays sélectionné (focus) par le joueur garde sa texture opaque de bruit télévisuel glitché en noir et blanc.
*   **Performance** : Les matériaux seront mis en cache de manière stable dans `polygonMaterialCacheRef` pour éviter de reconstruire des géométries Three.js à chaque changement de possession.
