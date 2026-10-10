-- =============================================================================
-- Mode « Conquête » — phase 2 : vols, boucliers, cooldown, pénalité,
-- bonus continent, aide au comeback.
--
-- NE PAS APPLIQUER sans confirmation d'Antoine : les migrations ne se déploient
-- plus que depuis `main` (workflow supabase-deploy, environnement Production
-- avec approbation). Le mode reste masqué derrière VITE_ENABLE_CONQUEST.
-- =============================================================================

-- Référentiel : code ISO (drapeaux) et capitales.
ALTER TABLE public.conquest_countries
    ADD COLUMN IF NOT EXISTS iso2 text,
    ADD COLUMN IF NOT EXISTS capital_en text,
    ADD COLUMN IF NOT EXISTS capital_fr text;

CREATE TABLE IF NOT EXISTS public.conquest_capital_aliases (
    alias_norm text NOT NULL,
    country_id text NOT NULL REFERENCES public.conquest_countries (country_id) ON DELETE CASCADE,
    CONSTRAINT conquest_capital_aliases_pkey PRIMARY KEY (country_id, alias_norm)
);
ALTER TABLE public.conquest_capital_aliases ENABLE ROW LEVEL SECURITY;
-- Pas de policy : réponses jamais lisibles par les clients.

CREATE INDEX IF NOT EXISTS match_claims_country_idx ON public.match_claims (country_id);
CREATE INDEX IF NOT EXISTS conquest_country_aliases_country_idx
    ON public.conquest_country_aliases (country_id);

-- Joueurs : pénalité de saisie et compteur de vols.
ALTER TABLE public.match_players
    ADD COLUMN IF NOT EXISTS penalty_until timestamptz,
    ADD COLUMN IF NOT EXISTS steals integer NOT NULL DEFAULT 0;

-- Nouveaux types d'événements.
ALTER TABLE public.match_events DROP CONSTRAINT IF EXISTS match_events_kind_check;
ALTER TABLE public.match_events ADD CONSTRAINT match_events_kind_check
    CHECK (kind IN ('join', 'ready', 'start', 'capture', 'fail', 'finish',
                    'steal', 'steal_fail'));
CREATE INDEX IF NOT EXISTS match_events_steal_idx
    ON public.match_events (match_id, actor_id, country_id, created_at)
    WHERE kind = 'steal';

-- Défi de vol en cours (un par joueur et par match).
CREATE TABLE IF NOT EXISTS public.match_steal_challenges (
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    country_id text NOT NULL REFERENCES public.conquest_countries (country_id),
    kind text NOT NULL CHECK (kind IN ('capital', 'flag')),
    options text[] NOT NULL DEFAULT '{}',
    expires_at timestamptz NOT NULL,
    CONSTRAINT match_steal_challenges_pkey PRIMARY KEY (match_id, user_id)
);
CREATE INDEX IF NOT EXISTS match_steal_challenges_country_idx
    ON public.match_steal_challenges (country_id);
ALTER TABLE public.match_steal_challenges ENABLE ROW LEVEL SECURITY;
-- Pas de policy : le défi est renvoyé par la RPC, la solution reste serveur.

-- Réglages (constantes du MVP, surchargées par matches.rules plus tard).
CREATE OR REPLACE FUNCTION public.conquest_rule(p_rules jsonb, p_key text, p_default integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce((p_rules ->> p_key)::integer, p_default);
$$;

-- -----------------------------------------------------------------------------
-- Bonus continent : détenir au moins la moitié des pays d'un continent
-- rapporte un bonus (continu : recalculé à chaque état, compté en fin).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conquest_continent_bonuses(p_match_id uuid)
RETURNS TABLE (user_id uuid, region text, bonus integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH totals AS (
    SELECT region, count(*) AS total
      FROM public.conquest_countries
     WHERE coalesce(region, '') NOT IN ('', 'Antarctic')
     GROUP BY region
  ), held AS (
    SELECT c.owner_id, cc.region, count(*) AS n
      FROM public.match_claims c
      JOIN public.conquest_countries cc USING (country_id)
     WHERE c.match_id = p_match_id
     GROUP BY c.owner_id, cc.region
  )
  SELECT h.owner_id, h.region, 50
    FROM held h JOIN totals t USING (region)
   WHERE h.n * 2 >= t.total;
$$;

-- Leader strict (score), ou NULL en cas d'égalité.
CREATE OR REPLACE FUNCTION public.conquest_leader(p_match_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE WHEN count(*) FILTER (WHERE score = top) = 1
              THEN (array_agg(user_id) FILTER (WHERE score = top))[1] END
    FROM (SELECT user_id, score, max(score) OVER () AS top
            FROM public.match_players WHERE match_id = p_match_id) s;
$$;

-- -----------------------------------------------------------------------------
-- RPC : demander un défi de vol sur un pays adverse.
-- -----------------------------------------------------------------------------
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

  SELECT * INTO v_player FROM public.match_players WHERE match_id = p_match_id AND user_id = v_uid;
  IF v_player.penalty_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'penalty', 'until', v_player.penalty_until);
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

  v_cooldown := public.conquest_rule(v_match.rules, 'steal_cooldown_seconds', 60);
  IF EXISTS (SELECT 1 FROM public.match_events
              WHERE match_id = p_match_id AND kind = 'steal' AND actor_id = v_uid
                AND country_id = p_country_id
                AND created_at > now() - make_interval(secs => v_cooldown)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cooldown', 'country_id', p_country_id);
  END IF;

  SELECT * INTO v_country FROM public.conquest_countries WHERE country_id = p_country_id;
  IF v_country.capital_en IS NOT NULL AND random() < 0.5 THEN
    v_kind := 'capital';
  ELSE
    v_kind := 'flag';
    SELECT array_agg(iso2 ORDER BY random()) INTO v_options FROM (
      SELECT v_country.iso2 AS iso2
      UNION ALL
      (SELECT iso2 FROM public.conquest_countries
        WHERE iso2 IS NOT NULL AND iso2 <> v_country.iso2
        ORDER BY (region = v_country.region) DESC, random() LIMIT 3)
    ) o;
  END IF;

  v_expires := now() + interval '20 seconds';
  INSERT INTO public.match_steal_challenges AS c (match_id, user_id, country_id, kind, options, expires_at)
  VALUES (p_match_id, v_uid, p_country_id, v_kind, v_options, v_expires)
  ON CONFLICT (match_id, user_id) DO UPDATE
    SET country_id = EXCLUDED.country_id, kind = EXCLUDED.kind,
        options = EXCLUDED.options, expires_at = EXCLUDED.expires_at;

  RETURN jsonb_build_object('ok', true, 'country_id', p_country_id, 'kind', v_kind,
                            'options', to_jsonb(v_options), 'expires_at', v_expires);
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC : répondre au défi. Verrou sur la ligne du pays, premier commit gagnant.
-- -----------------------------------------------------------------------------
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
  v_penalty integer;
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
    RETURN jsonb_build_object('ok', false, 'reason', 'expired', 'country_id', v_challenge.country_id);
  END IF;

  SELECT * INTO v_claim FROM public.match_claims
   WHERE match_id = p_match_id AND country_id = v_challenge.country_id
   FOR UPDATE;
  IF NOT FOUND OR v_claim.owner_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'changed', 'country_id', v_challenge.country_id);
  END IF;
  IF v_claim.shield_until > now() THEN
    -- Un autre vol vient d'être validé : le bouclier protège le nouveau détenteur.
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
    v_penalty := public.conquest_rule(v_match.rules, 'steal_penalty_seconds', 3);
    UPDATE public.match_players
       SET penalty_until = now() + make_interval(secs => v_penalty)
     WHERE match_id = p_match_id AND user_id = v_uid;
    INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
    VALUES (p_match_id, 'steal_fail', v_uid, v_country.country_id,
            jsonb_build_object('victim', v_claim.owner_id));
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong', 'country_id', v_country.country_id,
                              'penalty_until', now() + make_interval(secs => v_penalty));
  END IF;

  -- Comeback : le non-leader gagne +5 ; un leader strict a des boucliers plus courts.
  v_leader := public.conquest_leader(p_match_id);
  v_points := 15 + CASE WHEN v_leader IS NOT NULL AND v_leader <> v_uid THEN 5 ELSE 0 END;
  v_victim := v_claim.owner_id;

  UPDATE public.match_players
     SET score = score + v_points, steals = steals + 1, last_seen = now()
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

-- Capture d'un pays libre : identique à la phase 1 + pénalité + bouclier réduit du leader.
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

  SELECT country_id INTO v_country FROM public.conquest_country_aliases
   WHERE alias_norm = v_norm ORDER BY country_id LIMIT 1;
  IF v_country IS NULL THEN
    INSERT INTO public.match_events (match_id, kind, actor_id, payload)
    VALUES (p_match_id, 'fail', v_uid, jsonb_build_object('reason', 'unknown'));
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown');
  END IF;

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

-- État : ajoute bonus continent et heure serveur.
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
  RETURN jsonb_build_object(
    'server_now', now(),
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

-- Droits.
REVOKE ALL ON FUNCTION public.conquest_continent_bonuses(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_leader(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_rule(jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_steal_challenge(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.steal_country(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conquest_steal_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.steal_country(uuid, text) TO authenticated;
