-- Studio content shared between admin and members (news, WOD, notifications)

create table if not exists public.studio_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  audience text not null default 'all' check (audience in ('all', 'class_530', 'class_630', 'private')),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.workouts_of_the_day (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  focus text not null default 'Studio session',
  description text not null default '',
  duration_min integer not null default 45,
  level text not null default 'All levels',
  location text not null default 'Studio Floor',
  start_time text not null default '18:00',
  moves text[] not null default '{}',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists workouts_of_the_day_date_active_idx
  on public.workouts_of_the_day (date, active);

create table if not exists public.wod_rsvps (
  id uuid primary key default gen_random_uuid(),
  wod_id uuid not null references public.workouts_of_the_day (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('joined', 'skipped')),
  updated_at timestamptz not null default now(),
  unique (wod_id, member_id)
);

-- Optional class group for targeted news (530 / 630 afternoon groups)
alter table public.profiles
  add column if not exists class_group text check (class_group in ('530', '630'));

alter table public.notifications
  add column if not exists news_id uuid references public.studio_news (id) on delete cascade,
  add column if not exists type text not null default 'general';

alter table public.studio_news enable row level security;
alter table public.workouts_of_the_day enable row level security;
alter table public.wod_rsvps enable row level security;

-- Everyone signed in can read published studio content
create policy "studio_news_select" on public.studio_news
  for select using (published = true or public.current_role() in ('coach', 'admin'));

create policy "studio_news_manage" on public.studio_news
  for all using (public.current_role() in ('coach', 'admin'));

create policy "wod_select" on public.workouts_of_the_day
  for select using (true);

create policy "wod_manage" on public.workouts_of_the_day
  for all using (public.current_role() in ('coach', 'admin'));

create policy "wod_rsvps_select" on public.wod_rsvps
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'coach'
  );

create policy "wod_rsvps_manage_own" on public.wod_rsvps
  for all using (member_id = auth.uid() or public.is_admin());

-- Realtime: admin publish → member home updates live
alter publication supabase_realtime add table public.studio_news;
alter publication supabase_realtime add table public.workouts_of_the_day;
alter publication supabase_realtime add table public.gym_classes;
