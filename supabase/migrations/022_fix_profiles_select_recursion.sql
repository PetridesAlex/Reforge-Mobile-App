-- Fix infinite RLS recursion on public.profiles introduced by
-- profiles_select_coaches_for_members (migration 021).
-- A policy subquery on public.profiles re-enters RLS and breaks ALL
-- profile selects (including "select own"), which makes sign-in fail
-- after a successful password grant.

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
      -- security definer helper — must NOT query profiles under RLS
      or public.current_role() = 'member'
    )
  );
