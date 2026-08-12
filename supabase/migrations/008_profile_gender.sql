-- Optional member gender for roster & coaching context

alter table public.profiles
  add column if not exists gender text check (gender in ('male', 'female', 'other'));
