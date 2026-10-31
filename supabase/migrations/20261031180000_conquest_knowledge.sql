-- =============================================================================
-- Mode « Conquête » : escalade de connaissances (QCM 4 choix, 15 s) (31/10/2026)
--   * Table conquest_knowledge_questions : questions QCM côté serveur (RLS sans
--     policy SELECT pour anon/authenticated, la réponse ne quitte jamais le serveur).
--   * Table match_knowledge_seen : questions déjà tirées par joueur dans un match.
--   * match_steal_challenges : étendu à kind = 'knowledge' + question_id +
--     permutation answer_perm smallint[] (colonnes révoquées pour anon/authenticated).
--   * RPC conquest_knowledge_challenge / conquest_answer_knowledge :
--     - propriétaire : bonne réponse → bouclier prolongé (comme fortify) ;
--     - attaquant : voler un pays déjà renforcé/escaladé exige drapeau/capitale
--       PUIS une question d'escalade de connaissances.
-- =============================================================================

-- ---------------------------------------------------------------- schéma ----
CREATE TABLE IF NOT EXISTS public.conquest_knowledge_questions (
    id text PRIMARY KEY,
    country_id text NOT NULL REFERENCES public.conquest_countries (country_id) ON DELETE CASCADE,
    category text NOT NULL CHECK (char_length(category) > 0),
    prompt text NOT NULL,
    choices jsonb NOT NULL,
    answer_index smallint NOT NULL CHECK (answer_index BETWEEN 0 AND 3),
    difficulty smallint NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
    active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS conquest_knowledge_questions_country_idx
    ON public.conquest_knowledge_questions (country_id)
    WHERE active;

ALTER TABLE public.conquest_knowledge_questions ENABLE ROW LEVEL SECURITY;
-- Aucune policy SELECT pour anon/authenticated : la bonne réponse reste 100 % serveur.
REVOKE ALL ON TABLE public.conquest_knowledge_questions FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.match_knowledge_seen (
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    question_id text NOT NULL REFERENCES public.conquest_knowledge_questions (id) ON DELETE CASCADE,
    seen_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT match_knowledge_seen_pkey PRIMARY KEY (match_id, user_id, question_id)
);

ALTER TABLE public.match_knowledge_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.match_knowledge_seen FROM PUBLIC, anon, authenticated;

-- Étendre match_steal_challenges pour les défis de connaissances.
ALTER TABLE public.match_steal_challenges
    DROP CONSTRAINT IF EXISTS match_steal_challenges_kind_check;
ALTER TABLE public.match_steal_challenges
    ADD CONSTRAINT match_steal_challenges_kind_check
    CHECK (kind IN ('capital', 'flag', 'knowledge'));

ALTER TABLE public.match_steal_challenges
    ADD COLUMN IF NOT EXISTS question_id text REFERENCES public.conquest_knowledge_questions (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS answer_perm smallint[];

ALTER TABLE public.match_steal_challenges ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.match_steal_challenges FROM PUBLIC, anon, authenticated;
-- RLS sans policy + aucun droit table : la permutation (answer_perm) ne quitte jamais le serveur.
REVOKE ALL ON TABLE public.match_steal_challenges FROM PUBLIC, anon, authenticated;

-- Étendre match_events.kind à 'knowledge'.
ALTER TABLE public.match_events DROP CONSTRAINT IF EXISTS match_events_kind_check;
ALTER TABLE public.match_events ADD CONSTRAINT match_events_kind_check
    CHECK (kind IN ('join', 'ready', 'start', 'capture', 'fail', 'finish',
                    'steal', 'steal_fail', 'leave', 'forfeit', 'fortify', 'fortify_fail',
                    'knowledge'));

-- ------------------------------------------- RPC : défi de connaissances ----
CREATE OR REPLACE FUNCTION public.conquest_knowledge_challenge(p_match_id uuid, p_country_id text)
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
  v_prev public.match_steal_challenges;
  v_question public.conquest_knowledge_questions;
  v_perm smallint[];
  v_choices jsonb;
  v_expires timestamptz;
  v_mode text;
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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'free', 'country_id', p_country_id);
  END IF;
  v_mode := CASE WHEN v_claim.owner_id = v_uid THEN 'fortify' ELSE 'steal' END;

  -- Si un défi knowledge actif existe déjà sur ce pays, le renvoyer tel quel (anti-reroll).
  SELECT * INTO v_prev FROM public.match_steal_challenges
   WHERE match_id = p_match_id AND user_id = v_uid FOR UPDATE;
  IF FOUND AND v_prev.country_id = p_country_id AND v_prev.kind = 'knowledge'
     AND v_prev.expires_at > now() AND v_prev.question_id IS NOT NULL
     AND v_prev.answer_perm IS NOT NULL THEN
    SELECT * INTO v_question FROM public.conquest_knowledge_questions WHERE id = v_prev.question_id;
    IF FOUND THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'label', (v_question.choices -> (v_prev.answer_perm[ord]::int)) ->> 'label',
          'iconId', (v_question.choices -> (v_prev.answer_perm[ord]::int)) ->> 'iconId'
        )
        ORDER BY ord
      )
      INTO v_choices
      FROM generate_series(1, 4) AS ord;

      RETURN jsonb_build_object(
        'ok', true,
        'kind', 'knowledge',
        'mode', v_mode,
        'country_id', p_country_id,
        'question_id', v_question.id,
        'category', v_question.category,
        'prompt', v_question.prompt,
        'choices', v_choices,
        'expires_at', v_prev.expires_at
      );
    END IF;
  END IF;

  DELETE FROM public.match_steal_challenges WHERE match_id = p_match_id AND user_id = v_uid;

  SELECT * INTO v_player FROM public.match_players WHERE match_id = p_match_id AND user_id = v_uid;
  IF v_player.penalty_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'penalty', 'until', v_player.penalty_until);
  END IF;

  IF v_claim.owner_id <> v_uid AND v_claim.shield_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'shielded', 'country_id', p_country_id,
                              'until', v_claim.shield_until);
  END IF;

  -- 1. Question active non encore vue pour ce pays.
  SELECT * INTO v_question
    FROM public.conquest_knowledge_questions q
   WHERE q.country_id = p_country_id
     AND q.active
     AND NOT EXISTS (
       SELECT 1 FROM public.match_knowledge_seen s
        WHERE s.match_id = p_match_id AND s.user_id = v_uid AND s.question_id = q.id
     )
   ORDER BY random()
   LIMIT 1;

  -- 2. Fallback : toute question active non encore vue dans le match.
  IF v_question.id IS NULL THEN
    SELECT * INTO v_question
      FROM public.conquest_knowledge_questions q
     WHERE q.active
       AND NOT EXISTS (
         SELECT 1 FROM public.match_knowledge_seen s
          WHERE s.match_id = p_match_id AND s.user_id = v_uid AND s.question_id = q.id
       )
     ORDER BY (q.country_id = p_country_id) DESC, random()
     LIMIT 1;
  END IF;

  -- 3. Ultime repli si toutes les questions ont été vues.
  IF v_question.id IS NULL THEN
    SELECT * INTO v_question
      FROM public.conquest_knowledge_questions q
     WHERE q.active
     ORDER BY (q.country_id = p_country_id) DESC, random()
     LIMIT 1;
  END IF;

  IF v_question.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_question', 'country_id', p_country_id);
  END IF;

  INSERT INTO public.match_knowledge_seen (match_id, user_id, question_id)
  VALUES (p_match_id, v_uid, v_question.id)
  ON CONFLICT (match_id, user_id, question_id) DO NOTHING;

  -- Mélange des 4 choix côté serveur et stockage de la permutation.
  SELECT array_agg(idx::smallint ORDER BY random())
    INTO v_perm
    FROM generate_series(0, 3) AS idx;

  SELECT jsonb_agg(
    jsonb_build_object(
      'label', (v_question.choices -> (v_perm[ord]::int)) ->> 'label',
      'iconId', (v_question.choices -> (v_perm[ord]::int)) ->> 'iconId'
    )
    ORDER BY ord
  )
  INTO v_choices
  FROM generate_series(1, 4) AS ord;

  v_expires := now() + make_interval(secs => public.conquest_rule(v_match.rules, 'knowledge_seconds', 15));

  INSERT INTO public.match_steal_challenges
    (match_id, user_id, country_id, kind, options, expires_at, question_id, answer_perm)
  VALUES
    (p_match_id, v_uid, p_country_id, 'knowledge', '{}', v_expires, v_question.id, v_perm)
  ON CONFLICT (match_id, user_id) DO UPDATE
    SET country_id = EXCLUDED.country_id,
        kind = EXCLUDED.kind,
        options = EXCLUDED.options,
        expires_at = EXCLUDED.expires_at,
        question_id = EXCLUDED.question_id,
        answer_perm = EXCLUDED.answer_perm;

  RETURN jsonb_build_object(
    'ok', true,
    'kind', 'knowledge',
    'mode', v_mode,
    'country_id', p_country_id,
    'question_id', v_question.id,
    'category', v_question.category,
    'prompt', v_question.prompt,
    'choices', v_choices,
    'expires_at', v_expires
  );
END;
$$;

-- ----------------------------------- RPC : répondre au QCM connaissances ----
CREATE OR REPLACE FUNCTION public.conquest_answer_knowledge(p_match_id uuid, p_choice integer)
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
  v_question public.conquest_knowledge_questions;
  v_is_owner boolean;
  v_correct boolean;
  v_bonus integer;
  v_leader uuid;
  v_points integer;
  v_victim uuid;
  v_score integer;
  v_shield integer;
  v_until timestamptz;
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

  -- Anti double-soumission : consomme le défi en une seule opération atomique.
  DELETE FROM public.match_steal_challenges
   WHERE match_id = p_match_id AND user_id = v_uid AND kind = 'knowledge'
  RETURNING * INTO v_challenge;

  IF v_challenge.country_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_challenge');
  END IF;

  SELECT * INTO v_claim FROM public.match_claims
   WHERE match_id = p_match_id AND country_id = v_challenge.country_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'changed', 'country_id', v_challenge.country_id);
  END IF;

  v_is_owner := (v_claim.owner_id = v_uid);

  IF v_challenge.expires_at < now() THEN
    IF NOT v_is_owner THEN
      v_until := public.conquest_register_steal_fail(v_match, v_uid, v_challenge.country_id, 'expired');
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired',
                              'country_id', v_challenge.country_id, 'penalty_until', v_until);
  END IF;

  IF NOT v_is_owner AND v_claim.shield_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'shielded',
                              'country_id', v_challenge.country_id, 'until', v_claim.shield_until);
  END IF;

  SELECT * INTO v_question FROM public.conquest_knowledge_questions WHERE id = v_challenge.question_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_challenge');
  END IF;

  v_correct := p_choice IS NOT NULL
           AND p_choice BETWEEN 0 AND 3
           AND v_challenge.answer_perm IS NOT NULL
           AND v_challenge.answer_perm[p_choice + 1] = v_question.answer_index;

  INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
  VALUES (
    p_match_id,
    'knowledge',
    v_uid,
    v_challenge.country_id,
    jsonb_build_object('ok', v_correct, 'category', v_question.category, 'question_id', v_question.id)
  );

  IF NOT v_correct THEN
    IF v_is_owner THEN
      RETURN jsonb_build_object('ok', false, 'mode', 'fortify', 'reason', 'wrong',
                                'country_id', v_challenge.country_id,
                                'category', v_question.category, 'question_id', v_question.id);
    END IF;
    v_until := public.conquest_register_steal_fail(v_match, v_uid, v_challenge.country_id, 'wrong');
    RETURN jsonb_build_object('ok', false, 'mode', 'steal', 'reason', 'wrong',
                              'country_id', v_challenge.country_id,
                              'category', v_question.category, 'question_id', v_question.id,
                              'penalty_until', v_until);
  END IF;

  -- Succès pour le propriétaire : prolonge le bouclier (comme fortify) et escalade le pays.
  IF v_is_owner THEN
    v_bonus := public.conquest_rule(v_match.rules, 'knowledge_shield_seconds', 45);
    UPDATE public.match_claims
       SET fortify_level = least(v_claim.fortify_level + 1, 2),
           shield_until = greatest(coalesce(shield_until, now()), now()) + make_interval(secs => v_bonus)
     WHERE match_id = p_match_id AND country_id = v_challenge.country_id
    RETURNING * INTO v_claim;

    RETURN jsonb_build_object(
      'ok', true,
      'mode', 'fortify',
      'country_id', v_challenge.country_id,
      'category', v_question.category,
      'question_id', v_question.id,
      'bonus_seconds', v_bonus,
      'fortify_level', v_claim.fortify_level,
      'shield_until', v_claim.shield_until
    );
  END IF;

  -- Succès pour l'attaquant : l'étape d'escalade est franchie → transfert du pays (même sémantique que steal_country).
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
   WHERE match_id = p_match_id AND country_id = v_challenge.country_id
  RETURNING * INTO v_claim;

  INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
  VALUES (p_match_id, 'steal', v_uid, v_challenge.country_id,
          jsonb_build_object('victim', v_victim, 'points', v_points, 'knowledge', true));

  RETURN jsonb_build_object(
    'ok', true,
    'mode', 'steal',
    'country_id', v_challenge.country_id,
    'owner_id', v_uid,
    'victim', v_victim,
    'points', v_points,
    'score', v_score,
    'shield_until', v_claim.shield_until,
    'category', v_question.category,
    'question_id', v_question.id
  );
END;
$$;

-- --------------------- Vol d'un pays renforcé : drapeau/capitale PUIS QCM ---
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

  -- Si le pays est déjà renforcé/escaladé (fortify_level > 0) et que le référentiel
  -- de questions est chargé : l'étape drapeau/capitale ouvre immédiatement le défi QCM de connaissances (15 s) requis pour conclure le vol.
  IF v_claim.fortify_level > 0
     AND EXISTS (SELECT 1 FROM public.conquest_knowledge_questions WHERE active) THEN
    -- Le renfort ne tombe qu'en cas de bonne réponse au QCM (transfert dans conquest_answer_knowledge).
    RETURN public.conquest_knowledge_challenge(p_match_id, v_country.country_id)
           || jsonb_build_object('needs_knowledge', true, 'mode', 'steal');
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

-- ------------------------------------------------------------- droits -------
REVOKE ALL ON FUNCTION public.conquest_knowledge_challenge(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_answer_knowledge(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conquest_knowledge_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_answer_knowledge(uuid, integer) TO authenticated;
