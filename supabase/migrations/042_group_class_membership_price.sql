-- Group class monthly subscription is €100

alter table public.member_memberships
  alter column amount_eur set default 100;

alter table public.member_memberships
  alter column plan_label set default 'REFORGE Group';

create or replace function public.ensure_member_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'member' then
    insert into public.member_memberships (member_id, plan_label, status, amount_eur)
    values (new.id, 'REFORGE Group', 'unpaid', 100)
    on conflict (member_id) do nothing;
  end if;
  return new;
end;
$$;

-- Apply the group-class rate to monthly subscriptions (including leftover 180 / 800 amounts)
update public.member_memberships
set
  amount_eur = 100,
  plan_label = case
    when plan_label in ('REFORGE Strength', 'REFORGE Training Plan') then 'REFORGE Group'
    else plan_label
  end,
  updated_at = now()
where plan = 'monthly';
