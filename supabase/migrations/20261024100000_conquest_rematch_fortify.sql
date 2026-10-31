-- =============================================================================
-- Mode « Conquête » : rejouer + protection « Clash of Clans » (24/10/2026)
--   Rejouer   conquest_rematch : depuis l'écran de fin, le premier joueur crée
--             un nouveau salon (lié via matches.rematch_id), le second le
--             rejoint ; les deux sont prêts d'office. Le créateur d'un salon
--             est désormais prêt par défaut.
--   Protéger  capture = 20 s de bouclier ; re-cliquer son pays ouvre un défi
--             (drapeau OU capitale) : +30 s, puis l'autre (capitale/drapeau) :
--             +1 min. Validation 100 % serveur (comme le vol).
-- =============================================================================

-- ---------------------------------------------------------------- schéma ----
ALTER TABLE public.matches
    ADD COLUMN IF NOT EXISTS rematch_id uuid REFERENCES public.matches (id) ON DELETE SET NULL;

ALTER TABLE public.match_claims
    ADD COLUMN IF NOT EXISTS fortify_level integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fortify_first_kind text;

ALTER TABLE public.match_events DROP CONSTRAINT IF EXISTS match_events_kind_check;
ALTER TABLE public.match_events ADD CONSTRAINT match_events_kind_check
    CHECK (kind IN ('join', 'ready', 'start', 'capture', 'fail', 'finish',
                    'steal', 'steal_fail', 'leave', 'forfeit', 'fortify', 'fortify_fail'));

-- Défi de renforcement en cours (un par joueur et par match ; solution serveur).
CREATE TABLE IF NOT EXISTS public.match_fortify_challenges (
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    country_id text NOT NULL REFERENCES public.conquest_countries (country_id),
    step integer NOT NULL CHECK (step IN (1, 2)),
    kind text NOT NULL CHECK (kind IN ('capital', 'flag')),
    options text[] NOT NULL DEFAULT '{}',
    expires_at timestamptz NOT NULL,
    CONSTRAINT match_fortify_challenges_pkey PRIMARY KEY (match_id, user_id)
);
ALTER TABLE public.match_fortify_challenges ENABLE ROW LEVEL SECURITY;
-- Pas de policy : lu uniquement par les RPC SECURITY DEFINER.

-- Un pays qui change de main perd ses renforts.
CREATE OR REPLACE FUNCTION public.conquest_reset_fortify()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    NEW.fortify_level := 0;
    NEW.fortify_first_kind := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS match_claims_reset_fortify ON public.match_claims;
CREATE TRIGGER match_claims_reset_fortify BEFORE UPDATE OF owner_id ON public.match_claims
    FOR EACH ROW EXECUTE FUNCTION public.conquest_reset_fortify();

-- ------------------------------------------------- création de salon ------
-- Insère un match avec un code unique (6 caractères sans ambiguïté).
CREATE OR REPLACE FUNCTION public.conquest_insert_match(
  p_host uuid, p_duration integer, p_max_players integer DEFAULT 2)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  FOR attempt IN 1..10 LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.matches (code, host_id, duration_seconds, max_players)
      VALUES (v_code, p_host, least(greatest(coalesce(p_duration, 600), 60), 3600),
              least(greatest(coalesce(p_max_players, 2), 2), 8))
      RETURNING * INTO v_match;
      RETURN v_match;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 10 THEN RAISE; END IF;
    END;
  END LOOP;
  RETURN v_match;
END;
$$;

-- Le créateur du salon est prêt d'office.
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
BEGIN
  PERFORM public.conquest_cleanup();
  v_match := public.conquest_insert_match(v_uid, p_duration_seconds, 2);
  INSERT INTO public.match_players (match_id, user_id, display_name, color, pattern, ready)
  VALUES (v_match.id, v_uid, left(btrim(p_display_name), 30),
          CASE WHEN p_color IN ('teal', 'amber', 'red', 'green') THEN p_color ELSE 'teal' END,
          CASE WHEN p_pattern IN ('solid', 'dots', 'hatch', 'cross') THEN p_pattern ELSE 'solid' END,
          true);
  INSERT INTO public.match_events (match_id, kind, actor_id) VALUES (v_match.id, 'join', v_uid);
  RETURN v_match;
END;
$$;

-- Rejouer : seul un joueur d'un match terminé peut l'appeler. Le premier crée
-- le salon de revanche (même durée, même couleur), les suivants le rejoignent.
-- Tout le monde y entre « prêt » : il ne reste qu'à lancer.
CREATE OR REPLACE FUNCTION public.conquest_rematch(p_match_id uuid)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_old public.matches;
  v_new public.matches;
  v_me public.match_players;
  v_color text;
  v_count integer;
BEGIN
  IF NOT public.conquest_is_player(p_match_id) THEN
    RAISE EXCEPTION 'not_a_player' USING ERRCODE = '42501';
  END IF;
  PERFORM public.conquest_close_if_expired(p_match_id);
  SELECT * INTO v_old FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF v_old.status <> 'finished' THEN
    RAISE EXCEPTION 'match_not_finished' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_me FROM public.match_players WHERE match_id = p_match_id AND user_id = v_uid;

  IF v_old.rematch_id IS NOT NULL THEN
    SELECT * INTO v_new FROM public.matches WHERE id = v_old.rematch_id FOR UPDATE;
  END IF;

  IF v_new.id IS NULL OR v_new.status = 'finished' THEN
    v_new := public.conquest_insert_match(v_uid, v_old.duration_seconds, v_old.max_players);
    UPDATE public.matches SET rematch_id = v_new.id WHERE id = p_match_id;
  ELSIF EXISTS (SELECT 1 FROM public.match_players WHERE match_id = v_new.id AND user_id = v_uid) THEN
    RETURN v_new; -- double clic / reconnexion
  ELSIF v_new.status <> 'lobby' THEN
    RAISE EXCEPTION 'match_already_started' USING ERRCODE = 'P0001';
  ELSE
    SELECT count(*) INTO v_count FROM public.match_players WHERE match_id = v_new.id;
    IF v_count >= v_new.max_players THEN
      RAISE EXCEPTION 'match_full' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT c INTO v_color
    FROM unnest(ARRAY[v_me.color, 'teal', 'amber', 'red', 'green']) WITH ORDINALITY AS t(c, ord)
   WHERE NOT EXISTS (SELECT 1 FROM public.match_players WHERE match_id = v_new.id AND color = c)
   ORDER BY ord LIMIT 1;
  INSERT INTO public.match_players (match_id, user_id, display_name, color, pattern, ready)
  VALUES (v_new.id, v_uid, v_me.display_name, v_color, v_me.pattern, true);
  INSERT INTO public.match_events (match_id, kind, actor_id) VALUES (v_new.id, 'join', v_uid);
  INSERT INTO public.match_events (match_id, kind, actor_id, payload)
  VALUES (v_new.id, 'ready', v_uid, jsonb_build_object('ready', true, 'rematch', true));
  RETURN v_new;
END;
$$;

-- ------------------------------------------------------ capture : 20 s -----
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

  -- Protection « Clash of Clans » : 20 s après une capture, renforçable.
  v_shield := public.conquest_rule(v_match.rules, 'capture_shield_seconds', 20);
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

-- ------------------------------------------------- renforcer son pays ------
-- Bonus de bouclier par étape (s) : 1 → +30 s, 2 → +60 s.
CREATE OR REPLACE FUNCTION public.conquest_fortify_bonus(p_rules jsonb, p_step integer)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE p_step
    WHEN 1 THEN public.conquest_rule(p_rules, 'fortify_step1_seconds', 30)
    WHEN 2 THEN public.conquest_rule(p_rules, 'fortify_step2_seconds', 60)
    ELSE 0 END;
$$;

-- Ouvre le défi de renforcement d'un pays possédé. Étape 1 : drapeau ou
-- capitale au hasard ; étape 2 : l'autre. Un défi en cours est renvoyé tel quel.
CREATE OR REPLACE FUNCTION public.conquest_fortify_challenge(p_match_id uuid, p_country_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_claim public.match_claims;
  v_country public.conquest_countries;
  v_prev public.match_fortify_challenges;
  v_step integer;
  v_kind text;
  v_options text[] := '{}';
  v_expires timestamptz;
  v_penalty timestamptz;
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

  SELECT * INTO v_claim FROM public.match_claims
   WHERE match_id = p_match_id AND country_id = p_country_id;
  IF NOT FOUND OR v_claim.owner_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yours', 'country_id', p_country_id);
  END IF;
  IF v_claim.fortify_level >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'max_fortified', 'country_id', p_country_id,
                              'until', v_claim.shield_until);
  END IF;
  v_step := v_claim.fortify_level + 1;

  SELECT * INTO v_prev FROM public.match_fortify_challenges
   WHERE match_id = p_match_id AND user_id = v_uid FOR UPDATE;
  IF FOUND AND v_prev.country_id = p_country_id AND v_prev.step = v_step
     AND v_prev.expires_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'mode', 'fortify', 'country_id', p_country_id,
                              'step', v_step, 'kind', v_prev.kind,
                              'options', to_jsonb(v_prev.options), 'expires_at', v_prev.expires_at,
                              'bonus_seconds', public.conquest_fortify_bonus(v_match.rules, v_step));
  END IF;
  DELETE FROM public.match_fortify_challenges WHERE match_id = p_match_id AND user_id = v_uid;

  SELECT penalty_until INTO v_penalty FROM public.match_players
   WHERE match_id = p_match_id AND user_id = v_uid;
  IF v_penalty > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'penalty', 'until', v_penalty);
  END IF;
  IF NOT public.conquest_take_action_slot(p_match_id, v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;
  -- Mauvaise réponse : 10 s avant de retenter ce pays.
  IF EXISTS (SELECT 1 FROM public.match_events
              WHERE match_id = p_match_id AND actor_id = v_uid AND country_id = p_country_id
                AND kind = 'fortify_fail'
                AND created_at > now() - make_interval(
                      secs => public.conquest_rule(v_match.rules, 'fortify_fail_cooldown_seconds', 10)))
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cooldown', 'country_id', p_country_id);
  END IF;

  SELECT * INTO v_country FROM public.conquest_countries WHERE country_id = p_country_id;
  IF v_step = 1 THEN
    v_kind := CASE WHEN v_country.capital_en IS NOT NULL AND random() < 0.5 THEN 'capital' ELSE 'flag' END;
  ELSE
    v_kind := CASE WHEN v_claim.fortify_first_kind = 'flag' AND v_country.capital_en IS NOT NULL
                   THEN 'capital' ELSE 'flag' END;
  END IF;
  IF v_kind = 'flag' THEN
    SELECT array_agg(iso2 ORDER BY random()) INTO v_options FROM (
      SELECT v_country.iso2 AS iso2
      UNION ALL
      (SELECT iso2 FROM public.conquest_countries
        WHERE iso2 IS NOT NULL AND iso2 <> v_country.iso2
        ORDER BY (region = v_country.region) DESC, random() LIMIT 5)
    ) o;
  END IF;

  v_expires := now() + interval '20 seconds';
  INSERT INTO public.match_fortify_challenges (match_id, user_id, country_id, step, kind, options, expires_at)
  VALUES (p_match_id, v_uid, p_country_id, v_step, v_kind, v_options, v_expires);
  RETURN jsonb_build_object('ok', true, 'mode', 'fortify', 'country_id', p_country_id,
                            'step', v_step, 'kind', v_kind,
                            'options', to_jsonb(v_options), 'expires_at', v_expires,
                            'bonus_seconds', public.conquest_fortify_bonus(v_match.rules, v_step));
END;
$$;

-- Répond au défi : bonne réponse → bouclier prolongé (à partir de son échéance
-- si elle est encore à venir, sinon de maintenant).
CREATE OR REPLACE FUNCTION public.conquest_fortify(p_match_id uuid, p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_challenge public.match_fortify_challenges;
  v_claim public.match_claims;
  v_country public.conquest_countries;
  v_correct boolean;
  v_bonus integer;
BEGIN
  IF NOT public.conquest_is_player(p_match_id) THEN
    RAISE EXCEPTION 'not_a_player' USING ERRCODE = '42501';
  END IF;
  IF public.conquest_close_if_expired(p_match_id) = 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'finished');
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;

  DELETE FROM public.match_fortify_challenges
   WHERE match_id = p_match_id AND user_id = v_uid
  RETURNING * INTO v_challenge;
  IF v_challenge.country_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_challenge');
  END IF;
  IF v_challenge.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired', 'country_id', v_challenge.country_id);
  END IF;

  SELECT * INTO v_claim FROM public.match_claims
   WHERE match_id = p_match_id AND country_id = v_challenge.country_id FOR UPDATE;
  IF NOT FOUND OR v_claim.owner_id <> v_uid OR v_claim.fortify_level + 1 <> v_challenge.step THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'changed', 'country_id', v_challenge.country_id);
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
    INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
    VALUES (p_match_id, 'fortify_fail', v_uid, v_country.country_id,
            jsonb_build_object('step', v_challenge.step));
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong', 'country_id', v_country.country_id);
  END IF;

  v_bonus := public.conquest_fortify_bonus(v_match.rules, v_challenge.step);
  UPDATE public.match_claims
     SET fortify_level = v_challenge.step,
         fortify_first_kind = coalesce(fortify_first_kind, v_challenge.kind),
         shield_until = greatest(coalesce(shield_until, now()), now()) + make_interval(secs => v_bonus)
   WHERE match_id = p_match_id AND country_id = v_country.country_id
  RETURNING * INTO v_claim;
  INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
  VALUES (p_match_id, 'fortify', v_uid, v_country.country_id,
          jsonb_build_object('step', v_challenge.step, 'seconds', v_bonus));
  RETURN jsonb_build_object('ok', true, 'mode', 'fortify', 'country_id', v_country.country_id,
                            'step', v_challenge.step, 'bonus_seconds', v_bonus,
                            'fortify_level', v_claim.fortify_level,
                            'shield_until', v_claim.shield_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.conquest_cancel_fortify(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
BEGIN
  IF NOT public.conquest_is_player(p_match_id) THEN
    RAISE EXCEPTION 'not_a_player' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.match_fortify_challenges WHERE match_id = p_match_id AND user_id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ------------------------------------------------------------- droits -------
REVOKE ALL ON FUNCTION public.conquest_reset_fortify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_insert_match(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_fortify_bonus(jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_rematch(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_fortify_challenge(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_fortify(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_cancel_fortify(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conquest_rematch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_fortify_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_fortify(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_cancel_fortify(uuid) TO authenticated;
