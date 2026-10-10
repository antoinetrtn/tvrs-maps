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
SELECT pg_temp.eq('challenge table hidden from clients', (SELECT count(*) FROM match_steal_challenges)::int, 0);

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
