-- Fix Security Advisor: community_profiles must not run as SECURITY DEFINER.
-- App uses get_community_profile() RPC for peer-safe reads; this view should
-- respect the caller's privileges + profiles RLS (security_invoker).

drop view if exists public.community_profiles;

create view public.community_profiles
with (security_invoker = on)
as
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

-- Authenticated clients only — anon should not browse member projections
revoke all on public.community_profiles from anon, public;
grant select on public.community_profiles to authenticated;
