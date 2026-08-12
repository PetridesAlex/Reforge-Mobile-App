-- Engagement: readiness, achievements, gym challenges

create table if not exists public.readiness_checkins (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.workout_sessions (id) on delete set null,
  energy integer not null check (energy between 1 and 10),
  sleep_quality integer not null check (sleep_quality between 1 and 10),
  soreness integer not null check (soreness between 1 and 10),
  motivation integer not null check (motivation between 1 and 10),
  score integer not null check (score between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists readiness_checkins_member_idx
  on public.readiness_checkins (member_id, created_at desc);

alter table public.readiness_checkins enable row level security;

create policy "readiness_own" on public.readiness_checkins
  for all using (member_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or public.is_admin());

create policy "readiness_coach_select" on public.readiness_checkins
  for select using (
    exists (
      select 1 from public.coach_clients cc
      where cc.member_id = readiness_checkins.member_id and cc.coach_id = auth.uid()
    )
  );

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  category text not null default 'training',
  threshold integer
);

create table if not exists public.member_achievements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (member_id, achievement_id)
);

alter table public.achievements enable row level security;
alter table public.member_achievements enable row level security;

create policy "achievements_select_all" on public.achievements for select using (true);

create policy "member_achievements_select" on public.member_achievements
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.coach_clients cc
      where cc.member_id = member_achievements.member_id and cc.coach_id = auth.uid()
    )
  );

create policy "member_achievements_insert_own" on public.member_achievements
  for insert with check (member_id = auth.uid() or public.is_admin());

insert into public.achievements (code, title, description, category, threshold) values
  ('first_session', 'FIRST SESSION', 'Complete your first REFORGE workout.', 'training', 1),
  ('sessions_10', '10 SESSIONS', 'Complete 10 workouts.', 'training', 10),
  ('sessions_50', '50 SESSIONS', 'Complete 50 workouts.', 'training', 50),
  ('sessions_100', '100 SESSIONS', 'Complete 100 workouts.', 'training', 100),
  ('program_complete', 'PROGRAM COMPLETE', 'Finish an assigned training program.', 'program', null),
  ('consistency_4w', '4 WEEK CONSISTENCY', 'Stay consistent for 4 weeks.', 'consistency', 4),
  ('consistency_12w', '12 WEEK CONSISTENCY', 'Stay consistent for 12 weeks.', 'consistency', 12),
  ('bench_100', '100KG BENCH CLUB', 'Bench press 100kg.', 'strength', 100),
  ('new_pr', 'NEW PERSONAL RECORD', 'Set a personal record.', 'strength', null),
  ('perfect_week', 'PERFECT WEEK', 'Complete all scheduled workouts in a week.', 'consistency', null)
on conflict (code) do nothing;

create table if not exists public.gym_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  metric text not null check (metric in ('workouts', 'classes', 'adherence')),
  target integer not null default 12,
  starts_on date not null,
  ends_on date not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_enrollments (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.gym_challenges (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  progress integer not null default 0,
  joined_at timestamptz not null default now(),
  unique (challenge_id, member_id)
);

alter table public.gym_challenges enable row level security;
alter table public.challenge_enrollments enable row level security;

create policy "challenges_select" on public.gym_challenges for select using (true);
create policy "challenges_manage" on public.gym_challenges
  for all using (public.is_admin() or created_by = auth.uid());

create policy "challenge_enrollments_select" on public.challenge_enrollments
  for select using (member_id = auth.uid() or public.is_admin());

create policy "challenge_enrollments_insert" on public.challenge_enrollments
  for insert with check (member_id = auth.uid() or public.is_admin());

create policy "challenge_enrollments_update" on public.challenge_enrollments
  for update using (member_id = auth.uid() or public.is_admin());
