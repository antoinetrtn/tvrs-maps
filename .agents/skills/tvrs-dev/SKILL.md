---
name: tvrs-dev
description: "Aide au développement du jeu tvrs-maps (Vite, Supabase, Playwright)"
---

# Compétence de Développement TVRS Maps

Ce guide fournit les instructions spécifiques pour développer, tester et interagir avec la base de données de `tvrs-maps`.

## 1. Structure du Projet
- `src/` : Code source React (composants UI, Globe 3D avec `react-globe.gl` et `three`).
- `supabase/migrations/` : Fichiers SQL de migration pour le schéma de la base de données.
- `tests/` : Tests de bout en bout (E2E) utilisant Playwright.
- `src/types/supabase.ts` : Types TypeScript statiques correspondants aux tables Supabase.

---

## 2. Commandes de Validation Locale
Toujours exécuter et valider localement avant de pousser :
*   `npm run lint` : Lance l'analyseur statique et vérifie la qualité du code.
*   `npm run test` : Lance Vitest pour les tests unitaires.
*   `npm run test:e2e` : Lance Playwright pour exécuter les tests de bout en bout (démarre automatiquement le serveur local sur le port 5001).
*   `npm run check` : Chaîne les tests lint, unitaires et le build de production pour valider l'ensemble du projet.

---

## 3. Base de données & Migrations
Pour modifier le schéma de base de données :
1. Créez une nouvelle migration locale : `npm run supabase:migration <nom>`
2. Écrivez le code SQL dans le nouveau fichier généré sous `supabase/migrations/`.
3. Poussez sur la branche `dev`. La CI/CD se chargera d'appliquer automatiquement la migration sur l'instance de développement.
4. Une fois validé, la fusion sur `main` appliquera la migration sur l'instance de production.
