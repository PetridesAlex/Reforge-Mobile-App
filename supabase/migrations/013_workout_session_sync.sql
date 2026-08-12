-- Workout logging: support WOD/custom exercises without FK, link sessions to WOD

alter table public.workout_sets
  alter column exercise_id drop not null;

alter table public.workout_sets
  add column if not exists exercise_name text;

alter table public.workout_sessions
  add column if not exists wod_id uuid references public.workouts_of_the_day (id) on delete set null;

create index if not exists workout_sessions_member_status_idx
  on public.workout_sessions (member_id, status, finished_at desc);

alter publication supabase_realtime add table public.workout_sessions;
alter publication supabase_realtime add table public.workout_sets;
