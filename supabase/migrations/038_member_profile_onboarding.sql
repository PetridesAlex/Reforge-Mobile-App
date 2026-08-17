-- Member profile onboarding (gated first-run athlete profile).
-- Distinct from app_onboarding_complete (MemberAppGuide tour)
-- and member_fitness_profiles.onboarding_complete (fitness setup).

-- Extend gender check to allow prefer_not_to_say
do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  join pg_namespace n on t.relnamespace = n.oid
  where n.nspname = 'public'
    and t.relname = 'profiles'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%gender%';
  if con_name is not null then
    execute format('alter table public.profiles drop constraint %I', con_name);
  end if;
end $$;

alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_step integer not null default 1,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists date_of_birth date,
  add column if not exists primary_goal text,
  add column if not exists training_level text,
  add column if not exists training_days_per_week integer,
  add column if not exists training_interests text[] default '{}'::text[],
  add column if not exists preferred_workout_time text,
  add column if not exists preferred_workout_duration text,
  add column if not exists motivation_type text;

-- Ensure gender column exists, then re-apply check
alter table public.profiles
  add column if not exists gender text;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say'));

alter table public.profiles
  drop constraint if exists profiles_training_level_check;
alter table public.profiles
  add constraint profiles_training_level_check
  check (
    training_level is null
    or training_level in ('beginner', 'intermediate', 'advanced', 'competitive')
  );

alter table public.profiles
  drop constraint if exists profiles_training_days_check;
alter table public.profiles
  add constraint profiles_training_days_check
  check (
    training_days_per_week is null
    or training_days_per_week between 2 and 6
  );

alter table public.profiles
  drop constraint if exists profiles_onboarding_step_check;
alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step between 1 and 10);

create index if not exists profiles_member_onboarding_idx
  on public.profiles (onboarding_completed)
  where role = 'member';

comment on column public.profiles.onboarding_completed is
  'True after the member finishes the athlete profile onboarding wizard.';
comment on column public.profiles.onboarding_step is
  'Last completed / current step (1-10) for resume.';

-- Backfill: existing engaged members should not be forced through onboarding
update public.profiles p
set
  onboarding_completed = true,
  onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
  onboarding_step = 10
where p.role = 'member'
  and p.onboarding_completed = false
  and (
    p.app_onboarding_complete = true
    or (p.username is not null and length(trim(p.username)) > 0)
    or exists (
      select 1 from public.member_fitness_profiles f where f.member_id = p.id
    )
  );
