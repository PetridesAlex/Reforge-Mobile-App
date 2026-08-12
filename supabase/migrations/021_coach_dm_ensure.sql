-- Allow athletes to open a coach DM even when coach_clients is missing,
-- and create the thread server-side (members cannot insert chat_threads under RLS).

create or replace function public.resolve_studio_coach_id(p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid;
begin
  -- 1) Explicit coach ↔ member assignment
  select coach_id into v_coach
  from public.coach_clients
  where member_id = p_member_id
  order by assigned_at desc nulls last
  limit 1;

  if v_coach is not null then
    return v_coach;
  end if;

  -- 2) Coach who owns the member's active program
  select p.coach_id into v_coach
  from public.client_programs cp
  join public.programs p on p.id = cp.program_id
  where cp.client_id = p_member_id
    and cp.is_active = true
  order by cp.start_date desc
  limit 1;

  if v_coach is not null then
    return v_coach;
  end if;

  -- 3) Single-studio fallback: first coach, else first admin
  select id into v_coach
  from public.profiles
  where role = 'coach'
  order by created_at asc
  limit 1;

  if v_coach is not null then
    return v_coach;
  end if;

  select id into v_coach
  from public.profiles
  where role = 'admin'
  order by created_at asc
  limit 1;

  return v_coach;
end;
$$;

create or replace function public.get_or_create_coach_dm(p_member_id uuid default auth.uid())
returns public.chat_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_member uuid := coalesce(p_member_id, auth.uid());
  v_coach uuid;
  v_thread public.chat_threads;
  v_coach_name text;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  -- Members may only open their own coach DM; coaches/admins can open for any athlete.
  if v_caller <> v_member
     and not public.is_admin()
     and not exists (
       select 1 from public.profiles p
       where p.id = v_caller and p.role in ('coach', 'admin')
     ) then
    raise exception 'Not allowed';
  end if;

  v_coach := public.resolve_studio_coach_id(v_member);
  if v_coach is null then
    raise exception 'No coach available in this studio';
  end if;

  -- Ensure coach_clients link exists so profile + RLS stay consistent
  insert into public.coach_clients (coach_id, member_id)
  values (v_coach, v_member)
  on conflict (coach_id, member_id) do nothing;

  -- Prefer existing DM between this coach and member
  select t.* into v_thread
  from public.chat_threads t
  join public.chat_thread_members m on m.thread_id = t.id and m.member_id = v_member
  where t.kind = 'coach_dm'
    and t.coach_id = v_coach
  order by t.created_at desc
  limit 1;

  if v_thread.id is not null then
    return v_thread;
  end if;

  select full_name into v_coach_name from public.profiles where id = v_coach;

  insert into public.chat_threads (name, coach_id, description, kind)
  values (
    coalesce(v_coach_name, 'Your coach'),
    v_coach,
    'Direct line to your coach — training, nutrition, scheduling',
    'coach_dm'
  )
  returning * into v_thread;

  insert into public.chat_thread_members (thread_id, member_id)
  values (v_thread.id, v_member)
  on conflict (thread_id, member_id) do nothing;

  -- Optional: also add coach as thread member for inbox symmetry
  insert into public.chat_thread_members (thread_id, member_id)
  values (v_thread.id, v_coach)
  on conflict (thread_id, member_id) do nothing;

  insert into public.chat_messages (thread_id, sender_id, type, body)
  values (
    v_thread.id,
    v_coach,
    'text',
    'Hey! Message me anytime about training, nutrition, or scheduling.'
  );

  return v_thread;
end;
$$;

grant execute on function public.resolve_studio_coach_id(uuid) to authenticated;
grant execute on function public.get_or_create_coach_dm(uuid) to authenticated;

-- Let members read their assigned coach (and studio coaches for picker fallback).
-- Use current_role() (security definer) — a subquery on profiles here causes
-- infinite RLS recursion and 500s on every profile select (breaks sign-in).
drop policy if exists "profiles_select_coaches_for_members" on public.profiles;
create policy "profiles_select_coaches_for_members" on public.profiles
  for select using (
    role in ('coach', 'admin')
    and (
      id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.coach_clients cc
        where cc.member_id = auth.uid() and cc.coach_id = profiles.id
      )
      or public.current_role() = 'member'
    )
  );
