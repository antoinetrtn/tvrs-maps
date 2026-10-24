-- =============================================================================
-- Mode « Conquête » — phase 1 : 1v1 privé (MVP)
--
-- NE PAS APPLIQUER sans confirmation explicite d'Antoine (voir
-- docs/conquest-multiplayer.md). Le client garde le mode masqué tant que
-- VITE_ENABLE_CONQUEST n'est pas à "true".
--
-- Principes :
--   * le client ne fait jamais autorité : toutes les écritures passent par des
--     fonctions SECURITY DEFINER appelées en RPC ;
--   * identité = auth.uid() (connexion e-mail/Google ou connexion anonyme
--     Supabase pour les invités) ;
--   * RLS : lecture réservée aux joueurs du match, aucune écriture directe ;
--   * timer côté serveur (ends_at), premier commit gagnant (verrou de ligne).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- Normalisation des réponses (même règle que normalizeString côté client :
-- sans accents, minuscules, tirets/apostrophes -> espace, espaces compactés).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conquest_normalize(input text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(lower(extensions.unaccent(coalesce(input, ''))), '[-''’]', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Référentiel des pays et alias acceptés (alimenté par la migration de seed).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conquest_countries (
    country_id text PRIMARY KEY,
    name_en text NOT NULL,
    name_fr text NOT NULL,
    region text
);

CREATE TABLE IF NOT EXISTS public.conquest_country_aliases (
    alias_norm text NOT NULL,
    country_id text NOT NULL REFERENCES public.conquest_countries (country_id) ON DELETE CASCADE,
    CONSTRAINT conquest_country_aliases_pkey PRIMARY KEY (alias_norm, country_id)
);

ALTER TABLE public.conquest_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conquest_country_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture publique conquest_countries"
    ON public.conquest_countries FOR SELECT TO anon, authenticated USING (true);
-- Les alias ne sont pas lisibles par les clients (validation serveur uniquement).

-- -----------------------------------------------------------------------------
-- Tables de match
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    host_id uuid NOT NULL,
    region text NOT NULL DEFAULT 'world',
    rules jsonb NOT NULL DEFAULT '{}'::jsonb,
    max_players integer NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 8),
    duration_seconds integer NOT NULL DEFAULT 600 CHECK (duration_seconds BETWEEN 60 AND 3600),
    status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'live', 'finished')),
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    ends_at timestamptz,
    finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.match_players (
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 30),
    color text NOT NULL,
    pattern text NOT NULL DEFAULT 'solid',
    score integer NOT NULL DEFAULT 0,
    ready boolean NOT NULL DEFAULT false,
    joined_at timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT match_players_pkey PRIMARY KEY (match_id, user_id),
    CONSTRAINT match_players_color_unique UNIQUE (match_id, color)
);

CREATE TABLE IF NOT EXISTS public.match_claims (
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    country_id text NOT NULL REFERENCES public.conquest_countries (country_id),
    owner_id uuid NOT NULL,
    claimed_at timestamptz NOT NULL DEFAULT now(),
    shield_until timestamptz,
    CONSTRAINT match_claims_pkey PRIMARY KEY (match_id, country_id)
);

CREATE TABLE IF NOT EXISTS public.match_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('join', 'ready', 'start', 'capture', 'fail', 'finish')),
    actor_id uuid,
    country_id text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_events_match_idx ON public.match_events (match_id, id);
CREATE INDEX IF NOT EXISTS match_players_user_idx ON public.match_players (user_id);

-- -----------------------------------------------------------------------------
-- RLS : lecture par les joueurs du match uniquement, pas d'écriture directe.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conquest_is_player(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_players
    WHERE match_id = p_match_id AND user_id = auth.uid()
  );
$$;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Joueurs lisent leur match" ON public.matches
    FOR SELECT TO authenticated USING (public.conquest_is_player(id));
CREATE POLICY "Joueurs lisent les joueurs" ON public.match_players
    FOR SELECT TO authenticated USING (public.conquest_is_player(match_id));
CREATE POLICY "Joueurs lisent les captures" ON public.match_claims
    FOR SELECT TO authenticated USING (public.conquest_is_player(match_id));
CREATE POLICY "Joueurs lisent les événements" ON public.match_events
    FOR SELECT TO authenticated USING (public.conquest_is_player(match_id));
-- Aucune policy INSERT/UPDATE/DELETE : écritures via les fonctions ci-dessous.

-- -----------------------------------------------------------------------------
-- Helpers internes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conquest_require_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  RETURN auth.uid();
END;
$$;

-- Clôture idempotente d'un match dont le timer serveur est écoulé.
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
     SET status = 'finished', finished_at = now()
   WHERE id = p_match_id AND status = 'live' AND ends_at <= now()
  RETURNING status INTO v_status;
  IF FOUND THEN
    INSERT INTO public.match_events (match_id, kind) VALUES (p_match_id, 'finish');
  END IF;
  SELECT status INTO v_status FROM public.matches WHERE id = p_match_id;
  RETURN v_status;
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC : créer / rejoindre / prêt / démarrer / capturer / état
-- -----------------------------------------------------------------------------
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
  FOR attempt IN 1..10 LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.matches (code, host_id, duration_seconds)
      VALUES (v_code, v_uid, p_duration_seconds)
      RETURNING * INTO v_match;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 10 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO public.match_players (match_id, user_id, display_name, color, pattern)
  VALUES (v_match.id, v_uid, left(btrim(p_display_name), 30), p_color, coalesce(p_pattern, 'solid'));
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
  v_color text := p_color;
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

  IF EXISTS (SELECT 1 FROM public.match_players WHERE match_id = v_match.id AND color = v_color) THEN
    v_color := coalesce(p_fallback_color, v_color || '-2');
  END IF;

  INSERT INTO public.match_players (match_id, user_id, display_name, color, pattern)
  VALUES (v_match.id, v_uid, left(btrim(p_display_name), 30), v_color, coalesce(p_pattern, 'dots'));
  INSERT INTO public.match_events (match_id, kind, actor_id) VALUES (v_match.id, 'join', v_uid);
  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.conquest_set_ready(p_match_id uuid, p_ready boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
BEGIN
  UPDATE public.match_players
     SET ready = p_ready, last_seen = now()
   WHERE match_id = p_match_id AND user_id = v_uid
     AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = p_match_id AND m.status = 'lobby');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_in_lobby' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.match_events (match_id, kind, actor_id, payload)
  VALUES (p_match_id, 'ready', v_uid, jsonb_build_object('ready', p_ready));
END;
$$;

CREATE OR REPLACE FUNCTION public.conquest_start_match(p_match_id uuid)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.conquest_require_uid();
  v_match public.matches;
  v_players integer;
  v_ready integer;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.host_id <> v_uid THEN
    RAISE EXCEPTION 'not_host' USING ERRCODE = '42501';
  END IF;
  IF v_match.status <> 'lobby' THEN
    RETURN v_match;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE ready)
    INTO v_players, v_ready
    FROM public.match_players WHERE match_id = p_match_id;
  IF v_players < 2 OR v_ready < v_players THEN
    RAISE EXCEPTION 'players_not_ready' USING ERRCODE = 'P0001';
  END IF;

  -- 3 s de compte à rebours inclus : la partie commence à started_at.
  UPDATE public.matches
     SET status = 'live',
         started_at = now() + interval '3 seconds',
         ends_at = now() + interval '3 seconds' + make_interval(secs => duration_seconds)
   WHERE id = p_match_id
  RETURNING * INTO v_match;
  INSERT INTO public.match_events (match_id, kind, actor_id) VALUES (p_match_id, 'start', v_uid);
  RETURN v_match;
END;
$$;

-- Capture d'un pays libre. Premier commit gagnant : la ligne (match, pays) est
-- verrouillée (SELECT … FOR UPDATE) puis insérée sous la contrainte de clé
-- primaire ; une réponse concurrente reçoit « already_owned ».
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

  IF v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty');
  END IF;

  SELECT country_id INTO v_country
    FROM public.conquest_country_aliases
   WHERE alias_norm = v_norm
   ORDER BY country_id
   LIMIT 1;

  IF v_country IS NULL THEN
    INSERT INTO public.match_events (match_id, kind, actor_id, payload)
    VALUES (p_match_id, 'fail', v_uid, jsonb_build_object('reason', 'unknown'));
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown');
  END IF;

  SELECT * INTO v_existing
    FROM public.match_claims
   WHERE match_id = p_match_id AND country_id = v_country
   FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', CASE WHEN v_existing.owner_id = v_uid THEN 'already_yours' ELSE 'already_owned' END,
      'country_id', v_country,
      'owner_id', v_existing.owner_id
    );
  END IF;

  INSERT INTO public.match_claims (match_id, country_id, owner_id, shield_until)
  VALUES (p_match_id, v_country, v_uid, now() + interval '30 seconds')
  ON CONFLICT (match_id, country_id) DO NOTHING
  RETURNING * INTO v_claim;

  IF v_claim.country_id IS NULL THEN
    -- Perdu la course contre un commit concurrent.
    SELECT * INTO v_existing FROM public.match_claims
     WHERE match_id = p_match_id AND country_id = v_country;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_owned',
                              'country_id', v_country, 'owner_id', v_existing.owner_id);
  END IF;

  UPDATE public.match_players
     SET score = score + v_points, last_seen = now()
   WHERE match_id = p_match_id AND user_id = v_uid
  RETURNING score INTO v_score;

  INSERT INTO public.match_events (match_id, kind, actor_id, country_id, payload)
  VALUES (p_match_id, 'capture', v_uid, v_country, jsonb_build_object('points', v_points));

  RETURN jsonb_build_object('ok', true, 'country_id', v_country, 'owner_id', v_uid,
                            'points', v_points, 'score', v_score,
                            'shield_until', v_claim.shield_until);
END;
$$;

-- État complet (resynchronisation) : clôture le match si le timer est écoulé.
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
    'events', coalesce((SELECT jsonb_agg(e ORDER BY e.id) FROM (
                          SELECT * FROM public.match_events
                           WHERE match_id = p_match_id ORDER BY id DESC LIMIT 50) e), '[]'::jsonb)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution : uniquement les RPC publiques, pour les utilisateurs
-- authentifiés (y compris connexion anonyme).
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.conquest_close_if_expired(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_require_uid() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_create_match(text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_join_match(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_set_ready(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_start_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_country(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conquest_get_state(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.conquest_require_uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_create_match(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_join_match(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_set_ready(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_start_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_country(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conquest_get_state(uuid) TO authenticated;
