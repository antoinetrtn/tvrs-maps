# TVRS Maps - Guide de Développement (CI/CD, Git & Supabase)

Ce document décrit le flux de développement, les règles de branchement, l'architecture CI/CD et les procédures de migration de base de données utilisées pour le projet **TVRS Maps**.

---

## 1. Modèle de Branchement Git

La structure de branches est configurée ainsi :

*   **`dev` (Branche par défaut)** : Toute l'intégration continue se fait ici. C'est la branche principale de développement. Toutes les nouvelles fonctionnalités ou corrections y sont fusionnées.
*   **`main` (Branche de production)** : Contient le code stable en production. Les déploiements vers la production Vercel sont déclenchés lors des pushes/merges sur cette branche.
*   **`feat/*` et `fix/*`** : Branches temporaires créées à partir de `dev` pour développer une fonctionnalité ou corriger un bug.

### Règles et Protections
1.  **Interdiction de Push Direct** : Les branches `dev` et `main` sont protégées. Tout changement doit passer par une Pull Request.
2.  **Validation par la CI obligatoire** : Les PR vers `dev` et `main` exigent que le statut `check` (décrit ci-dessous) soit valide (vert) avant de pouvoir être fusionnées.
3.  **Suppression Automatique** : La suppression automatique des branches de fonctionnalités après fusion (pull request merge) est activée sur GitHub.

---

## 2. Flux de Travail Local

Avant d'écrire ou de pousser du code, assurez-vous de respecter les commandes suivantes :

### Lancement du Serveur de Dev
*   **Lancer l'application localement** :
    ```bash
    npm run dev:5001
    ```
    *Note : Le port standard `5173` est intentionnellement banni pour éviter des conflits ou des problèmes de cache. Utilisez toujours le port `5001`.*

### Validation Locale
Avant de pousser vos modifications, vous **devez** exécuter le script de validation globale :
```bash
npm run check
```
Ce script exécute successivement :
1.  `npm run lint` : Vérification du linter, respect du design system et audit de code mort avec **Knip**.
2.  `npm run test:run` : Exécution de tous les tests unitaires (via **Vitest**).
3.  `npm run build` : Compilation du projet pour s'assurer qu'aucun bug de bundling n'existe.

*Des hooks Git pre-commit et pre-push locaux sont installés automatiquement via `npm install` pour s'assurer que vous n'oubliez pas de lancer cette commande.*

---

## 3. Architecture CI/CD (GitHub Actions)

Trois workflows GitHub Actions automatisent le cycle de vie de l'application :

### 1. Validation de Qualité (`quality.yml`)
*   **Déclencheur** : Push ou Pull Request sur `dev` ou `main`.
*   **Rôle** : Installe les dépendances, lance le linting, exécute les tests unitaires et vérifie la compilation du projet.
*   **Sécurité** : Si cette étape échoue, la fusion de la Pull Request est bloquée.

### 2. Déploiement des Migrations Supabase (`supabase-deploy.yml`)
*   **Déclencheur** : Push direct ou fusion de PR sur `dev` ou `main`.
*   **Rôle** : Installe le CLI Supabase, lie le projet à l'instance distante de base de données, et pousse toutes les nouvelles migrations (`supabase/migrations/*`) non appliquées.

### 3. Déploiement de Production Vercel (`deploy.yml`)
*   **Déclencheur** : Push ou fusion sur `main`.
*   **Environnement ciblé** : `production` (exige une validation manuelle sur l'interface GitHub avant d'exécuter l'action).
*   **Rôle** : Exécute d'abord la suite complète de validation (lint, tests, build) puis déploie le build compilé en production sur Vercel avec le tag `--prod`.

#### Configuration de l'approbation manuelle (Portail GitHub)
Pour activer la porte de validation manuelle sur les déploiements de production :
1. Allez sur votre dépôt GitHub, puis cliquez sur l'onglet **Settings**.
2. Dans le menu de gauche, sous la section **Security**, cliquez sur **Environments**.
3. Si l'environnement `production` n'existe pas encore, cliquez sur **New environment** et nommez-le **`production`**.
4. Dans les règles de protection de l'environnement, cochez **Required reviewers**.
5. Saisissez et sélectionnez votre propre nom d'utilisateur GitHub.
6. Cliquez sur **Save protection rules**.

Une fois cette règle enregistrée, tout déploiement sur `main` s'arrêtera avant la phase finale de déploiement et attendra votre approbation explicite sur GitHub Actions.

---

## 4. Gestion de la Base de Données (Supabase)

Toutes les modifications de schéma de base de données doivent être versionnées dans le dossier `supabase/migrations`.

### Créer une nouvelle migration
Pour créer un fichier SQL de migration horodaté :
```bash
npm run supabase:migration nom_de_ma_migration
```
Un nouveau fichier vide sera créé dans `supabase/migrations/<timestamp>_nom_de_ma_migration.sql`. Remplissez-le avec vos requêtes SQL.

### Appliquer les migrations sur la base distante
Pour pousser manuellement les nouvelles migrations depuis votre machine vers Supabase :
```bash
npm run supabase:push
```
*En production et en staging (sur la CI/CD), cette commande est exécutée automatiquement à chaque push/merge sur `dev` et `main`.*

---

## 5. Variables d'Environnement et Secrets GitHub

Pour que les pipelines fonctionnent sur GitHub, les secrets suivants doivent être configurés dans les paramètres du dépôt (Settings > Secrets and variables > Actions) :

| Nom du Secret | Description | Source |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Jeton d'accès personnel de l'API Supabase | Compte Supabase > Access Tokens |
| `SUPABASE_DB_PASSWORD` | Mot de passe de la base de données PostgreSQL | Créé à l'initialisation du projet Supabase |
| `SUPABASE_PROJECT_REF` | Référence unique de votre projet Supabase | URL du projet ou paramètres généraux |
| `VERCEL_TOKEN` | Jeton d'authentification Vercel pour le déploiement CLI | Compte Vercel > Settings > Tokens |
| `VERCEL_ORG_ID` | Identifiant de l'organisation/équipe Vercel | `.vercel/project.json` (`orgId`) |
| `VERCEL_PROJECT_ID` | Identifiant du projet Vercel | `.vercel/project.json` (`projectId`) |
