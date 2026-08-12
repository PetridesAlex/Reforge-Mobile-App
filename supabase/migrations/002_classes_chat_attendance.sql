-- Classes, enrollments, attendance, and group chat

alter table public.bookings
  add column if not exists attended boolean;

create table if not exists public.gym_classes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default 'Studio',
  capacity integer not null default 12,
  level text not null default 'All levels',
  created_at timestamptz not null default now()
);

create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.gym_classes (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  attended boolean,
  joined_at timestamptz not null default now(),
  unique (class_id, member_id)
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  primary key (thread_id, member_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'text' check (type in ('text', 'workout', 'progress')),
  body text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.gym_classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;

create policy "classes_select" on public.gym_classes
  for select using (true);

create policy "classes_manage" on public.gym_classes
  for all using (coach_id = auth.uid() or public.is_admin());

create policy "enrollments_select" on public.class_enrollments
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.gym_classes c
      where c.id = class_id and c.coach_id = auth.uid()
    )
  );

create policy "enrollments_manage_own" on public.class_enrollments
  for all using (member_id = auth.uid() or public.is_admin());

create policy "threads_select" on public.chat_threads
  for select using (
    coach_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = id and m.member_id = auth.uid()
    )
  );

create policy "threads_manage_coach" on public.chat_threads
  for all using (coach_id = auth.uid() or public.is_admin());

create policy "thread_members_access" on public.chat_thread_members
  for all using (
    member_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.coach_id = auth.uid()
    )
  );

create policy "messages_access" on public.chat_messages
  for all using (
    sender_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.chat_threads t
      where t.id = thread_id
        and (
          t.coach_id = auth.uid()
          or exists (
            select 1 from public.chat_thread_members m
            where m.thread_id = t.id and m.member_id = auth.uid()
          )
        )
    )
  );
