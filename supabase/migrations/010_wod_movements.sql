-- Structured WOD prescriptions (rounds, sets, reps, weight per movement)
alter table public.workouts_of_the_day
  add column if not exists movements jsonb not null default '[]';

comment on column public.workouts_of_the_day.movements is
  'Structured coach prescription per movement (sets, reps, rounds, weight_kg, etc.)';
