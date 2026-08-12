-- Coach-defined progression targets on program exercises

alter table public.program_exercises
  add column if not exists target_weight_kg numeric(6,2);

alter table public.program_exercises
  add column if not exists progression_increment_kg numeric(5,2);

alter table public.program_exercises
  add column if not exists rep_range_min integer;

alter table public.program_exercises
  add column if not exists rep_range_max integer;
