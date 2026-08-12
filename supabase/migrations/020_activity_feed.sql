-- Opt-in gym activity feed

create table if not exists public.activity_feed_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('pr', 'milestone', 'program_complete')),
  title text not null,
  body text not null,
  visibility text not null default 'private' check (visibility in ('gym', 'private')),
  created_at timestamptz not null default now()
);

create index if not exists activity_feed_created_idx
  on public.activity_feed_events (created_at desc)
  where visibility = 'gym';

create table if not exists public.activity_reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.activity_feed_events (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '💪', '👊')),
  created_at timestamptz not null default now(),
  unique (event_id, member_id, emoji)
);

alter table public.activity_feed_events enable row level security;
alter table public.activity_reactions enable row level security;

create policy "activity_feed_select" on public.activity_feed_events
  for select using (
    visibility = 'gym'
    or member_id = auth.uid()
    or public.is_admin()
  );

create policy "activity_feed_insert_own" on public.activity_feed_events
  for insert with check (member_id = auth.uid() or public.is_admin());

create policy "activity_reactions_select" on public.activity_reactions
  for select using (true);

create policy "activity_reactions_insert" on public.activity_reactions
  for insert with check (member_id = auth.uid());

create policy "activity_reactions_delete" on public.activity_reactions
  for delete using (member_id = auth.uid());

alter table public.profiles
  add column if not exists share_activity boolean not null default false;
