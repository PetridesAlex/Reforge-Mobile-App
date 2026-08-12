-- Personal records for strength tracking

create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text,
  record_type text not null check (record_type in ('max_weight', 'reps_at_weight', 'estimated_1rm', 'max_volume')),
  value numeric(10,2) not null,
  weight_kg numeric(6,2),
  reps integer,
  session_id uuid references public.workout_sessions (id) on delete set null,
  set_id uuid references public.workout_sets (id) on delete set null,
  previous_value numeric(10,2),
  achieved_at timestamptz not null default now()
);

create index if not exists personal_records_member_idx
  on public.personal_records (member_id, achieved_at desc);

create index if not exists personal_records_exercise_idx
  on public.personal_records (member_id, exercise_id, record_type);

alter table public.personal_records enable row level security;

create policy "personal_records_select" on public.personal_records
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.coach_clients cc
      where cc.member_id = personal_records.member_id and cc.coach_id = auth.uid()
    )
  );

create policy "personal_records_insert_own" on public.personal_records
  for insert with check (member_id = auth.uid() or public.is_admin());
