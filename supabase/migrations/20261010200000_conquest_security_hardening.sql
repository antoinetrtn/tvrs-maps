-- Durcissement sécurité du mode Conquête (advisors Supabase du 10/10/2026).

-- 1. search_path figé (lint function_search_path_mutable).
ALTER FUNCTION public.conquest_require_uid() SET search_path = public;

-- 2. conquest_is_player n'est utile qu'aux policies RLS des joueurs connectés.
REVOKE EXECUTE ON FUNCTION public.conquest_is_player(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.conquest_is_player(uuid) TO authenticated;
