-- Break infinite recursion on profiles UPDATE.
-- Root cause (004_role_guard): WITH CHECK subselected profiles under RLS:
--   role = (select p.role from public.profiles p where p.id = auth.uid())
-- That re-enters profiles policies → "infinite recursion detected".

-- 1) Helpers: force bypass RLS (plpgsql SET LOCAL is the most reliable form)
create or replace function public.current_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  perform set_config('row_security', 'off', true);
  select role::text into v_role from public.profiles where id = auth.uid();
  return v_role;
end;
$$;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  perform set_config('row_security', 'off', true);
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) into v_ok;
  return coalesce(v_ok, false);
end;
$$;

create or replace function public.is_coach_of(member uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  perform set_config('row_security', 'off', true);
  select exists (
    select 1 from public.coach_clients
    where coach_id = auth.uid() and member_id = member
  ) into v_ok;
  return coalesce(v_ok, false) or public.is_admin();
end;
$$;

-- 2) Update policy: no subquery on profiles
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Role changes remain blocked by profiles_guard_role trigger (004).
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);
  if new.role is distinct from old.role then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only admins can change user roles';
    end if;
  end if;
  return new;
end;
$$;

-- 3) Safe username claim RPC (avoids fragile client UPDATE path)
create or replace function public.claim_community_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text;
  v_uid uuid := auth.uid();
begin
  perform set_config('row_security', 'off', true);

  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_clean := lower(trim(both from coalesce(p_username, '')));
  v_clean := regexp_replace(v_clean, '^@', '');
  v_clean := regexp_replace(v_clean, '[^a-z0-9_]', '', 'g');
  v_clean := left(v_clean, 24);

  if char_length(v_clean) < 3 then
    raise exception 'Subject must be 3–24 letters, numbers, or underscores';
  end if;

  if v_clean in ('admin', 'reforge', 'support', 'system', 'coach', 'official', 'moderator', 'staff') then
    raise exception 'That subject is reserved';
  end if;

  update public.profiles
  set username = v_clean
  where id = v_uid;

  return v_clean;
end;
$$;

grant execute on function public.claim_community_username(text) to authenticated;

-- 4) Author snapshot triggers: keep RLS off
create or replace function public.community_posts_fill_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_username text;
  v_avatar text;
  v_role text;
begin
  perform set_config('row_security', 'off', true);
  select full_name, username, avatar_url, role::text
    into v_name, v_username, v_avatar, v_role
  from public.profiles
  where id = new.author_id;

  new.author_name := coalesce(nullif(v_name, ''), 'REFORGE Athlete');
  new.author_username := v_username;
  new.author_avatar_url := v_avatar;
  new.author_role := coalesce(v_role, 'member');
  return new;
end;
$$;

create or replace function public.community_comments_fill_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_username text;
  v_avatar text;
  v_role text;
begin
  perform set_config('row_security', 'off', true);
  select full_name, username, avatar_url, role::text
    into v_name, v_username, v_avatar, v_role
  from public.profiles
  where id = new.author_id;

  new.author_name := coalesce(nullif(v_name, ''), 'REFORGE Athlete');
  new.author_username := v_username;
  new.author_avatar_url := v_avatar;
  new.author_role := coalesce(v_role, 'member');
  return new;
end;
$$;
