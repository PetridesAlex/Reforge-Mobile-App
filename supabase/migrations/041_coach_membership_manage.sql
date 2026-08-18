-- Allow coaches to manage billing for assigned clients + payment reminder RPC

create policy "memberships_coach_update" on public.member_memberships
  for update
  using (public.is_coach_of(member_id))
  with check (public.is_coach_of(member_id));

create policy "membership_payments_coach_insert" on public.membership_payments
  for insert
  with check (public.is_coach_of(member_id));

create or replace function public.send_membership_payment_reminder(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.member_memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_admin() or public.is_coach_of(p_member_id)) then
    raise exception 'Not authorized to send membership reminders';
  end if;

  select * into v_membership
  from public.member_memberships
  where member_id = p_member_id;

  if not found then
    raise exception 'Membership not found';
  end if;

  if v_membership.status = 'paid' then
    raise exception 'Membership is already paid';
  end if;

  insert into public.notifications (user_id, title, body, type, read)
  values (
    p_member_id,
    'Subscription payment due',
    format(
      'Your %s subscription (€%s) needs payment. Please contact the studio to renew your membership.',
      v_membership.plan_label,
      trim(to_char(v_membership.amount_eur, '999990.99'))
    ),
    'membership_invoice',
    false
  );
end;
$$;

grant execute on function public.send_membership_payment_reminder(uuid) to authenticated;
