-- REFORGE initial schema + RLS
-- Run this in the Supabase SQL Editor after creating your project.

create extension if not exists "pgcrypto";

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  avatar_url text,
  role text not null default 'member' check (role in ('member', 'coach', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (coach_id, member_id)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_weeks integer not null default 8,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  name text not null,
  day_of_week integer check (day_of_week between 0 and 6),
  order_index integer not null default 0
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null,
  equipment text,
  description text,
  instructions text,
  image_url text,
  video_url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  sets integer not null default 3,
  reps text not null default '8',
  rest_seconds integer not null default 90,
  coach_notes text,
  order_index integer not null default 0
);

create table if not exists public.client_programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  start_date date not null default current_date,
  current_week integer not null default 1,
  is_active boolean not null default true
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  program_day_id uuid references public.program_days (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  duration_seconds integer,
  estimated_calories integer,
  notes text
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  set_number integer not null,
  weight_kg numeric(6,2),
  reps integer,
  completed boolean not null default false,
  notes text
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  location text,
  notes text,
  attended boolean,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_blocked boolean not null default false
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  weight_kg numeric(6,2) not null,
  body_fat_pct numeric(5,2),
  measured_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  image_url text not null,
  taken_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'member')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helpers for RLS
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_coach_of(member uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_clients
    where coach_id = auth.uid() and member_id = member
  ) or public.is_admin();
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.coach_clients enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.exercises enable row level security;
alter table public.program_exercises enable row level security;
alter table public.client_programs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.bookings enable row level security;
alter table public.coach_availability enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.coach_notes enable row level security;
alter table public.notifications enable row level security;

-- Profiles policies
create policy "profiles_select_own_or_related" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin()
    or public.is_coach_of(id)
    or exists (
      select 1 from public.coach_clients cc
      where cc.member_id = auth.uid() and cc.coach_id = profiles.id
    )
  );

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- Coach clients
create policy "coach_clients_select" on public.coach_clients
  for select using (
    coach_id = auth.uid() or member_id = auth.uid() or public.is_admin()
  );

create policy "coach_clients_manage" on public.coach_clients
  for all using (
    coach_id = auth.uid() or public.is_admin()
  );

-- Programs
create policy "programs_select" on public.programs
  for select using (
    coach_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.client_programs cp
      where cp.program_id = programs.id and cp.client_id = auth.uid()
    )
  );

create policy "programs_manage_coach" on public.programs
  for all using (coach_id = auth.uid() or public.is_admin());

-- Program days / exercises (via program ownership)
create policy "program_days_access" on public.program_days
  for all using (
    exists (
      select 1 from public.programs p
      where p.id = program_days.program_id
        and (p.coach_id = auth.uid() or public.is_admin()
          or exists (
            select 1 from public.client_programs cp
            where cp.program_id = p.id and cp.client_id = auth.uid()
          ))
    )
  );

create policy "exercises_select" on public.exercises
  for select using (true);

create policy "exercises_manage" on public.exercises
  for all using (
    created_by = auth.uid()
    or public.current_role() in ('coach', 'admin')
  );

create policy "program_exercises_access" on public.program_exercises
  for all using (
    exists (
      select 1
      from public.program_days pd
      join public.programs p on p.id = pd.program_id
      where pd.id = program_exercises.program_day_id
        and (p.coach_id = auth.uid() or public.is_admin()
          or exists (
            select 1 from public.client_programs cp
            where cp.program_id = p.id and cp.client_id = auth.uid()
          ))
    )
  );

-- Client programs
create policy "client_programs_select" on public.client_programs
  for select using (
    client_id = auth.uid()
    or public.is_coach_of(client_id)
    or public.is_admin()
  );

create policy "client_programs_manage" on public.client_programs
  for all using (
    public.is_coach_of(client_id) or public.is_admin()
  );

-- Workout sessions / sets
create policy "workout_sessions_own" on public.workout_sessions
  for all using (
    member_id = auth.uid()
    or public.is_coach_of(member_id)
    or public.is_admin()
  );

create policy "workout_sets_access" on public.workout_sets
  for all using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = workout_sets.session_id
        and (ws.member_id = auth.uid() or public.is_coach_of(ws.member_id) or public.is_admin())
    )
  );

-- Bookings
create policy "bookings_access" on public.bookings
  for all using (
    member_id = auth.uid()
    or coach_id = auth.uid()
    or public.is_admin()
  );

-- Availability
create policy "availability_select" on public.coach_availability
  for select using (true);

create policy "availability_manage" on public.coach_availability
  for all using (coach_id = auth.uid() or public.is_admin());

-- Measurements / photos
create policy "measurements_access" on public.body_measurements
  for all using (
    member_id = auth.uid()
    or public.is_coach_of(member_id)
    or public.is_admin()
  );

create policy "photos_access" on public.progress_photos
  for all using (
    member_id = auth.uid()
    or public.is_coach_of(member_id)
    or public.is_admin()
  );

-- Coach notes (coach-only visibility)
create policy "coach_notes_access" on public.coach_notes
  for all using (
    coach_id = auth.uid() or public.is_admin()
  );

-- Notifications
create policy "notifications_own" on public.notifications
  for all using (user_id = auth.uid() or public.is_admin());
