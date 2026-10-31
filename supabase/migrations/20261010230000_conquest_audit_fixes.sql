-- =============================================================================
-- Mode « Conquête » : correctifs de l'audit multijoueur (10/10/2026)
--   P0  défi de vol non relançable (défi existant renvoyé, abandon = échec),
--       cooldown 20 s par pays après échec, pénalités croissantes, 6 drapeaux
--   P1  limite de débit serveur (claims + défis), série de réponses inconnues,
--       départ / forfait, transfert d'hôte, nettoyage des matchs abandonnés,
--       reprise après rechargement (conquest_my_active_match), version d'état
--   P2  couleur / motif validés, couleur de repli choisie par le serveur,
--       résultat final stocké
--   Sécurité  profiles / user_records / leaderboards : un compte inscrit ne
--       peut plus être modifié (ni usurpé) par un autre client
-- =============================================================================

-- ---------------------------------------------------------------- schéma ----
ALTER TABLE public.match_players
    ADD COLUMN IF NOT EXISTS last_action_at timestamptz,
    ADD COLUMN IF NOT EXISTS unknown_streak integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS steal_fails integer NOT NULL DEFAULT 0;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS result jsonb;

ALTER TABLE public.match_players DROP CONSTRAINT IF EXISTS match_players_color_check;
ALTER TABLE public.match_players ADD CONSTRAINT match_players_color_check
    CHECK (color IN ('teal', 'amber', 'red', 'green'));
ALTER TABLE public.match_players DROP CONSTRAINT IF EXISTS match_players_pattern_check;
ALTER TABLE public.match_players ADD CONSTRAINT match_players_pattern_check
    CHECK (pattern IN ('solid', 'dots', 'hatch', 'cross'));

ALTER TABLE public.match_events DROP CONSTRAINT IF EXISTS match_events_kind_check;
ALTER TABLE public.match_events ADD CONSTRAINT match_events_kind_check
    CHECK (kind IN ('join', 'ready', 'start', 'capture', 'fail', 'finish',
                    'steal', 'steal_fail', 'leave', 'forfeit'));

-- Cooldowns après succès ET après échec : l'index partiel couvre les deux.
DROP INDEX IF EXISTS public.match_events_steal_idx;
CREATE INDEX IF NOT EXISTS match_events_steal_idx
    ON public.match_events (match_id, actor_id, country_id, created_at)
    WHERE kind IN ('steal', 'steal_fail');
CREATE INDEX IF NOT EXISTS match_players_user_match_idx
    ON public.match_players (user_id, match_id);
CREATE INDEX IF NOT EXISTS matches_status_created_idx
    ON public.matches (status, created_at);

-- ------------------------------------------------------- règles / helpers ----
-- Pénalité d'un vol raté : base × 2^(échecs précédents), plafonnée à 24 s.
CREATE OR REPLACE FUNCTION public.conquest_steal_penalty(p_base integer, p_fails integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT least(24, p_base * (2 ^ least(greatest(p_fails, 0), 4))::integer);
$$;

-- Limite de débit : une action de jeu toutes les 400 ms par joueur.
-- Renvoie true si l'action est acceptée (et horodate le joueur).
CREATE OR REPLACE FUNCTION public.conquest_take_action_slot(p_match_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.match_players
     SET last_action_at = clock_timestamp(), last_seen = now()
   WHERE match_id = p_match_id AND user_id = p_uid
     AND (last_action_at IS NULL OR last_action_at <= clock_timestamp() - interval '400 milliseconds');
  RETURN FOUND;
END;
$$;

-- Classement final (même ordre que computeStandings côté client).
CREATE OR REPLACE FUNCTION public.conquest_compute_result(p_match_id uuid, p_forfeit_by uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (
    SELECT user_id, sum(bonus)::integer AS bonus
      FROM public.conquest_continent_bonuses(p_match_id) GROUP BY user_id
  ), c AS (
    SELECT owner_id AS user_id, count(*)::integer AS countries
      FROM public.match_claims WHERE match_id = p_match_id GROUP BY owner_id
  ), s AS (
    SELECT p.user_id, p.score + coalesce(b.bonus, 0) AS total,
           coalesce(c.countries, 0) AS countries, p.steals, p.joined_at
      FROM public.match_players p
      LEFT JOIN b USING (user_id) LEFT JOIN c USING (user_id)
     WHERE p.match_id = p_match_id
  ), ranked AS (
    SELECT s.*, row_number() OVER (ORDER BY (s.user_id = p_forfeit_by) ASC,
                                   total DESC, countries DESC, steals DESC, joined_at) AS rank
      FROM s
  )
  SELECT jsonb_build_object(
    'forfeit_by', p_forfeit_by,
    'winner', (SELECT CASE
                 WHEN p_forfeit_by IS NOT NULL THEN r1.user_id
                 WHEN r2.user_id IS NOT NULL AND r1.total = r2.total
                      AND r1.countries = r2.countries AND r1.steals = r2.steals THEN NULL
                 ELSE r1.user_id END
               FROM ranked r1 LEFT JOIN ranked r2 ON r2.rank = 2 WHERE r1.rank = 1),
    'standings', coalesce((SELECT jsonb_agg(jsonb_build_object(
                   'user_id', user_id, 'total', total, 'countries', countries, 'steals', steals)
                   ORDER BY rank) FROM ranked), '[]'::jsonb));
$$;

-- Clôture idempotente : timer écoulé → finished + résultat stocké.
CREATE OR REPLACE FUNCTION public.conquest_close_if_expired(p_match_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  UPDATE public.matches
     SET status = 'finished', finished_at = now(),
         result = public.conquest_compute_result(p_match_id)
   WHERE id = p_match_id AND status = 'live' AND ends_at <= now();
  IF FOUND THEN
    INSERT INTO public.match_events (match_id, kind) VALUES (p_match_id, 'finish');
  END IF;
  SELECT status INTO v_status FROM public.matches WHERE id = p_match_id;
  RETURN v_status;
END;
$$;

-- Nettoyage des matchs abandonnés (appelé par pg_cron si dispo, et
-- opportunément à chaque création de match).
CREATE OR REPLACE FUNCTION public.conquest_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.matches WHERE status = 'live' AND ends_at <= now() LOOP
    PERFORM public.conquest_close_if_expired(v_id);
  END LOOP;
  UPDATE public.matches SET status = 'finished', finished_at = now()
   WHERE status = 'lobby' AND created_at < now() - interval '2 hours';
  DELETE FROM public.match_steal_challenges WHERE expires_at < now() - interval '1 hour';
  DELETE FROM public.matches
   WHERE status = 'finished' AND coalesce(finished_at, created_at) < now() - interval '30 days';
END;
$$;

-- Échec d'un vol (mauvaise réponse, abandon, délai dépassé) : pénalité
-- croissante + événement steal_fail (alimente le cooldown par pays).
CREATE OR REPLACE FUNCTION public.conquest_register_steal_fail(
  p_match public.matches, p_uid uuid, p_country_id text, p_reason text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until timestamptz;
  v_victim uuid;
BEGIN
  UPDATE public.match_players
     SET penalty_until = now() + make_interval(secs => public.conquest_steal_penalty(
           public.conquest_rule(p_match.rules, 'steal_penalty_seconds', 3), steal_fails)),
         steal_fails = steal_fails + 1
   WHERE match_id = p_match.id AND user_id = p_uid
  RETURNING penalty_until INTO v_until;
  SELECT owner_id INTO v_victim FROM public.match_claims
   WHERE match_id = p_match.id AND country_id = p_country_id;
  INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
  VALUES (p_match.id, 'steal_fail', p_uid, p_country_id,
          jsonb_build_object('victim', v_victim, 'reason', p_reason));
  RETURN v_until;
END;
$$;

-- ------------------------------------------------------------------ RPC -----
CREATE OR REPLACE FUNCTION public.conquest_create_match(
  p_display_name text,
  p_color text,
  p_pattern text DEFAULT 'solid',
  p_duration_seconds integer DEFAULT 600
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  PERFORM public.conquest_cleanup();
  FOR attempt IN 1..10 LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.matches (code, host_id, duration_seconds)
      VALUES (v_code, v_uid, least(greatest(coalesce(p_duration_seconds, 600), 60), 3600))
      RETURNING * INTO v_match;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 10 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO public.match_players (match_id, user_id, display_name, color, pattern)
  VALUES (v_match.id, v_uid, left(btrim(p_display_name), 30),
          CASE WHEN p_color IN ('teal', 'amber', 'red', 'green') THEN p_color ELSE 'teal' END,
          CASE WHEN p_pattern IN ('solid', 'dots', 'hatch', 'cross') THEN p_pattern ELSE 'solid' END);
  INSERT INTO public.match_events (match_id, kind, actor_id) VALUES (v_match.id, 'join', v_uid);
  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.conquest_join_match(
  p_code text,
  p_display_name text,
  p_color text,
  p_pattern text DEFAULT 'dots',
  p_fallback_color text DEFAULT NULL
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_count integer;
  v_color text;
  v_pattern text;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE code = upper(btrim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (SELECT 1 FROM public.match_players WHERE match_id = v_match.id AND user_id = v_uid) THEN
    RETURN v_match; -- reconnexion
  END IF;

  IF v_match.status <> 'lobby' THEN
    RAISE EXCEPTION 'match_already_started' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_count FROM public.match_players WHERE match_id = v_match.id;
  IF v_count >= v_match.max_players THEN
    RAISE EXCEPTION 'match_full' USING ERRCODE = 'P0001';
  END IF;

  -- Première couleur libre parmi : demandée, repli, puis la palette.
  SELECT c INTO v_color
    FROM unnest(ARRAY[p_color, p_fallback_color, 'teal', 'amber', 'red', 'green'])
         WITH ORDINALITY AS t(c, ord)
   WHERE c IN ('teal', 'amber', 'red', 'green')
     AND NOT EXISTS (SELECT 1 FROM public.match_players
                      WHERE match_id = v_match.id AND color = c)
   ORDER BY ord LIMIT 1;
  v_pattern := CASE WHEN p_pattern IN ('solid', 'dots', 'hatch', 'cross') THEN p_pattern ELSE 'dots' END;

  INSERT INTO public.match_players (match_id, user_id, display_name, color, pattern)
  VALUES (v_match.id, v_uid, left(btrim(p_display_name), 30), v_color, v_pattern);
  INSERT INTO public.match_events (match_id, kind, actor_id) VALUES (v_match.id, 'join', v_uid);
  RETURN v_match;
END;
$$;

-- Quitter : en lobby, on retire le joueur (l'hôte passe au plus ancien
-- joueur restant, le salon vide est fermé) ; en match, c'est un forfait.
CREATE OR REPLACE FUNCTION public.conquest_leave_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_next uuid;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.match_players
                               WHERE match_id = p_match_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_player');
  END IF;
  IF public.conquest_close_if_expired(p_match_id) = 'finished' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'finished');
  END IF;

  IF v_match.status = 'lobby' THEN
    DELETE FROM public.match_players WHERE match_id = p_match_id AND user_id = v_uid;
    INSERT INTO public.match_events (match_id, kind, actor_id) VALUES (p_match_id, 'leave', v_uid);
    SELECT user_id INTO v_next FROM public.match_players
     WHERE match_id = p_match_id ORDER BY joined_at LIMIT 1;
    IF v_next IS NULL THEN
      UPDATE public.matches SET status = 'finished', finished_at = now() WHERE id = p_match_id;
    ELSIF v_match.host_id = v_uid THEN
      UPDATE public.matches SET host_id = v_next WHERE id = p_match_id;
      UPDATE public.match_players SET ready = false WHERE match_id = p_match_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', 'left');
  END IF;

  -- Match en cours : forfait, l'adversaire gagne.
  UPDATE public.matches
     SET status = 'finished', finished_at = now(), ends_at = least(ends_at, now()),
         result = public.conquest_compute_result(p_match_id, v_uid)
   WHERE id = p_match_id;
  INSERT INTO public.match_events (match_id, kind, actor_id) VALUES (p_match_id, 'forfeit', v_uid);
  RETURN jsonb_build_object('ok', true, 'status', 'forfeit');
END;
$$;

-- Reprise après rechargement : le match lobby/live le plus récent du joueur.
CREATE OR REPLACE FUNCTION public.conquest_my_active_match()
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
BEGIN
  FOR v_match IN
    SELECT m.* FROM public.matches m
      JOIN public.match_players p ON p.match_id = m.id AND p.user_id = v_uid
     WHERE m.status IN ('lobby', 'live')
     ORDER BY m.created_at DESC LIMIT 3
  LOOP
    IF public.conquest_close_if_expired(v_match.id) <> 'finished' THEN
      RETURN v_match;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.conquest_steal_challenge(p_match_id uuid, p_country_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_player public.match_players;
  v_claim public.match_claims;
  v_country public.conquest_countries;
  v_prev public.match_steal_challenges;
  v_kind text;
  v_options text[] := '{}';
  v_cooldown integer;
  v_expires timestamptz;
BEGIN
  IF NOT public.conquest_is_player(p_match_id) THEN
    RAISE EXCEPTION 'not_a_player' USING ERRCODE = '42501';
  END IF;
  IF public.conquest_close_if_expired(p_match_id) = 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'finished');
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF v_match.status <> 'live' OR now() < v_match.started_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_live');
  END IF;

  -- P0 : un défi en cours sur ce pays est renvoyé tel quel (pas de relance).
  SELECT * INTO v_prev FROM public.match_steal_challenges
   WHERE match_id = p_match_id AND user_id = v_uid FOR UPDATE;
  IF FOUND AND v_prev.country_id = p_country_id AND v_prev.expires_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'country_id', p_country_id, 'kind', v_prev.kind,
                              'options', to_jsonb(v_prev.options), 'expires_at', v_prev.expires_at);
  END IF;
  -- Un défi remplacé (autre pays) ou expiré sans réponse compte comme un échec.
  IF FOUND THEN
    DELETE FROM public.match_steal_challenges WHERE match_id = p_match_id AND user_id = v_uid;
    PERFORM public.conquest_register_steal_fail(v_match, v_uid, v_prev.country_id,
              CASE WHEN v_prev.expires_at > now() THEN 'abandon' ELSE 'expired' END);
  END IF;

  SELECT * INTO v_player FROM public.match_players WHERE match_id = p_match_id AND user_id = v_uid;
  IF v_player.penalty_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'penalty', 'until', v_player.penalty_until);
  END IF;
  IF NOT public.conquest_take_action_slot(p_match_id, v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  SELECT * INTO v_claim FROM public.match_claims
   WHERE match_id = p_match_id AND country_id = p_country_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'free', 'country_id', p_country_id);
  END IF;
  IF v_claim.owner_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_yours', 'country_id', p_country_id);
  END IF;
  IF v_claim.shield_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'shielded', 'country_id', p_country_id,
                              'until', v_claim.shield_until);
  END IF;

  -- Cooldown par pays : 60 s après un vol réussi, 20 s après un échec.
  v_cooldown := public.conquest_rule(v_match.rules, 'steal_cooldown_seconds', 60);
  IF EXISTS (SELECT 1 FROM public.match_events
              WHERE match_id = p_match_id AND actor_id = v_uid AND country_id = p_country_id
                AND ((kind = 'steal' AND created_at > now() - make_interval(secs => v_cooldown))
                  OR (kind = 'steal_fail' AND created_at > now() - make_interval(
                        secs => public.conquest_rule(v_match.rules, 'steal_fail_cooldown_seconds', 20)))))
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cooldown', 'country_id', p_country_id);
  END IF;

  SELECT * INTO v_country FROM public.conquest_countries WHERE country_id = p_country_id;
  IF v_country.capital_en IS NOT NULL AND random() < 0.5 THEN
    v_kind := 'capital';
  ELSE
    v_kind := 'flag';
    -- P0 : 6 drapeaux (1 chance sur 6 au hasard).
    SELECT array_agg(iso2 ORDER BY random()) INTO v_options FROM (
      SELECT v_country.iso2 AS iso2
      UNION ALL
      (SELECT iso2 FROM public.conquest_countries
        WHERE iso2 IS NOT NULL AND iso2 <> v_country.iso2
        ORDER BY (region = v_country.region) DESC, random() LIMIT 5)
    ) o;
  END IF;

  v_expires := now() + interval '20 seconds';
  INSERT INTO public.match_steal_challenges (match_id, user_id, country_id, kind, options, expires_at)
  VALUES (p_match_id, v_uid, p_country_id, v_kind, v_options, v_expires);

  RETURN jsonb_build_object('ok', true, 'country_id', p_country_id, 'kind', v_kind,
                            'options', to_jsonb(v_options), 'expires_at', v_expires);
END;
$$;

-- Abandon explicite du défi (bouton « Annuler ») : compte comme un échec.
CREATE OR REPLACE FUNCTION public.conquest_cancel_steal(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_challenge public.match_steal_challenges;
  v_until timestamptz;
BEGIN
  IF NOT public.conquest_is_player(p_match_id) THEN
    RAISE EXCEPTION 'not_a_player' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  DELETE FROM public.match_steal_challenges
   WHERE match_id = p_match_id AND user_id = v_uid
  RETURNING * INTO v_challenge;
  IF v_challenge.country_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_challenge');
  END IF;
  v_until := public.conquest_register_steal_fail(v_match, v_uid, v_challenge.country_id, 'abandon');
  RETURN jsonb_build_object('ok', false, 'reason', 'abandoned',
                            'country_id', v_challenge.country_id, 'penalty_until', v_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.steal_country(p_match_id uuid, p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_challenge public.match_steal_challenges;
  v_claim public.match_claims;
  v_country public.conquest_countries;
  v_victim uuid;
  v_correct boolean;
  v_points integer;
  v_shield integer;
  v_leader uuid;
  v_score integer;
  v_until timestamptz;
BEGIN
  IF NOT public.conquest_is_player(p_match_id) THEN
    RAISE EXCEPTION 'not_a_player' USING ERRCODE = '42501';
  END IF;
  IF public.conquest_close_if_expired(p_match_id) = 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'finished');
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;

  DELETE FROM public.match_steal_challenges
   WHERE match_id = p_match_id AND user_id = v_uid
  RETURNING * INTO v_challenge;
  IF v_challenge.country_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_challenge');
  END IF;
  IF v_challenge.expires_at < now() THEN
    v_until := public.conquest_register_steal_fail(v_match, v_uid, v_challenge.country_id, 'expired');
    RETURN jsonb_build_object('ok', false, 'reason', 'expired',
                              'country_id', v_challenge.country_id, 'penalty_until', v_until);
  END IF;

  SELECT * INTO v_claim FROM public.match_claims
   WHERE match_id = p_match_id AND country_id = v_challenge.country_id
   FOR UPDATE;
  IF NOT FOUND OR v_claim.owner_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'changed', 'country_id', v_challenge.country_id);
  END IF;
  IF v_claim.shield_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'shielded',
                              'country_id', v_challenge.country_id, 'until', v_claim.shield_until);
  END IF;

  SELECT * INTO v_country FROM public.conquest_countries WHERE country_id = v_challenge.country_id;
  IF v_challenge.kind = 'flag' THEN
    v_correct := upper(btrim(coalesce(p_answer, ''))) = upper(v_country.iso2);
  ELSE
    v_correct := EXISTS (SELECT 1 FROM public.conquest_capital_aliases
                          WHERE country_id = v_country.country_id
                            AND alias_norm = public.conquest_normalize(p_answer));
  END IF;

  IF NOT v_correct THEN
    v_until := public.conquest_register_steal_fail(v_match, v_uid, v_country.country_id, 'wrong');
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong', 'country_id', v_country.country_id,
                              'penalty_until', v_until);
  END IF;

  v_leader := public.conquest_leader(p_match_id);
  v_points := 15 + CASE WHEN v_leader IS NOT NULL AND v_leader <> v_uid THEN 5 ELSE 0 END;
  v_victim := v_claim.owner_id;

  UPDATE public.match_players
     SET score = score + v_points, steals = steals + 1, steal_fails = 0, last_seen = now()
   WHERE match_id = p_match_id AND user_id = v_uid
  RETURNING score INTO v_score;

  v_leader := public.conquest_leader(p_match_id);
  v_shield := public.conquest_rule(v_match.rules, 'shield_seconds', 30)
              - CASE WHEN v_leader = v_uid THEN 10 ELSE 0 END;

  UPDATE public.match_claims
     SET owner_id = v_uid, claimed_at = now(), shield_until = now() + make_interval(secs => v_shield)
   WHERE match_id = p_match_id AND country_id = v_country.country_id
  RETURNING * INTO v_claim;

  INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
  VALUES (p_match_id, 'steal', v_uid, v_country.country_id,
          jsonb_build_object('victim', v_victim, 'points', v_points));

  RETURN jsonb_build_object('ok', true, 'country_id', v_country.country_id, 'owner_id', v_uid,
                            'victim', v_victim, 'points', v_points, 'score', v_score,
                            'shield_until', v_claim.shield_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_country(p_match_id uuid, p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_norm text := public.conquest_normalize(p_answer);
  v_country text;
  v_existing public.match_claims;
  v_claim public.match_claims;
  v_points constant integer := 10;
  v_score integer;
  v_penalty timestamptz;
  v_streak integer;
  v_shield integer;
BEGIN
  IF NOT public.conquest_is_player(p_match_id) THEN
    RAISE EXCEPTION 'not_a_player' USING ERRCODE = '42501';
  END IF;
  IF public.conquest_close_if_expired(p_match_id) = 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'finished');
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF v_match.status <> 'live' OR now() < v_match.started_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_live');
  END IF;
  SELECT penalty_until INTO v_penalty FROM public.match_players
   WHERE match_id = p_match_id AND user_id = v_uid;
  IF v_penalty > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'penalty', 'until', v_penalty);
  END IF;
  IF v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty');
  END IF;
  IF NOT public.conquest_take_action_slot(p_match_id, v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  SELECT country_id INTO v_country FROM public.conquest_country_aliases
   WHERE alias_norm = v_norm ORDER BY country_id LIMIT 1;
  IF v_country IS NULL THEN
    -- 3 réponses inconnues d'affilée → 2 s de pénalité (anti brute force).
    UPDATE public.match_players
       SET unknown_streak = CASE WHEN unknown_streak >= 2 THEN 0 ELSE unknown_streak + 1 END,
           penalty_until = CASE WHEN unknown_streak >= 2 THEN now() + interval '2 seconds'
                                ELSE penalty_until END
     WHERE match_id = p_match_id AND user_id = v_uid
    RETURNING penalty_until INTO v_penalty;
    INSERT INTO public.match_events (match_id, kind, actor_id, payload)
    VALUES (p_match_id, 'fail', v_uid, jsonb_build_object('reason', 'unknown'));
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown',
                              'penalty_until', CASE WHEN v_penalty > now() THEN v_penalty END);
  END IF;
  UPDATE public.match_players SET unknown_streak = 0
   WHERE match_id = p_match_id AND user_id = v_uid AND unknown_streak <> 0;

  SELECT * INTO v_existing FROM public.match_claims
   WHERE match_id = p_match_id AND country_id = v_country FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', CASE WHEN v_existing.owner_id = v_uid THEN 'already_yours' ELSE 'already_owned' END,
      'country_id', v_country, 'owner_id', v_existing.owner_id,
      'shield_until', v_existing.shield_until);
  END IF;

  v_shield := public.conquest_rule(v_match.rules, 'shield_seconds', 30)
              - CASE WHEN public.conquest_leader(p_match_id) = v_uid THEN 10 ELSE 0 END;
  INSERT INTO public.match_claims (match_id, country_id, owner_id, shield_until)
  VALUES (p_match_id, v_country, v_uid, now() + make_interval(secs => v_shield))
  ON CONFLICT (match_id, country_id) DO NOTHING
  RETURNING * INTO v_claim;
  IF v_claim.country_id IS NULL THEN
    SELECT * INTO v_existing FROM public.match_claims
     WHERE match_id = p_match_id AND country_id = v_country;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_owned',
                              'country_id', v_country, 'owner_id', v_existing.owner_id,
                              'shield_until', v_existing.shield_until);
  END IF;

  UPDATE public.match_players SET score = score + v_points, last_seen = now()
   WHERE match_id = p_match_id AND user_id = v_uid
  RETURNING score INTO v_score;
  INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
  VALUES (p_match_id, 'capture', v_uid, v_country, jsonb_build_object('points', v_points));

  RETURN jsonb_build_object('ok', true, 'country_id', v_country, 'owner_id', v_uid,
                            'points', v_points, 'score', v_score,
                            'shield_until', v_claim.shield_until);
END;
$$;

-- État + version monotone (dernier id d'événement) pour ignorer les réponses
-- arrivées dans le désordre côté client.
CREATE OR REPLACE FUNCTION public.conquest_get_state(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.conquest_is_player(p_match_id) THEN
    RAISE EXCEPTION 'not_a_player' USING ERRCODE = '42501';
  END IF;
  PERFORM public.conquest_close_if_expired(p_match_id);
  UPDATE public.match_players SET last_seen = now()
   WHERE match_id = p_match_id AND user_id = auth.uid() AND last_seen < now() - interval '10 seconds';
  RETURN jsonb_build_object(
    'server_now', now(),
    'version', coalesce((SELECT max(id) FROM public.match_events WHERE match_id = p_match_id), 0),
    'match', (SELECT to_jsonb(m) FROM public.matches m WHERE m.id = p_match_id),
    'players', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.joined_at)
                         FROM public.match_players p WHERE p.match_id = p_match_id), '[]'::jsonb),
    'claims', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.claimed_at)
                        FROM public.match_claims c WHERE c.match_id = p_match_id), '[]'::jsonb),
    'bonuses', coalesce((SELECT jsonb_agg(to_jsonb(b))
                         FROM public.conquest_continent_bonuses(p_match_id) b), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(e ORDER BY e.id) FROM (
                          SELECT * FROM public.match_events
                           WHERE match_id = p_match_id ORDER BY id DESC LIMIT 50) e), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------- droits -------
REVOKE ALL ON FUNCTION public.conquest_steal_penalty(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_take_action_slot(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_compute_result(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_cleanup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_register_steal_fail(public.matches, uuid, text, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_leave_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_my_active_match() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_cancel_steal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conquest_leave_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_my_active_match() TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_cancel_steal(uuid) TO authenticated;

-- ------------------------------------------- profils : comptes protégés -----
-- Avant : UPDATE ouvert à tous (USING true) → n'importe quel client pouvait
-- réécrire le profil, l'XP ou les records d'un autre. Les invités (id local
-- sans compte) restent écrivables pour ne pas casser leur synchro ; une ligne
-- dont l'id correspond à un compte auth n'est modifiable que par ce compte.
CREATE OR REPLACE FUNCTION public.tvrs_can_write_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_profile_id = auth.uid()
      OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_profile_id);
$$;
REVOKE ALL ON FUNCTION public.tvrs_can_write_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tvrs_can_write_profile(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Mise à jour publique profiles" ON public.profiles;
DROP POLICY IF EXISTS "Insertion publique profiles" ON public.profiles;
CREATE POLICY "Écriture profiles (propriétaire ou invité)" ON public.profiles
    FOR UPDATE TO anon, authenticated
    USING (public.tvrs_can_write_profile(id)) WITH CHECK (public.tvrs_can_write_profile(id));
CREATE POLICY "Insertion profiles (propriétaire ou invité)" ON public.profiles
    FOR INSERT TO anon, authenticated WITH CHECK (public.tvrs_can_write_profile(id));

DROP POLICY IF EXISTS "Mise à jour publique records" ON public.user_records;
DROP POLICY IF EXISTS "Insertion publique records" ON public.user_records;
CREATE POLICY "Écriture records (propriétaire ou invité)" ON public.user_records
    FOR UPDATE TO anon, authenticated
    USING (public.tvrs_can_write_profile(profile_id))
    WITH CHECK (public.tvrs_can_write_profile(profile_id));
CREATE POLICY "Insertion records (propriétaire ou invité)" ON public.user_records
    FOR INSERT TO anon, authenticated WITH CHECK (public.tvrs_can_write_profile(profile_id));

DROP POLICY IF EXISTS "Insertion publique leaderboards" ON public.leaderboards;
CREATE POLICY "Insertion leaderboards (propriétaire ou invité)" ON public.leaderboards
    FOR INSERT TO anon, authenticated WITH CHECK (public.tvrs_can_write_profile(profile_id));

-- ------------------------------------------------ pg_cron (si disponible) ---
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      PERFORM cron.schedule('conquest-cleanup', '*/5 * * * *', 'SELECT public.conquest_cleanup()');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron indisponible (%), nettoyage opportuniste seulement', SQLERRM;
    END;
  END IF;
END;
$do$;
