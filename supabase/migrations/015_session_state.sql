-- Live workout session state + richer set logging (RPE / RIR / completed_at)

alter table public.workout_sessions
  add column if not exists session_state jsonb not null default '{}'::jsonb;

alter table public.workout_sets
  add column if not exists rpe numeric(3,1) check (rpe is null or (rpe >= 1 and rpe <= 10));

alter table public.workout_sets
  add column if not exists rir numeric(3,1) check (rir is null or (rir >= 0 and rir <= 10));

alter table public.workout_sets
  add column if not exists completed_at timestamptz;

comment on column public.workout_sessions.session_state is
  'Client session UI state: activeExerciseIndex, restEndsAt, etc.';

comment on column public.workout_sets.rpe is 'Rate of Perceived Exertion 1-10';
comment on column public.workout_sets.rir is 'Reps In Reserve 0-10';
