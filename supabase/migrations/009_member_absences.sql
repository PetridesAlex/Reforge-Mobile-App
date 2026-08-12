-- Members report days they will not attend training

create table if not exists public.member_absences (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  absence_date date not null,
  scope text not null default 'all' check (scope in ('all', 'wod', 'class', 'private')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, absence_date)
);

create index if not exists member_absences_date_idx
  on public.member_absences (absence_date);

create index if not exists member_absences_member_idx
  on public.member_absences (member_id, absence_date);

alter table public.member_absences enable row level security;

create policy "member_absences_select" on public.member_absences
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or public.is_coach_of(member_id)
  );

create policy "member_absences_insert_own" on public.member_absences
  for insert with check (member_id = auth.uid());

create policy "member_absences_update_own" on public.member_absences
  for update using (member_id = auth.uid())
  with check (member_id = auth.uid());

create policy "member_absences_delete_own" on public.member_absences
  for delete using (member_id = auth.uid());
