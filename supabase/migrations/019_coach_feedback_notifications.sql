-- Coach feedback on workouts + notification preferences

create table if not exists public.workout_feedback (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists workout_feedback_member_idx
  on public.workout_feedback (member_id, created_at desc);

alter table public.workout_feedback enable row level security;

create policy "workout_feedback_select" on public.workout_feedback
  for select using (
    member_id = auth.uid()
    or coach_id = auth.uid()
    or public.is_admin()
  );

create policy "workout_feedback_insert" on public.workout_feedback
  for insert with check (
    coach_id = auth.uid()
    or public.is_admin()
  );

create policy "workout_feedback_update_member" on public.workout_feedback
  for update using (member_id = auth.uid() or coach_id = auth.uid() or public.is_admin());

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  training_reminders boolean not null default true,
  rest_complete boolean not null default true,
  coach_feedback boolean not null default true,
  class_reminders boolean not null default true,
  week_complete boolean not null default true,
  community boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_own" on public.notification_preferences
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

alter table public.notifications
  add column if not exists type text default 'general';

do $$
begin
  begin
    alter publication supabase_realtime add table public.program_days;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.program_exercises;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.client_programs;
  exception when duplicate_object then null;
  end;
end $$;
