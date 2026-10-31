-- Conquête SQL tests (run by scripts/test-conquest-sql.sh). Any failed
-- assertion raises and stops psql with a non-zero exit code.
\set ON_ERROR_STOP 1
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

CREATE OR REPLACE FUNCTION pg_temp.eq(label text, got anyelement, expected anyelement)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL %: got %, expected %', label, got, expected;
  END IF;
  RAISE NOTICE 'ok  %', label;
END $$;

INSERT INTO auth.users (id) VALUES (:'A'), (:'B'), (:'C');

-- ---------------------------------------------------------------- lobby ----
SET ROLE authenticated;
SET test.uid = :'A';
SELECT code AS code, id AS mid FROM conquest_create_match('Antoine', 'teal', 'solid', 600) \gset
SET test.uid = :'B';
SELECT 1 FROM conquest_join_match(:'code', 'Léa', 'teal', 'dots', NULL);
SELECT pg_temp.eq('join gets a free palette colour', (SELECT color FROM match_players WHERE user_id = :'B'), 'amber');
SELECT pg_temp.eq('double join is a reconnection', (SELECT id FROM conquest_join_match(:'code', 'Léa', 'amber', 'dots', 'red'))::text, :'mid');
SELECT pg_temp.eq('bogus colour rejected by check', (SELECT count(*) FROM match_players WHERE color NOT IN ('teal','amber','red','green'))::int, 0);
SET test.uid = :'C';
SELECT pg_temp.eq('non player sees nothing', (SELECT count(*) FROM matches)::int, 0);
SELECT pg_temp.eq('non player sees no claims', (SELECT count(*) FROM match_claims)::int, 0);

-- Host leaves the lobby → host passes to B, ready flags reset.
SET test.uid = :'A';
SELECT pg_temp.eq('host leaves lobby', conquest_leave_match(:'mid')->>'status', 'left');
SET test.uid = :'B';
SELECT pg_temp.eq('host transferred', (SELECT host_id FROM matches WHERE id = :'mid')::text, :'B');
SET test.uid = :'A';
SELECT 1 FROM conquest_join_match(:'code', 'Antoine', 'teal', 'solid', 'red');
SELECT conquest_set_ready(:'mid', true);
SET test.uid = :'B';
SELECT conquest_set_ready(:'mid', true);
SELECT 1 FROM conquest_start_match(:'mid');
RESET ROLE;
UPDATE matches SET started_at = now() - interval '1 second' WHERE id = :'mid';
SET ROLE authenticated;

-- ------------------------------------------------- claims + rate limit ----
SET test.uid = :'A';
SELECT pg_temp.eq('resume finds live match', (SELECT id FROM conquest_my_active_match())::text, :'mid');
SELECT pg_temp.eq('A claims France', claim_country(:'mid', 'France')->>'ok', 'true');
SELECT pg_temp.eq('second action within 400 ms is rate limited', claim_country(:'mid', 'Italie')->>'reason', 'rate_limited');
RESET ROLE; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT pg_temp.eq('unknown #1', claim_country(:'mid', 'zzz')->>'reason', 'unknown');
RESET ROLE; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT pg_temp.eq('unknown #2', claim_country(:'mid', 'zzz')->>'reason', 'unknown');
RESET ROLE; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT pg_temp.eq('unknown #3 → penalty', claim_country(:'mid', 'zzz')->>'penalty_until' IS NOT NULL, true);
SELECT pg_temp.eq('penalised claim refused', claim_country(:'mid', 'Italie')->>'reason', 'penalty');
RESET ROLE; UPDATE match_players SET last_action_at = NULL, penalty_until = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;

-- Simultaneous capture: second one is refused (first commit wins).
SET test.uid = :'B';
SELECT pg_temp.eq('B cannot claim owned France', claim_country(:'mid', 'France')->>'reason', 'already_owned');

-- ------------------------------------------------------------ steals ----
RESET ROLE; UPDATE match_claims SET shield_until = now() - interval '1 second' WHERE match_id IS NOT NULL; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT challenge AS c1 FROM (SELECT conquest_steal_challenge(:'mid', 'France') AS challenge) x \gset
SELECT pg_temp.eq('challenge opened', (:'c1'::jsonb)->>'ok', 'true');
RESET ROLE; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT pg_temp.eq('re-request returns the SAME challenge (no reroll)',
  conquest_steal_challenge(:'mid', 'France') - 'expires_at', (:'c1'::jsonb) - 'expires_at');
SELECT pg_temp.eq('flag challenge has 6 options or capital', CASE WHEN (:'c1'::jsonb)->>'kind' = 'flag'
  THEN jsonb_array_length((:'c1'::jsonb)->'options') ELSE 6 END, 6);
SELECT pg_temp.eq('cancel counts as a failure', conquest_cancel_steal(:'mid')->>'reason', 'abandoned');
SELECT pg_temp.eq('penalty after abandon', claim_country(:'mid', 'Italie')->>'reason', 'penalty');
RESET ROLE; UPDATE match_players SET last_action_at = NULL, penalty_until = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT pg_temp.eq('20 s per-country cooldown after failure', conquest_steal_challenge(:'mid', 'France')->>'reason', 'cooldown');
RESET ROLE;
UPDATE match_events SET created_at = now() - interval '30 seconds' WHERE kind = 'steal_fail';
UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL;
INSERT INTO match_steal_challenges VALUES (:'mid', :'B', 'France', 'capital', '{}', now() + interval '20 seconds');
SET ROLE authenticated;
SELECT pg_temp.eq('wrong answer', steal_country(:'mid', 'Lyon')->>'reason', 'wrong');
SELECT pg_temp.eq('escalating penalty (2nd failure = 6 s)',
  (SELECT round(extract(epoch FROM penalty_until - now())) FROM match_players WHERE user_id = :'B')::int, 6);
RESET ROLE;
UPDATE match_events SET created_at = now() - interval '30 seconds' WHERE kind = 'steal_fail';
UPDATE match_players SET penalty_until = NULL, last_action_at = NULL WHERE match_id IS NOT NULL;
INSERT INTO match_steal_challenges VALUES (:'mid', :'B', 'France', 'capital', '{}', now() + interval '20 seconds');
SET ROLE authenticated;
SELECT pg_temp.eq('right answer steals', steal_country(:'mid', 'paris')->>'ok', 'true');
SELECT pg_temp.eq('fail counter reset', (SELECT steal_fails FROM match_players WHERE user_id = :'B'), 0);
DO $$ BEGIN
  PERFORM count(*) FROM match_steal_challenges;
  RAISE EXCEPTION 'FAIL challenge table readable by clients';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  challenge table hidden from clients';
END $$;

-- ---------------------------------------------------- state + forfeit ----
SELECT pg_temp.eq('state carries a version', (conquest_get_state(:'mid')->>'version')::int > 0, true);
SET test.uid = :'A';
SELECT pg_temp.eq('live leave = forfeit', conquest_leave_match(:'mid')->>'status', 'forfeit');
SELECT pg_temp.eq('forfeit → B wins', (SELECT result->>'winner' FROM matches WHERE id = :'mid'), :'B');
SELECT pg_temp.eq('no active match after forfeit', (SELECT id FROM conquest_my_active_match()) IS NULL, true);

-- ------------------------------------------------------ expiry + cleanup ----
SELECT id AS mid2 FROM conquest_create_match('Antoine', 'teal', 'solid', 600) \gset
RESET ROLE;
UPDATE matches SET status = 'live', started_at = now() - interval '20 minutes',
                   ends_at = now() - interval '10 minutes' WHERE id = :'mid2';
UPDATE matches SET finished_at = now() - interval '40 days' WHERE id = :'mid';
SELECT conquest_cleanup();
SELECT pg_temp.eq('expired live match closed by cleanup', (SELECT status FROM matches WHERE id = :'mid2'), 'finished');
SELECT pg_temp.eq('result stored on close', (SELECT result ? 'standings' FROM matches WHERE id = :'mid2'), true);
SELECT pg_temp.eq('old finished match purged', (SELECT count(*) FROM matches WHERE id = :'mid')::int, 0);

-- ------------------------------------------------- profiles ownership ----
INSERT INTO profiles (id, username) VALUES (:'A', 'antoine'), ('44444444-4444-4444-4444-444444444444', 'guest');
SET ROLE anon;
SET test.uid = '';
UPDATE profiles SET xp = 999 WHERE id = :'A';
UPDATE profiles SET xp = 5 WHERE id = '44444444-4444-4444-4444-444444444444';
SET ROLE authenticated;
SET test.uid = :'B';
UPDATE profiles SET xp = 777 WHERE id = :'A';
SET test.uid = :'A';
UPDATE profiles SET xp = 42 WHERE id = :'A';
RESET ROLE;
SELECT pg_temp.eq('registered profile: others cannot write, owner can', (SELECT xp FROM profiles WHERE id = :'A'), 42);
SELECT pg_temp.eq('guest profile still writable', (SELECT xp FROM profiles WHERE username = 'guest'), 5);
SET test.uid = '';
SET ROLE anon;
DO $$ BEGIN
  INSERT INTO leaderboards (profile_id, game_mode, score, time_spent_seconds)
  VALUES ('11111111-1111-1111-1111-111111111111', 'countries', 9999, 1);
  RAISE EXCEPTION 'FAIL forged leaderboard insert accepted';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  forged leaderboard insert refused';
END $$;
RESET ROLE;

-- ================================================================ Elo ====
SELECT pg_temp.eq('elo delta even match win', conquest_elo_delta(1000, 1000, 1, 0), 16);
SELECT pg_temp.eq('elo delta draw vs stronger', conquest_elo_delta(1000, 1200, 0.5, 0), 8);
SELECT pg_temp.eq('elo K halves after 30 games', conquest_elo_delta(1000, 1000, 1, 30), 8);

-- Helper: play a match between two users and finish it by timer.
CREATE OR REPLACE FUNCTION pg_temp.play(a uuid, b uuid, a_claims text[], b_claims text[])
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE m uuid; c text;
BEGIN
  INSERT INTO matches (code, host_id, status, started_at, ends_at)
  VALUES (substr(md5(random()::text), 1, 6), a, 'live', now() - interval '11 minutes', now() + interval '1 hour')
  RETURNING id INTO m;
  INSERT INTO match_players (match_id, user_id, display_name, color, pattern, joined_at)
  VALUES (m, a, 'A', 'teal', 'solid', now() - interval '1 minute'), (m, b, 'B', 'amber', 'dots', now());
  FOREACH c IN ARRAY a_claims LOOP INSERT INTO match_claims (match_id, country_id, owner_id) VALUES (m, c, a); END LOOP;
  FOREACH c IN ARRAY b_claims LOOP INSERT INTO match_claims (match_id, country_id, owner_id) VALUES (m, c, b); END LOOP;
  UPDATE match_players SET score = 10 * coalesce(array_length(a_claims, 1), 0) WHERE match_id = m AND user_id = a;
  UPDATE match_players SET score = 10 * coalesce(array_length(b_claims, 1), 0) WHERE match_id = m AND user_id = b;
  UPDATE matches SET ends_at = now() - interval '1 second' WHERE id = m;
  RETURN m;
END $$;

\set E1 'aaaaaaaa-0000-0000-0000-000000000001'
\set E2 'aaaaaaaa-0000-0000-0000-000000000002'
\set G1 'aaaaaaaa-0000-0000-0000-000000000003'
INSERT INTO auth.users (id, is_anonymous) VALUES (:'E1', false), (:'E2', false), (:'G1', true);

SELECT pg_temp.play(:'E1', :'E2', ARRAY['France','Spain'], ARRAY['Peru']) AS em1 \gset
SELECT conquest_close_if_expired(:'em1');
SELECT pg_temp.eq('winner +16', (SELECT elo FROM conquest_ratings WHERE user_id = :'E1'), 1016);
SELECT pg_temp.eq('loser -16', (SELECT elo FROM conquest_ratings WHERE user_id = :'E2'), 984);
SELECT pg_temp.eq('W/L counted', (SELECT wins || '/' || losses FROM conquest_ratings WHERE user_id = :'E1'), '1/0');
SELECT pg_temp.eq('countries counted', (SELECT countries_captured FROM conquest_ratings WHERE user_id = :'E1'), 2);
SELECT pg_temp.eq('delta stored in result', (SELECT (result->'elo'->:'E1'->>'delta')::int FROM matches WHERE id = :'em1'), 16);
SELECT conquest_close_if_expired(:'em1');
SELECT pg_temp.eq('rated only once', conquest_apply_ratings(:'em1') IS NULL, true);
SELECT pg_temp.eq('still one game', (SELECT games FROM conquest_ratings WHERE user_id = :'E1'), 1);

SELECT pg_temp.play(:'E1', :'E2', ARRAY['Chile'], ARRAY['Peru']) AS em2 \gset
SELECT conquest_close_if_expired(:'em2');
SELECT pg_temp.eq('draw counted', (SELECT draws FROM conquest_ratings WHERE user_id = :'E2'), 1);

SELECT pg_temp.play(:'E1', :'G1', ARRAY['Chile'], ARRAY[]::text[]) AS em3 \gset
SELECT conquest_close_if_expired(:'em3');
SELECT pg_temp.eq('anonymous guest → unrated', (SELECT count(*) FROM conquest_ratings WHERE user_id = :'G1')::int, 0);
SELECT pg_temp.eq('registered player untouched by unrated match', (SELECT games FROM conquest_ratings WHERE user_id = :'E1'), 2);

-- Forfeit during the countdown is not rated.
SELECT pg_temp.play(:'E1', :'E2', ARRAY[]::text[], ARRAY[]::text[]) AS em4 \gset
UPDATE matches SET started_at = now() + interval '2 seconds', ends_at = now() + interval '10 minutes' WHERE id = :'em4';
SET ROLE authenticated; SET test.uid = :'E2';
SELECT pg_temp.eq('countdown forfeit', conquest_leave_match(:'em4')->>'status', 'forfeit');
RESET ROLE;
SELECT pg_temp.eq('countdown forfeit unrated', (SELECT games FROM conquest_ratings WHERE user_id = :'E2'), 2);

-- Live forfeit is a loss for the leaver.
SELECT pg_temp.play(:'E1', :'E2', ARRAY[]::text[], ARRAY['Peru','Chile']) AS em5 \gset
UPDATE matches SET ends_at = now() + interval '5 minutes' WHERE id = :'em5';
SET ROLE authenticated; SET test.uid = :'E2';
SELECT 1 FROM (SELECT conquest_leave_match(:'em5')) x;
SELECT pg_temp.eq('ratings rows (earlier A/B forfeit + E1/E2)', (SELECT count(*) FROM conquest_ratings)::int, 4);
SELECT pg_temp.eq('leaderboard top + me', (conquest_leaderboard(10)->'me'->>'losses')::int, 2);
RESET ROLE;
SELECT pg_temp.eq('leaver lost', (SELECT losses FROM conquest_ratings WHERE user_id = :'E2'), 2);
SET ROLE anon; SET test.uid = '';
SELECT pg_temp.eq('anon reads the board', jsonb_array_length(conquest_leaderboard(10)->'top'), 4);
DO $$ BEGIN
  UPDATE conquest_ratings SET elo = 9999 WHERE user_id IS NOT NULL;
  IF EXISTS (SELECT 1 FROM conquest_ratings WHERE elo = 9999) THEN RAISE EXCEPTION 'FAIL anon wrote ratings'; END IF;
  RAISE NOTICE 'ok  anon cannot write ratings';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  anon cannot write ratings';
END $$;
RESET ROLE;

-- ========================================== rejouer + protection (CoC) ====
\set R1 'bbbbbbbb-0000-0000-0000-000000000001'
\set R2 'bbbbbbbb-0000-0000-0000-000000000002'
\set R3 'bbbbbbbb-0000-0000-0000-000000000003'
INSERT INTO auth.users (id) VALUES (:'R1'), (:'R2'), (:'R3');
SET ROLE authenticated;
SET test.uid = :'R1';
SELECT code AS rcode, id AS rmid FROM conquest_create_match('Antoine', 'teal', 'solid', 600) \gset
SELECT set_config('test.rmid', :'rmid', false);
SELECT pg_temp.eq('creator is ready by default', (SELECT ready FROM match_players WHERE match_id = :'rmid' AND user_id = :'R1'), true);
SET test.uid = :'R2';
SELECT 1 FROM conquest_join_match(:'rcode', 'Léa', 'amber', 'dots', 'red');
SELECT pg_temp.eq('joiner is not ready', (SELECT ready FROM match_players WHERE match_id = :'rmid' AND user_id = :'R2'), false);
SELECT conquest_set_ready(:'rmid', true);
SET test.uid = :'R1';
SELECT 1 FROM conquest_start_match(:'rmid');
DO $$ BEGIN
  PERFORM conquest_rematch(current_setting('test.rmid')::uuid);
  RAISE EXCEPTION 'FAIL rematch of a live match accepted';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'match_not_finished' THEN RAISE; END IF;
  RAISE NOTICE 'ok  rematch refused while live';
END $$;
RESET ROLE;
UPDATE matches SET started_at = now() - interval '1 second' WHERE id = :'rmid';
SET ROLE authenticated;

-- Capture = 20 s de protection.
SELECT pg_temp.eq('capture ok', claim_country(:'rmid', 'France')->>'ok', 'true');
SELECT pg_temp.eq('capture shield is 20 s',
  (SELECT round(extract(epoch FROM shield_until - now())) FROM match_claims WHERE match_id = :'rmid' AND country_id = 'France')::int, 20);
SET test.uid = :'R2';
RESET ROLE; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT pg_temp.eq('opponent cannot fortify my country', conquest_fortify_challenge(:'rmid', 'France')->>'reason', 'not_yours');
SELECT pg_temp.eq('opponent cannot steal while shielded', conquest_steal_challenge(:'rmid', 'France')->>'reason', 'shielded');

-- Étape 1 : défi drapeau ou capitale, mauvaise réponse → cooldown.
SET test.uid = :'R1';
RESET ROLE; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT challenge AS f1 FROM (SELECT conquest_fortify_challenge(:'rmid', 'France') AS challenge) x \gset
SELECT pg_temp.eq('fortify step 1 opened', (:'f1'::jsonb)->>'step', '1');
SELECT pg_temp.eq('step 1 bonus is 30 s', (:'f1'::jsonb)->>'bonus_seconds', '30');
SELECT pg_temp.eq('re-request returns the same challenge',
  (conquest_fortify_challenge(:'rmid', 'France')->>'kind'), (:'f1'::jsonb)->>'kind');
SELECT pg_temp.eq('wrong fortify answer', conquest_fortify(:'rmid', 'Lyon')->>'reason', 'wrong');
RESET ROLE; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT pg_temp.eq('10 s cooldown after a wrong fortify', conquest_fortify_challenge(:'rmid', 'France')->>'reason', 'cooldown');
SELECT pg_temp.eq('fortify table hidden from clients', (SELECT count(*) FROM match_fortify_challenges)::int, 0);

-- Bonne réponse (capitale) → +30 s, puis l'autre type (drapeau) → +1 min.
RESET ROLE;
DELETE FROM match_events WHERE kind = 'fortify_fail';
UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL;
INSERT INTO match_fortify_challenges VALUES (:'rmid', :'R1', 'France', 1, 'capital', '{}', now() + interval '20 seconds');
SET ROLE authenticated;
SELECT pg_temp.eq('right capital fortifies', conquest_fortify(:'rmid', 'paris')->>'ok', 'true');
SELECT pg_temp.eq('shield +30 s (≈50 s)',
  (SELECT round(extract(epoch FROM shield_until - now())) FROM match_claims WHERE match_id = :'rmid' AND country_id = 'France')::int, 50);
RESET ROLE; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT challenge AS f2 FROM (SELECT conquest_fortify_challenge(:'rmid', 'France') AS challenge) x \gset
SELECT pg_temp.eq('step 2 asks the other kind (flag)', (:'f2'::jsonb)->>'kind', 'flag');
SELECT pg_temp.eq('step 2 has 6 flags', jsonb_array_length((:'f2'::jsonb)->'options'), 6);
SELECT pg_temp.eq('step 2 bonus is 60 s', (:'f2'::jsonb)->>'bonus_seconds', '60');
SELECT pg_temp.eq('right flag fortifies', conquest_fortify(:'rmid', (SELECT iso2 FROM conquest_countries WHERE country_id = 'France'))->>'fortify_level', '2');
SELECT pg_temp.eq('shield +1 min (≈110 s)',
  (SELECT round(extract(epoch FROM shield_until - now())) FROM match_claims WHERE match_id = :'rmid' AND country_id = 'France')::int, 110);
RESET ROLE; UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL; SET ROLE authenticated;
SELECT pg_temp.eq('no third step', conquest_fortify_challenge(:'rmid', 'France')->>'reason', 'max_fortified');

-- Expired shield: steal resets the fortify level.
RESET ROLE;
UPDATE match_claims SET shield_until = now() - interval '1 second' WHERE match_id = :'rmid';
UPDATE match_players SET last_action_at = NULL WHERE match_id IS NOT NULL;
INSERT INTO match_steal_challenges VALUES (:'rmid', :'R2', 'France', 'capital', '{}', now() + interval '20 seconds');
SET ROLE authenticated;
SET test.uid = :'R2';
-- Pays renforcé : la bonne capitale ouvre le QCM de connaissances (sans réponse).
SELECT r AS k1 FROM (SELECT steal_country(:'rmid', 'Paris') AS r) x \gset
SELECT pg_temp.eq('fortified steal needs knowledge', (:'k1'::jsonb)->>'needs_knowledge', 'true');
SELECT pg_temp.eq('knowledge challenge has 4 choices', jsonb_array_length((:'k1'::jsonb)->'choices'), 4);
SELECT pg_temp.eq('knowledge challenge leaks no answer',
  (:'k1'::jsonb) ? 'answer_index' OR (:'k1'::jsonb) ? 'answer_perm', false);
SELECT pg_temp.eq('country not transferred yet', (SELECT owner_id FROM match_claims WHERE match_id = :'rmid' AND country_id = 'France')::text, :'R1');
DO $$ BEGIN
  PERFORM count(*) FROM conquest_knowledge_questions;
  RAISE EXCEPTION 'FAIL knowledge questions readable by clients';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  knowledge questions hidden from clients';
END $$;
-- Mauvaise réponse au QCM → échec + pénalité, le renfort reste.
RESET ROLE;
SELECT (SELECT array_position(c.answer_perm, q.answer_index) - 1) AS good,
       ((SELECT array_position(c.answer_perm, q.answer_index) - 1) + 1) % 4 AS bad
  FROM match_steal_challenges c JOIN conquest_knowledge_questions q ON q.id = c.question_id
 WHERE c.match_id = :'rmid' AND c.user_id = :'R2' \gset
SET ROLE authenticated;
SELECT pg_temp.eq('wrong knowledge answer fails', conquest_answer_knowledge(:'rmid', :bad)->>'reason', 'wrong');
SELECT pg_temp.eq('double submit refused', conquest_answer_knowledge(:'rmid', :good)->>'reason', 'no_challenge');
SELECT pg_temp.eq('fortify kept after failed quiz', (SELECT fortify_level FROM match_claims WHERE match_id = :'rmid' AND country_id = 'France'), 2);
-- Bonne réponse → transfert + renfort remis à 0.
RESET ROLE;
DELETE FROM match_events WHERE kind IN ('steal_fail', 'knowledge');
UPDATE match_players SET penalty_until = NULL, last_action_at = NULL, steal_fails = 0 WHERE match_id IS NOT NULL;
SET ROLE authenticated;
SELECT r AS k2 FROM (SELECT conquest_knowledge_challenge(:'rmid', 'France') AS r) x \gset
SELECT pg_temp.eq('attacker gets a knowledge challenge', (:'k2'::jsonb)->>'kind', 'knowledge');
RESET ROLE;
SELECT array_position(c.answer_perm, q.answer_index) - 1 AS good
  FROM match_steal_challenges c JOIN conquest_knowledge_questions q ON q.id = c.question_id
 WHERE c.match_id = :'rmid' AND c.user_id = :'R2' \gset
SET ROLE authenticated;
SELECT pg_temp.eq('right knowledge answer steals', conquest_answer_knowledge(:'rmid', :good)->>'ok', 'true');
SELECT pg_temp.eq('steal after shield expiry', (SELECT owner_id FROM match_claims WHERE match_id = :'rmid' AND country_id = 'France')::text, :'R2');
SELECT pg_temp.eq('steal resets fortify level', (SELECT fortify_level FROM match_claims WHERE match_id = :'rmid' AND country_id = 'France'), 0);

-- Revanche : R2 la crée, R1 la rejoint, tous deux prêts, couleurs gardées.
RESET ROLE; UPDATE matches SET ends_at = now() - interval '1 second' WHERE id = :'rmid'; SET ROLE authenticated;
SELECT id AS remid FROM conquest_rematch(:'rmid') \gset
SELECT pg_temp.eq('rematch linked on the old match', (SELECT rematch_id FROM matches WHERE id = :'rmid')::text, :'remid');
SELECT pg_temp.eq('rematch creator hosts', (SELECT host_id FROM matches WHERE id = :'remid')::text, :'R2');
SELECT pg_temp.eq('rematch creator ready + same colour',
  (SELECT ready::text || color FROM match_players WHERE match_id = :'remid' AND user_id = :'R2'), 'trueamber');
SELECT pg_temp.eq('second click is idempotent', (SELECT id FROM conquest_rematch(:'rmid'))::text, :'remid');
SET test.uid = :'R1';
SELECT pg_temp.eq('opponent joins the same rematch', (SELECT id FROM conquest_rematch(:'rmid'))::text, :'remid');
SELECT pg_temp.eq('both ready', (SELECT count(*) FILTER (WHERE ready) FROM match_players WHERE match_id = :'remid')::int, 2);
SET test.uid = :'R2';
SELECT pg_temp.eq('host starts the rematch', (SELECT status FROM conquest_start_match(:'remid')), 'live');
SET test.uid = :'R3';
DO $$ BEGIN
  PERFORM conquest_rematch(current_setting('test.rmid')::uuid);
  RAISE EXCEPTION 'FAIL outsider rematch accepted';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  outsider cannot rematch';
END $$;
RESET ROLE;
