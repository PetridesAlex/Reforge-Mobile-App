-- Member fitness profile + progress tracking (onboarding, goals, computed stats source)

create table if not exists public.member_fitness_profiles (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  height_cm numeric(5, 1),
  birth_year integer check (birth_year is null or birth_year between 1940 and 2015),
  goal_weight_kg numeric(6, 2),
  weekly_session_goal integer not null default 4 check (weekly_session_goal between 1 and 14),
  onboarding_complete boolean not null default false,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_fitness_profiles_onboarding_idx
  on public.member_fitness_profiles (onboarding_complete);

alter table public.member_fitness_profiles enable row level security;

create policy "fitness_profile_select" on public.member_fitness_profiles
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or public.is_coach_of(member_id)
  );

create policy "fitness_profile_insert_own" on public.member_fitness_profiles
  for insert with check (member_id = auth.uid());

create policy "fitness_profile_update_own" on public.member_fitness_profiles
  for update using (member_id = auth.uid())
  with check (member_id = auth.uid());
