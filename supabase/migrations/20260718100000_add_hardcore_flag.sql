-- Hardcore mode: a run played with limited lives (5 mistakes = game over).
-- One shared ranking per mode; hardcore runs carry a badge in the UI.

alter table public.leaderboards
  add column if not exists hardcore boolean not null default false;

-- Whether the player's current best run (max_score) was achieved in hardcore.
alter table public.user_records
  add column if not exists hardcore boolean not null default false;
