-- Member subscriptions & payment history (admin billing)

create table if not exists public.member_memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.profiles (id) on delete cascade,
  plan text not null default 'monthly' check (plan in ('monthly', 'quarterly', 'annual', 'drop-in')),
  plan_label text not null default 'REFORGE Strength',
  status text not null default 'unpaid' check (status in ('paid', 'unpaid', 'overdue', 'trial', 'paused')),
  amount_eur numeric(8, 2) not null default 180,
  period_start date not null default current_date,
  period_end date not null default (current_date + interval '1 month')::date,
  last_paid_at date,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  membership_id uuid not null references public.member_memberships (id) on delete cascade,
  amount_eur numeric(8, 2) not null,
  kind text not null default 'payment' check (kind in ('payment', 'invoice', 'refund')),
  status text not null default 'paid' check (status in ('paid', 'pending', 'failed')),
  period_label text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists membership_payments_member_idx
  on public.membership_payments (member_id, created_at desc);

alter table public.member_memberships enable row level security;
alter table public.membership_payments enable row level security;

create policy "memberships_select" on public.member_memberships
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or public.is_coach_of(member_id)
  );

create policy "memberships_admin_manage" on public.member_memberships
  for all using (public.is_admin())
  with check (public.is_admin());

create policy "membership_payments_select" on public.membership_payments
  for select using (
    member_id = auth.uid()
    or public.is_admin()
    or public.is_coach_of(member_id)
  );

create policy "membership_payments_admin_manage" on public.membership_payments
  for all using (public.is_admin())
  with check (public.is_admin());

-- Auto-create membership row when a new member profile is created
create or replace function public.ensure_member_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'member' then
    insert into public.member_memberships (member_id, plan_label, status, amount_eur)
    values (new.id, 'REFORGE Strength', 'unpaid', 180)
    on conflict (member_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_membership on public.profiles;
create trigger profiles_ensure_membership
  after insert on public.profiles
  for each row
  execute function public.ensure_member_membership();

-- Backfill existing members
insert into public.member_memberships (member_id, plan_label, status, amount_eur)
select id, 'REFORGE Strength', 'unpaid', 180
from public.profiles
where role = 'member'
on conflict (member_id) do nothing;
