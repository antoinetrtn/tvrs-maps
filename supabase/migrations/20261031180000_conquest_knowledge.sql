-- =============================================================================
-- Mode « Conquête » : échelle d'escalade aléatoire et symétrique (31/10/2026)
--   Chaque pays d'un match a une CHAÎNE de défis, partagée par tous les joueurs :
--   * Niveaux 1 à 5 = capitale, drapeau, tech, faune & flore, musique, dans un
--     ordre ALÉATOIRE propre au couple (match, pays), stable pendant le match
--     (tri par md5(match_id || pays || type)). Au-delà : questions de
--     connaissances supplémentaires du pays (puis d'ailleurs en dernier recours).
--   * match_claims.ladder_step = niveau courant de la chaîne. Il ne redescend
--     jamais : chaque vol réussi ET chaque renfort réussi le font monter de 1.
--     Le vol suivant (y compris le contre-vol de l'ancien propriétaire) affronte
--     donc le niveau d'après, avec une question jamais vue dans cette chaîne
--     (match_country_chain).
--   * Renfort : le propriétaire peut répondre au défi courant pour allonger son
--     bouclier (+30 s puis +1 min, 2 renforts max par possession, remis à 0 au
--     changement de main). Il fait aussi monter la chaîne.
--   * Révélation progressive : seul le défi courant est envoyé au client, jamais
--     l'ordre ni les niveaux suivants.
--   * Réponses validées 100 % serveur selon le type de question :
--     choice (étiquette), text (alias normalisés comme la capitale),
--     number (valeur ± tolérance), order (ordre exact des étiquettes, JSON).
-- =============================================================================

-- ---------------------------------------------------------------- schéma ----
CREATE TABLE IF NOT EXISTS public.conquest_knowledge_questions (
    id text PRIMARY KEY,
    country_id text NOT NULL REFERENCES public.conquest_countries (country_id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('tech', 'nature', 'musique', 'culture')),
    answer_type text NOT NULL CHECK (answer_type IN ('choice', 'text', 'number', 'order')),
    prompt text NOT NULL,
    -- Données d'affichage sans la réponse (propositions, curseur…).
    display jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Solution, jamais envoyée au client.
    answer jsonb NOT NULL,
    source_url text,
    -- false quand l'URL de la source trahit la réponse : le « i » n'est alors pas affiché.
    source_safe boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS conquest_knowledge_questions_country_idx
    ON public.conquest_knowledge_questions (country_id) WHERE active;
ALTER TABLE public.conquest_knowledge_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conquest_knowledge_questions FROM PUBLIC, anon, authenticated;

-- Questions déjà tirées dans la chaîne d'un pays (jamais répétées).
CREATE TABLE IF NOT EXISTS public.match_country_chain (
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    country_id text NOT NULL,
    question_id text NOT NULL REFERENCES public.conquest_knowledge_questions (id) ON DELETE CASCADE,
    drawn_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT match_country_chain_pkey PRIMARY KEY (match_id, country_id, question_id)
);
ALTER TABLE public.match_country_chain ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.match_country_chain FROM PUBLIC, anon, authenticated;

ALTER TABLE public.match_claims
    ADD COLUMN IF NOT EXISTS ladder_step integer NOT NULL DEFAULT 0;

ALTER TABLE public.match_steal_challenges DROP CONSTRAINT IF EXISTS match_steal_challenges_kind_check;
ALTER TABLE public.match_steal_challenges ADD CONSTRAINT match_steal_challenges_kind_check
    CHECK (kind IN ('capital', 'flag', 'knowledge'));
ALTER TABLE public.match_steal_challenges
    ADD COLUMN IF NOT EXISTS question_id text REFERENCES public.conquest_knowledge_questions (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ladder_step integer NOT NULL DEFAULT 0;

ALTER TABLE public.match_fortify_challenges DROP CONSTRAINT IF EXISTS match_fortify_challenges_kind_check;
ALTER TABLE public.match_fortify_challenges ADD CONSTRAINT match_fortify_challenges_kind_check
    CHECK (kind IN ('capital', 'flag', 'knowledge'));
ALTER TABLE public.match_fortify_challenges
    ADD COLUMN IF NOT EXISTS question_id text REFERENCES public.conquest_knowledge_questions (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ladder_step integer NOT NULL DEFAULT 0;

-- Aucune lecture directe des défis par les clients (solution + question tirée).
ALTER TABLE public.match_steal_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_fortify_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.match_steal_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.match_fortify_challenges FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------- échelle ----------
-- Type du niveau p_step (0 = premier) de la chaîne d'un pays : ordre aléatoire
-- mais stable par (match, pays). Au-delà des 5 niveaux de base : 'extra'.
CREATE OR REPLACE FUNCTION public.conquest_ladder_slot(p_match_id uuid, p_country_id text, p_step integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_step BETWEEN 0 AND 4 THEN (
    SELECT s FROM unnest(ARRAY['capital', 'flag', 'tech', 'nature', 'musique']) AS s
     ORDER BY md5(p_match_id::text || '|' || p_country_id || '|' || s)
     OFFSET p_step LIMIT 1)
  ELSE 'extra' END;
$$;

-- Tire le défi du niveau courant. Les questions déjà tirées dans la chaîne du
-- pays sont exclues (repli : la moins récemment tirée).
CREATE OR REPLACE FUNCTION public.conquest_ladder_pick(
  p_match_id uuid, p_country_id text, p_step integer,
  OUT kind text, OUT options text[], OUT question_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country public.conquest_countries;
  v_q public.conquest_knowledge_questions;
  v_slot text := public.conquest_ladder_slot(p_match_id, p_country_id, p_step);
BEGIN
  options := '{}';
  SELECT * INTO v_country FROM public.conquest_countries WHERE country_id = p_country_id;
  IF v_slot = 'capital' AND v_country.capital_en IS NOT NULL THEN
    kind := 'capital';
    RETURN;
  END IF;
  IF v_slot = 'flag' AND v_country.iso2 IS NOT NULL THEN
    kind := 'flag';
    SELECT array_agg(iso2 ORDER BY random()) INTO options FROM (
      SELECT v_country.iso2 AS iso2
      UNION ALL
      (SELECT iso2 FROM public.conquest_countries
        WHERE iso2 IS NOT NULL AND iso2 <> v_country.iso2
        ORDER BY (region = v_country.region) DESC, random() LIMIT 5)
    ) o;
    RETURN;
  END IF;

  -- Catégorie du niveau, puis culture, puis toute question du pays, puis d'ailleurs.
  SELECT q.* INTO v_q FROM public.conquest_knowledge_questions q
    LEFT JOIN public.match_country_chain c
      ON c.match_id = p_match_id AND c.country_id = p_country_id AND c.question_id = q.id
   WHERE q.active
   ORDER BY c.question_id IS NOT NULL, c.drawn_at NULLS FIRST,
            q.country_id <> p_country_id,
            CASE WHEN q.category = v_slot THEN 0 WHEN q.category = 'culture' THEN 1 ELSE 2 END,
            random()
   LIMIT 1;
  IF NOT FOUND THEN
    -- Pas de banque de questions : on retombe sur le drapeau.
    kind := 'flag';
    SELECT array_agg(iso2 ORDER BY random()) INTO options FROM (
      SELECT v_country.iso2 AS iso2
      UNION ALL
      (SELECT iso2 FROM public.conquest_countries
        WHERE iso2 IS NOT NULL AND iso2 <> v_country.iso2 ORDER BY random() LIMIT 5)
    ) o;
    RETURN;
  END IF;
  kind := 'knowledge';
  question_id := v_q.id;
  IF v_q.answer_type IN ('choice', 'order') THEN
    SELECT array_agg(c ->> 'label' ORDER BY random()) INTO options
      FROM jsonb_array_elements(v_q.display -> 'items') c;
  END IF;
  INSERT INTO public.match_country_chain (match_id, country_id, question_id)
  VALUES (p_match_id, p_country_id, v_q.id)
  ON CONFLICT ON CONSTRAINT match_country_chain_pkey DO UPDATE SET drawn_at = now();
END;
$$;

-- Ce que le client voit du défi courant (jamais la réponse ni les niveaux suivants).
CREATE OR REPLACE FUNCTION public.conquest_ladder_payload(
  p_kind text, p_options text[], p_question_id text, p_step integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q public.conquest_knowledge_questions;
  v_icons jsonb;
BEGIN
  IF p_kind <> 'knowledge' THEN
    RETURN jsonb_build_object('kind', p_kind, 'level', p_step + 1, 'options', to_jsonb(p_options));
  END IF;
  SELECT * INTO v_q FROM public.conquest_knowledge_questions WHERE id = p_question_id;
  SELECT jsonb_agg((SELECT c ->> 'iconId' FROM jsonb_array_elements(v_q.display -> 'items') c
                     WHERE c ->> 'label' = o.label LIMIT 1) ORDER BY o.ord)
    INTO v_icons
    FROM unnest(p_options) WITH ORDINALITY AS o(label, ord);
  RETURN jsonb_build_object(
    'kind', p_kind, 'level', p_step + 1, 'answer_type', v_q.answer_type,
    'question_id', v_q.id, 'category', v_q.category, 'prompt', v_q.prompt,
    'options', to_jsonb(p_options), 'icons', coalesce(v_icons, '[]'::jsonb),
    'min', v_q.display -> 'min', 'max', v_q.display -> 'max',
    'step', v_q.display -> 'step', 'unit', v_q.display ->> 'unit',
    'source_url', CASE WHEN v_q.source_safe THEN v_q.source_url END);
END;
$$;

-- Vérifie une réponse selon le type de défi.
CREATE OR REPLACE FUNCTION public.conquest_ladder_check(
  p_kind text, p_country_id text, p_question_id text, p_answer text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country public.conquest_countries;
  v_q public.conquest_knowledge_questions;
  v_num numeric;
  v_order jsonb;
BEGIN
  IF p_answer IS NULL THEN
    RETURN false;
  END IF;
  IF p_kind = 'knowledge' THEN
    SELECT * INTO v_q FROM public.conquest_knowledge_questions WHERE id = p_question_id;
    IF NOT FOUND THEN
      RETURN false;
    END IF;
    CASE v_q.answer_type
      WHEN 'choice' THEN
        RETURN btrim(p_answer) = v_q.answer ->> 'label';
      WHEN 'text' THEN
        RETURN public.conquest_normalize(p_answer) <> ''
           AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_q.answer -> 'aliases') a
                        WHERE public.conquest_normalize(a) = public.conquest_normalize(p_answer));
      WHEN 'number' THEN
        BEGIN
          v_num := replace(btrim(p_answer), ',', '.')::numeric;
        EXCEPTION WHEN others THEN
          RETURN false;
        END;
        RETURN abs(v_num - (v_q.answer ->> 'value')::numeric)
               <= coalesce((v_q.answer ->> 'tolerance')::numeric, 0);
      WHEN 'order' THEN
        BEGIN
          v_order := p_answer::jsonb;
        EXCEPTION WHEN others THEN
          RETURN false;
        END;
        RETURN v_order = v_q.answer -> 'order';
      ELSE
        RETURN false;
    END CASE;
  END IF;
  SELECT * INTO v_country FROM public.conquest_countries WHERE country_id = p_country_id;
  IF p_kind = 'flag' THEN
    RETURN upper(btrim(p_answer)) = upper(v_country.iso2);
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.conquest_capital_aliases
                  WHERE country_id = p_country_id
                    AND alias_norm = public.conquest_normalize(p_answer));
END;
$$;

-- ------------------------------------------------------- vol -------------
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
  v_prev public.match_steal_challenges;
  v_pick record;
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
    RETURN jsonb_build_object('ok', true, 'country_id', p_country_id, 'expires_at', v_prev.expires_at)
        || public.conquest_ladder_payload(v_prev.kind, v_prev.options, v_prev.question_id, v_prev.ladder_step);
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

  -- Défi du niveau courant de la chaîne du pays (ordre aléatoire par match).
  SELECT * INTO v_pick FROM public.conquest_ladder_pick(p_match_id, p_country_id, v_claim.ladder_step);

  v_expires := now() + interval '20 seconds';
  INSERT INTO public.match_steal_challenges
    (match_id, user_id, country_id, kind, options, expires_at, question_id, ladder_step)
  VALUES (p_match_id, v_uid, p_country_id, v_pick.kind, v_pick.options, v_expires,
          v_pick.question_id, v_claim.ladder_step);

  RETURN jsonb_build_object('ok', true, 'country_id', p_country_id, 'expires_at', v_expires)
      || public.conquest_ladder_payload(v_pick.kind, v_pick.options, v_pick.question_id, v_claim.ladder_step);
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
  IF NOT FOUND OR v_claim.owner_id = v_uid OR v_claim.ladder_step <> v_challenge.ladder_step THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'changed', 'country_id', v_challenge.country_id);
  END IF;
  IF v_claim.shield_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'shielded',
                              'country_id', v_challenge.country_id, 'until', v_claim.shield_until);
  END IF;

  SELECT * INTO v_country FROM public.conquest_countries WHERE country_id = v_challenge.country_id;
  v_correct := public.conquest_ladder_check(v_challenge.kind, v_country.country_id,
                                             v_challenge.question_id, p_answer);

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
     SET owner_id = v_uid, claimed_at = now(), shield_until = now() + make_interval(secs => v_shield),
         ladder_step = ladder_step + 1
   WHERE match_id = p_match_id AND country_id = v_country.country_id
  RETURNING * INTO v_claim;

  INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
  VALUES (p_match_id, 'steal', v_uid, v_country.country_id,
          jsonb_build_object('victim', v_victim, 'points', v_points));

  RETURN jsonb_build_object('ok', true, 'country_id', v_country.country_id, 'owner_id', v_uid,
                            'victim', v_victim, 'points', v_points, 'score', v_score,
                            'shield_until', v_claim.shield_until,
                            'next_level', v_claim.ladder_step + 1);
END;
$$;

-- --------------------------------------------------- renfort -----------
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
  v_prev public.match_fortify_challenges;
  v_step integer;
  v_pick record;
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
  IF v_claim.fortify_level >= public.conquest_rule(v_match.rules, 'fortify_max_level', 2) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'max_fortified', 'country_id', p_country_id,
                              'until', v_claim.shield_until);
  END IF;
  v_step := v_claim.fortify_level + 1;

  SELECT * INTO v_prev FROM public.match_fortify_challenges
   WHERE match_id = p_match_id AND user_id = v_uid FOR UPDATE;
  IF FOUND AND v_prev.country_id = p_country_id AND v_prev.step = v_step
     AND v_prev.ladder_step = v_claim.ladder_step AND v_prev.expires_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'mode', 'fortify', 'country_id', p_country_id,
                              'fortify_step', v_step, 'expires_at', v_prev.expires_at,
                              'bonus_seconds', public.conquest_fortify_bonus(v_match.rules, v_step))
        || public.conquest_ladder_payload(v_prev.kind, v_prev.options, v_prev.question_id, v_prev.ladder_step);
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

  SELECT * INTO v_pick FROM public.conquest_ladder_pick(p_match_id, p_country_id, v_claim.ladder_step);

  v_expires := now() + interval '20 seconds';
  INSERT INTO public.match_fortify_challenges
    (match_id, user_id, country_id, step, kind, options, expires_at, question_id, ladder_step)
  VALUES (p_match_id, v_uid, p_country_id, v_step, v_pick.kind, v_pick.options, v_expires,
          v_pick.question_id, v_claim.ladder_step);
  RETURN jsonb_build_object('ok', true, 'mode', 'fortify', 'country_id', p_country_id,
                            'fortify_step', v_step, 'expires_at', v_expires,
                            'bonus_seconds', public.conquest_fortify_bonus(v_match.rules, v_step))
      || public.conquest_ladder_payload(v_pick.kind, v_pick.options, v_pick.question_id, v_claim.ladder_step);
END;
$$;
REVOKE ALL ON FUNCTION public.conquest_fortify_challenge(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_fortify(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_cancel_fortify(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conquest_rematch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_fortify_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_fortify(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_cancel_fortify(uuid) TO authenticated;

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
  IF NOT FOUND OR v_claim.owner_id <> v_uid OR v_claim.fortify_level + 1 <> v_challenge.step
     OR v_claim.ladder_step <> v_challenge.ladder_step THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'changed', 'country_id', v_challenge.country_id);
  END IF;

  SELECT * INTO v_country FROM public.conquest_countries WHERE country_id = v_challenge.country_id;
  v_correct := public.conquest_ladder_check(v_challenge.kind, v_country.country_id,
                                             v_challenge.question_id, p_answer);

  IF NOT v_correct THEN
    INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
    VALUES (p_match_id, 'fortify_fail', v_uid, v_country.country_id,
            jsonb_build_object('step', v_challenge.step, 'kind', v_challenge.kind));
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong', 'country_id', v_country.country_id);
  END IF;

  v_bonus := public.conquest_fortify_bonus(v_match.rules, v_challenge.step);
  UPDATE public.match_claims
     SET fortify_level = v_challenge.step,
         ladder_step = ladder_step + 1,
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
REVOKE ALL ON FUNCTION public.conquest_fortify(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_cancel_fortify(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conquest_rematch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_fortify_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_fortify(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_cancel_fortify(uuid) TO authenticated;

-- ------------------------------------------------------------- droits -------
REVOKE ALL ON FUNCTION public.conquest_ladder_slot(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_ladder_pick(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_ladder_payload(text, text[], text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_ladder_check(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_steal_challenge(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.steal_country(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_fortify_challenge(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_fortify(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conquest_steal_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.steal_country(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_fortify_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_fortify(uuid, text) TO authenticated;
