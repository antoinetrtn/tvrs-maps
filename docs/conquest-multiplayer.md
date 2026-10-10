# Mode « Conquête » — 1v1 privé (phase 1)

## État
- Code client livré **désactivé** : le bouton « Conquête 1v1 » n'apparaît que si
  Supabase est configuré **et** `VITE_ENABLE_CONQUEST=true`.
- Migrations fournies, **non appliquées** sur le projet Supabase `tehmjpgghrqjmdfakiic`.

## Fichiers
- `supabase/migrations/20261010190000_conquest_multiplayer.sql` : tables `matches`,
  `match_players`, `match_claims`, `match_events` (+ référentiel `conquest_countries`,
  `conquest_country_aliases`), RLS, RPC `conquest_create_match`, `conquest_join_match`,
  `conquest_set_ready`, `conquest_start_match`, `claim_country`, `conquest_get_state`.
- `supabase/migrations/20261010190100_conquest_seed_countries.sql` : 236 pays et alias
  (généré par `npm run generate:conquest-seed`).
- Client : `src/multiplayer/*`.

## Activer (à confirmer explicitement par Antoine)
1. Supabase Dashboard → Authentication → Sign In / Providers → activer **Anonymous sign-ins**
   (les invités jouent avec une session anonyme ; sinon seuls les comptes connectés peuvent jouer).
2. Appliquer les migrations (de préférence d'abord sur une branche Supabase ou un projet de test) :
   `npm run supabase:link && npx supabase db push`
   (ou coller les deux fichiers SQL dans l'éditeur SQL, dans l'ordre).
3. Vérifier : `select count(*) from conquest_country_aliases;` (≈ 400) et les advisors sécurité.
4. Realtime : aucun réglage de publication requis (Presence + Broadcast uniquement).
   Vérifier les quotas Realtime du plan.
5. Vercel : ajouter `VITE_ENABLE_CONQUEST=true` en Preview d'abord, tester à deux, puis Production.

## Règles serveur (phase 1)
- Timer serveur : `started_at = now() + 3 s` (compte à rebours), `ends_at = started_at + 10 min`.
  Clôture à la première requête après `ends_at`.
- `claim_country` : normalisation serveur (unaccent), verrou `SELECT … FOR UPDATE` + clé primaire
  `(match_id, country_id)` → premier commit gagnant ; 10 pts par capture ; bouclier de 30 s
  enregistré (`shield_until`) pour la phase 2.
- RLS : lecture réservée aux joueurs du match, aucune écriture directe.

## Phase 2 (non livré)
Vols (défi plus dur), bouclier visible, cooldown 60 s, bonus continent, pénalité d'erreur.
