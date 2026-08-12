-- Soft-remove members from the studio roster without deleting auth accounts.
-- Admins can deactivate / reactivate; inactive members are hidden from active lists.

alter table public.profiles
  add column if not exists roster_active boolean not null default true;

create index if not exists profiles_roster_active_idx
  on public.profiles (roster_active)
  where role = 'member';

comment on column public.profiles.roster_active is
  'When false, member is removed from the active studio roster (soft deactivate).';
