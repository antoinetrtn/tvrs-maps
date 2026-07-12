-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    username character varying(30) NOT NULL,
    avatar_id character varying(50) NOT NULL DEFAULT 'invader_1'::character varying,
    avatar_color character varying(30) NOT NULL DEFAULT 'cyan'::character varying,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    xp integer NOT NULL DEFAULT 0,
    level integer NOT NULL DEFAULT 1,
    unlocked_badges text[] NOT NULL DEFAULT '{}'::text[],
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_username_key UNIQUE (username)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Lecture publique profiles" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "Insertion publique profiles" ON public.profiles FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Mise à jour publique profiles" ON public.profiles FOR UPDATE TO public USING (true);

-- Create user_records table
CREATE TABLE IF NOT EXISTS public.user_records (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL,
    game_mode character varying(50) NOT NULL,
    max_score integer NOT NULL DEFAULT 0,
    best_time_seconds integer,
    games_played integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT user_records_pkey PRIMARY KEY (id),
    CONSTRAINT user_records_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT unique_profile_mode UNIQUE (profile_id, game_mode)
);

-- Enable RLS on user_records
ALTER TABLE public.user_records ENABLE ROW LEVEL SECURITY;

-- Create policies for user_records
CREATE POLICY "Lecture publique records" ON public.user_records FOR SELECT TO public USING (true);
CREATE POLICY "Insertion publique records" ON public.user_records FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Mise à jour publique records" ON public.user_records FOR UPDATE TO public USING (true);

-- Create leaderboards table
CREATE TABLE IF NOT EXISTS public.leaderboards (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL,
    game_mode character varying(50) NOT NULL,
    score integer NOT NULL,
    time_spent_seconds integer NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT leaderboards_pkey PRIMARY KEY (id),
    CONSTRAINT leaderboards_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles (id) ON DELETE CASCADE
);

-- Enable RLS on leaderboards
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;

-- Create policies for leaderboards
CREATE POLICY "Lecture publique leaderboards" ON public.leaderboards FOR SELECT TO public USING (true);
CREATE POLICY "Insertion publique leaderboards" ON public.leaderboards FOR INSERT TO public WITH CHECK (true);
