-- Chat kinds, read cursors, and notification links for coach ↔ member sync

alter table public.chat_threads
  add column if not exists kind text not null default 'group'
    check (kind in ('class', 'coach_dm', 'private', 'group'));

alter table public.chat_threads
  add column if not exists class_id uuid references public.gym_classes (id) on delete set null;

create index if not exists chat_threads_kind_idx on public.chat_threads (kind);
create index if not exists chat_threads_class_idx on public.chat_threads (class_id);

alter table public.notifications
  add column if not exists thread_id uuid references public.chat_threads (id) on delete cascade;

create index if not exists notifications_thread_idx on public.notifications (thread_id);

create table if not exists public.chat_read_cursors (
  user_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

alter table public.chat_read_cursors enable row level security;

create policy "chat_read_cursors_own" on public.chat_read_cursors
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Coaches/admins may add members to threads they manage
drop policy if exists "thread_members_access" on public.chat_thread_members;
create policy "thread_members_select" on public.chat_thread_members
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.coach_id = auth.uid()
    )
  );

create policy "thread_members_insert" on public.chat_thread_members
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.coach_id = auth.uid()
    )
    or member_id = auth.uid()
  );

create policy "thread_members_delete" on public.chat_thread_members
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.coach_id = auth.uid()
    )
  );

-- Secure notification helper (coaches notify athletes on invite/message)
create or replace function public.push_chat_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_thread_id uuid,
  p_type text default 'chat_message'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
begin
  if v_sender is null then
    return;
  end if;

  if not (
    public.is_admin()
    or exists (
      select 1 from public.chat_threads t
      where t.id = p_thread_id
        and (
          t.coach_id = v_sender
          or exists (
            select 1 from public.chat_thread_members m
            where m.thread_id = t.id and m.member_id = v_sender
          )
        )
    )
  ) then
    raise exception 'Not allowed to notify for this thread';
  end if;

  insert into public.notifications (user_id, title, body, thread_id, type, read)
  values (p_user_id, p_title, p_body, p_thread_id, p_type, false);
end;
$$;

grant execute on function public.push_chat_notification(uuid, text, text, uuid, text) to authenticated;

-- Realtime: messages & threads sync between coach and member apps
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_threads;
alter publication supabase_realtime add table public.notifications;
