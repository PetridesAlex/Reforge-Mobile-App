-- Member engagement: daily mood on profiles (bio already exists as community_bio)

alter table public.profiles
  add column if not exists community_mood text,
  add column if not exists community_mood_updated_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_community_mood_check;

alter table public.profiles
  add constraint profiles_community_mood_check
  check (
    community_mood is null
    or community_mood in ('fired', 'proud', 'quiet', 'sore', 'grateful', 'playful')
  );

-- CREATE OR REPLACE cannot insert/rename view columns — drop then recreate.
drop view if exists public.community_profiles;

create view public.community_profiles as
select
  p.id,
  p.full_name,
  p.username,
  p.avatar_url,
  p.role,
  p.community_bio,
  p.community_mood,
  p.community_mood_updated_at,
  p.community_visible,
  p.roster_active,
  p.created_at
from public.profiles p
where coalesce(p.roster_active, true) = true
  and p.community_visible = true;

-- Recreate function with new return columns (drop first to avoid OUT-param mismatch)
drop function if exists public.get_community_profile(uuid);

create function public.get_community_profile(p_user_id uuid)
returns table (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  role text,
  community_bio text,
  community_mood text,
  community_mood_updated_at timestamptz,
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
    p.community_mood,
    p.community_mood_updated_at,
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

grant execute on function public.get_community_profile(uuid) to authenticated;
grant execute on function public.get_community_profile(uuid) to anon;
grant select on public.community_profiles to authenticated;
grant select on public.community_profiles to anon;
