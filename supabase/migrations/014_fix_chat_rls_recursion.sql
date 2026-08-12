-- Fix: infinite recursion detected in policy for relation "chat_threads"
--
-- threads_select checked chat_thread_members, whose policy checked chat_threads again.
-- Use security definer helpers so policies never cross-query through RLS.

create or replace function public.user_is_chat_thread_member(
  p_thread_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_thread_members
    where thread_id = p_thread_id
      and member_id = p_user_id
  );
$$;

create or replace function public.user_is_chat_thread_coach(
  p_thread_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_threads
    where id = p_thread_id
      and coach_id = p_user_id
  );
$$;

grant execute on function public.user_is_chat_thread_member(uuid, uuid) to authenticated;
grant execute on function public.user_is_chat_thread_coach(uuid, uuid) to authenticated;

drop policy if exists "threads_select" on public.chat_threads;
create policy "threads_select" on public.chat_threads
  for select using (
    coach_id = auth.uid()
    or public.is_admin()
    or public.user_is_chat_thread_member(id, auth.uid())
  );

drop policy if exists "thread_members_select" on public.chat_thread_members;
create policy "thread_members_select" on public.chat_thread_members
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or public.user_is_chat_thread_coach(thread_id, auth.uid())
  );

drop policy if exists "thread_members_insert" on public.chat_thread_members;
create policy "thread_members_insert" on public.chat_thread_members
  for insert with check (
    public.is_admin()
    or public.user_is_chat_thread_coach(thread_id, auth.uid())
    or member_id = auth.uid()
  );

drop policy if exists "thread_members_delete" on public.chat_thread_members;
create policy "thread_members_delete" on public.chat_thread_members
  for delete using (
    public.is_admin()
    or public.user_is_chat_thread_coach(thread_id, auth.uid())
  );

drop policy if exists "messages_access" on public.chat_messages;
create policy "messages_access" on public.chat_messages
  for all using (
    sender_id = auth.uid()
    or public.is_admin()
    or public.user_is_chat_thread_coach(thread_id, auth.uid())
    or public.user_is_chat_thread_member(thread_id, auth.uid())
  );
