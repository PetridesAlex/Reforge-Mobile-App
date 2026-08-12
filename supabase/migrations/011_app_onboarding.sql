-- Track whether a member has completed the in-app welcome guide (separate from fitness onboarding).

alter table public.profiles
  add column if not exists app_onboarding_complete boolean not null default false;

create index if not exists profiles_app_onboarding_idx
  on public.profiles (app_onboarding_complete)
  where role = 'member';

comment on column public.profiles.app_onboarding_complete is
  'True after the member finishes the first-run REFORGE app guide.';
