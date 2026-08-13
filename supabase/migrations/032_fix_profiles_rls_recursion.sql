-- Fix infinite RLS recursion on public.profiles during community post create
-- (claim username / author snapshot triggers / is_admin in policies).
-- SECURITY DEFINER helpers must bypass RLS when they read profiles.

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_coach_of(member uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.coach_clients
    where coach_id = auth.uid() and member_id = member
  ) or public.is_admin();
$$;

create or replace function public.community_posts_fill_author()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_name text;
  v_username text;
  v_avatar text;
  v_role text;
begin
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
set row_security = off
as $$
declare
  v_name text;
  v_username text;
  v_avatar text;
  v_role text;
begin
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

create or replace function public.get_community_profile(p_user_id uuid)
returns table (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  role text,
  community_bio text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.role::text,
    p.community_bio,
    p.created_at
  from public.profiles p
  where p.id = p_user_id
    and coalesce(p.roster_active, true) = true
    and (
      p.community_visible = true
      or p.id = auth.uid()
      or public.is_admin()
    );
$$;

-- Notify helpers also read profiles — keep them RLS-safe
create or replace function public.community_notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_author uuid;
  v_name text;
begin
  select author_id into v_author from public.community_posts where id = new.post_id and deleted_at is null;
  if v_author is null then
    return new;
  end if;
  select coalesce(nullif(full_name, ''), 'Someone') into v_name from public.profiles where id = new.user_id;
  perform public.push_community_notification(
    v_author,
    'New like',
    v_name || ' liked your post.',
    'community_like',
    new.user_id
  );
  return new;
end;
$$;

create or replace function public.community_notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_author uuid;
  v_name text;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  select author_id into v_author from public.community_posts where id = new.post_id and deleted_at is null;
  if v_author is null then
    return new;
  end if;
  select coalesce(nullif(full_name, ''), 'Someone') into v_name from public.profiles where id = new.author_id;
  perform public.push_community_notification(
    v_author,
    'New comment',
    v_name || ' commented on your post.',
    'community_comment',
    new.author_id
  );
  return new;
end;
$$;
