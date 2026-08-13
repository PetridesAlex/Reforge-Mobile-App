-- Harden chat RLS before promoting Community hub

-- Members may leave a thread themselves; only coach/admin may add others.
-- Remove open self-join of arbitrary threads.
drop policy if exists "thread_members_insert" on public.chat_thread_members;
create policy "thread_members_insert" on public.chat_thread_members
  for insert with check (
    public.is_admin()
    or public.user_is_chat_thread_coach(thread_id, auth.uid())
  );

drop policy if exists "thread_members_delete" on public.chat_thread_members;
create policy "thread_members_delete" on public.chat_thread_members
  for delete using (
    public.is_admin()
    or public.user_is_chat_thread_coach(thread_id, auth.uid())
    or member_id = auth.uid()
  );

-- Split message policies: members can read/insert; only sender or admin/coach can update/delete own
drop policy if exists "messages_access" on public.chat_messages;

drop policy if exists "messages_select" on public.chat_messages;
create policy "messages_select" on public.chat_messages
  for select using (
    public.is_admin()
    or public.user_is_chat_thread_coach(thread_id, auth.uid())
    or public.user_is_chat_thread_member(thread_id, auth.uid())
  );

drop policy if exists "messages_insert" on public.chat_messages;
create policy "messages_insert" on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or public.user_is_chat_thread_coach(thread_id, auth.uid())
      or public.user_is_chat_thread_member(thread_id, auth.uid())
    )
  );

drop policy if exists "messages_update" on public.chat_messages;
create policy "messages_update" on public.chat_messages
  for update using (
    public.is_admin()
    or (
      sender_id = auth.uid()
      and (
        public.user_is_chat_thread_coach(thread_id, auth.uid())
        or public.user_is_chat_thread_member(thread_id, auth.uid())
      )
    )
  );

drop policy if exists "messages_delete" on public.chat_messages;
create policy "messages_delete" on public.chat_messages
  for delete using (
    public.is_admin()
    or public.user_is_chat_thread_coach(thread_id, auth.uid())
    or sender_id = auth.uid()
  );

-- Notify only thread participants (recipient must be a member or the coach)
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

  -- Recipient must belong to the thread (coach or member)
  if not (
    exists (
      select 1 from public.chat_threads t
      where t.id = p_thread_id and t.coach_id = p_user_id
    )
    or exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = p_thread_id and m.member_id = p_user_id
    )
    or public.is_admin()
  ) then
    raise exception 'Recipient is not a participant of this thread';
  end if;

  insert into public.notifications (user_id, title, body, thread_id, type, read)
  values (p_user_id, p_title, p_body, p_thread_id, p_type, false);
end;
$$;

grant execute on function public.push_chat_notification(uuid, text, text, uuid, text) to authenticated;
