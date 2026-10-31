-- =============================================================================
-- Mode « Conquête » : classement Elo
-- Règles :
--   * 1v1 uniquement, joueurs distincts, comptes inscrits uniquement
--     (auth.users.is_anonymous = false). Un invité anonyme rend le match
--     non classé pour les deux : identité jetable → farming trivial.
--   * Notation une seule fois par match (matches.rated_at), dans la clôture
--     serveur (timer écoulé ou forfait).
--   * Forfait pendant le compte à rebours (avant started_at) : non classé.
--     Forfait en cours de partie : défaite du joueur qui abandonne.
--   * K = 32, puis 16 au-delà de 30 parties classées. Égalité = 0,5.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conquest_ratings (
    user_id uuid PRIMARY KEY,
    display_name text NOT NULL DEFAULT '',
    elo integer NOT NULL DEFAULT 1000,
    games integer NOT NULL DEFAULT 0,
    wins integer NOT NULL DEFAULT 0,
    losses integer NOT NULL DEFAULT 0,
    draws integer NOT NULL DEFAULT 0,
    steals integer NOT NULL DEFAULT 0,
    countries_captured integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conquest_ratings_rank_idx ON public.conquest_ratings (elo DESC, games DESC);
ALTER TABLE public.conquest_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture publique conquest_ratings" ON public.conquest_ratings;
CREATE POLICY "Lecture publique conquest_ratings" ON public.conquest_ratings
    FOR SELECT TO anon, authenticated USING (true);
-- Aucune policy d'écriture : seules les fonctions serveur notent.

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS rated_at timestamptz;

-- Score attendu et nouvel Elo (fonctions pures, testées en SQL).
CREATE OR REPLACE FUNCTION public.conquest_elo_delta(
  p_elo integer, p_opponent integer, p_score numeric, p_games integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT round(CASE WHEN p_games >= 30 THEN 16 ELSE 32 END
               * (p_score - 1 / (1 + power(10, (p_opponent - p_elo) / 400.0))))::integer;
$$;

-- Applique l'Elo d'un match clos. Idempotent (rated_at). Renvoie le détail
-- { user_id: { before, after, delta } } ou NULL si le match n'est pas classé.
CREATE OR REPLACE FUNCTION public.conquest_apply_ratings(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
  v_a public.match_players;
  v_b public.match_players;
  v_ra public.conquest_ratings;
  v_rb public.conquest_ratings;
  v_score_a numeric;
  v_da integer;
  v_db integer;
  v_winner uuid;
  v_ca integer;
  v_cb integer;
  v_elo jsonb;
BEGIN
  UPDATE public.matches SET rated_at = now()
   WHERE id = p_match_id AND status = 'finished' AND rated_at IS NULL
  RETURNING * INTO v_match;
  IF NOT FOUND THEN
    RETURN NULL; -- déjà noté ou pas fini
  END IF;

  IF (SELECT count(*) FROM public.match_players WHERE match_id = p_match_id) <> 2
     OR v_match.result IS NULL
     OR (v_match.result ->> 'forfeit_by' IS NOT NULL
         AND (v_match.started_at IS NULL OR v_match.finished_at < v_match.started_at)) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_a FROM public.match_players WHERE match_id = p_match_id ORDER BY joined_at, user_id LIMIT 1;
  SELECT * INTO v_b FROM public.match_players WHERE match_id = p_match_id ORDER BY joined_at, user_id OFFSET 1 LIMIT 1;
  IF v_a.user_id = v_b.user_id
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_a.user_id AND NOT coalesce(is_anonymous, false))
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_b.user_id AND NOT coalesce(is_anonymous, false)) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.conquest_ratings (user_id) VALUES (v_a.user_id), (v_b.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  -- Verrou dans un ordre stable : deux clôtures simultanées ne s'interbloquent pas.
  PERFORM 1 FROM public.conquest_ratings WHERE user_id IN (v_a.user_id, v_b.user_id)
   ORDER BY user_id FOR UPDATE;
  SELECT * INTO v_ra FROM public.conquest_ratings WHERE user_id = v_a.user_id;
  SELECT * INTO v_rb FROM public.conquest_ratings WHERE user_id = v_b.user_id;

  v_winner := (v_match.result ->> 'winner')::uuid;
  v_score_a := CASE WHEN v_winner IS NULL THEN 0.5 WHEN v_winner = v_a.user_id THEN 1 ELSE 0 END;
  v_da := public.conquest_elo_delta(v_ra.elo, v_rb.elo, v_score_a, v_ra.games);
  v_db := public.conquest_elo_delta(v_rb.elo, v_ra.elo, 1 - v_score_a, v_rb.games);
  SELECT count(*) FILTER (WHERE owner_id = v_a.user_id), count(*) FILTER (WHERE owner_id = v_b.user_id)
    INTO v_ca, v_cb FROM public.match_claims WHERE match_id = p_match_id;

  UPDATE public.conquest_ratings r
     SET elo = r.elo + CASE WHEN r.user_id = v_a.user_id THEN v_da ELSE v_db END,
         games = r.games + 1,
         wins = r.wins + (v_winner IS NOT DISTINCT FROM r.user_id)::int,
         losses = r.losses + (v_winner IS NOT NULL AND v_winner <> r.user_id)::int,
         draws = r.draws + (v_winner IS NULL)::int,
         steals = r.steals + CASE WHEN r.user_id = v_a.user_id THEN v_a.steals ELSE v_b.steals END,
         countries_captured = r.countries_captured
                              + CASE WHEN r.user_id = v_a.user_id THEN v_ca ELSE v_cb END,
         display_name = CASE WHEN r.user_id = v_a.user_id THEN v_a.display_name ELSE v_b.display_name END,
         updated_at = now()
   WHERE r.user_id IN (v_a.user_id, v_b.user_id);

  v_elo := jsonb_build_object(
    v_a.user_id::text, jsonb_build_object('before', v_ra.elo, 'after', v_ra.elo + v_da, 'delta', v_da),
    v_b.user_id::text, jsonb_build_object('before', v_rb.elo, 'after', v_rb.elo + v_db, 'delta', v_db));
  UPDATE public.matches SET result = result || jsonb_build_object('elo', v_elo) WHERE id = p_match_id;
  RETURN v_elo;
END;
$$;

-- Clôture (timer) : résultat puis Elo, dans la même transaction.
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
    PERFORM public.conquest_apply_ratings(p_match_id);
  END IF;
  SELECT status INTO v_status FROM public.matches WHERE id = p_match_id;
  RETURN v_status;
END;
$$;

-- Forfait : même chemin de notation.
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

  UPDATE public.matches
     SET status = 'finished', finished_at = now(), ends_at = least(ends_at, now()),
         result = public.conquest_compute_result(p_match_id, v_uid)
   WHERE id = p_match_id;
  INSERT INTO public.match_events (match_id, kind, actor_id) VALUES (p_match_id, 'forfeit', v_uid);
  PERFORM public.conquest_apply_ratings(p_match_id);
  RETURN jsonb_build_object('ok', true, 'status', 'forfeit');
END;
$$;

-- Classement : top N + rang du joueur courant (s'il est classé).
CREATE OR REPLACE FUNCTION public.conquest_leaderboard(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT r.user_id, r.display_name, r.elo, r.games, r.wins, r.losses, r.draws, r.steals,
           r.countries_captured,
           rank() OVER (ORDER BY r.elo DESC, r.games DESC) AS rank
      FROM public.conquest_ratings r WHERE r.games > 0
  )
  SELECT jsonb_build_object(
    'top', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.rank, t.user_id) FROM (
              SELECT * FROM ranked ORDER BY rank, user_id
               LIMIT least(greatest(coalesce(p_limit, 50), 1), 100)) t), '[]'::jsonb),
    'me', (SELECT to_jsonb(m) FROM ranked m WHERE m.user_id = auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.conquest_elo_delta(integer, integer, numeric, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_apply_ratings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conquest_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conquest_leaderboard(integer) TO anon, authenticated;
