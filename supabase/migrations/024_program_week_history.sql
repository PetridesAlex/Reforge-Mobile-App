-- Dated training week archives for coach/admin history.
-- Current week still edits live program_days; past weeks are snapshotted.

alter table public.programs
  add column if not exists plan_week_start date;

comment on column public.programs.plan_week_start is
  'Sunday date of the calendar week that live program_days currently represent.';

create table if not exists public.program_week_snapshots (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  week_start date not null,
  label text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (program_id, week_start)
);

create index if not exists program_week_snapshots_program_idx
  on public.program_week_snapshots (program_id, week_start desc);

create table if not exists public.program_week_day_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_snapshot_id uuid not null references public.program_week_snapshots (id) on delete cascade,
  workout_date date not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  name text not null,
  exercise_count integer not null default 0,
  exercises_json jsonb not null default '[]'::jsonb,
  unique (week_snapshot_id, workout_date)
);

create index if not exists program_week_day_snapshots_date_idx
  on public.program_week_day_snapshots (workout_date);

alter table public.program_week_snapshots enable row level security;
alter table public.program_week_day_snapshots enable row level security;

-- Coaches and admins can read/write studio week history
create policy "week_snapshots_select" on public.program_week_snapshots
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.programs p
      where p.id = program_week_snapshots.program_id
        and (p.coach_id = auth.uid() or public.is_admin())
    )
  );

create policy "week_snapshots_insert" on public.program_week_snapshots
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.programs p
      where p.id = program_week_snapshots.program_id
        and p.coach_id = auth.uid()
    )
  );

create policy "week_snapshots_update" on public.program_week_snapshots
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.programs p
      where p.id = program_week_snapshots.program_id
        and p.coach_id = auth.uid()
    )
  );

create policy "week_day_snapshots_select" on public.program_week_day_snapshots
  for select using (
    public.is_admin()
    or exists (
      select 1
      from public.program_week_snapshots s
      join public.programs p on p.id = s.program_id
      where s.id = program_week_day_snapshots.week_snapshot_id
        and (p.coach_id = auth.uid() or public.is_admin())
    )
  );

create policy "week_day_snapshots_insert" on public.program_week_day_snapshots
  for insert with check (
    public.is_admin()
    or exists (
      select 1
      from public.program_week_snapshots s
      join public.programs p on p.id = s.program_id
      where s.id = program_week_day_snapshots.week_snapshot_id
        and p.coach_id = auth.uid()
    )
  );

create policy "week_day_snapshots_update" on public.program_week_day_snapshots
  for update using (
    public.is_admin()
    or exists (
      select 1
      from public.program_week_snapshots s
      join public.programs p on p.id = s.program_id
      where s.id = program_week_day_snapshots.week_snapshot_id
        and p.coach_id = auth.uid()
    )
  );

comment on table public.program_week_snapshots is
  'Archived calendar weeks for a program (Sunday week_start). Past weeks are read-only history.';
comment on table public.program_week_day_snapshots is
  'Per-day snapshot of a training week including exercise payload JSON.';
