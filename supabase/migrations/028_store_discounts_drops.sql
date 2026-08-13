-- REFORGE Store Phase 4 — discounts, drop fields, notification prefs, analytics-ready

create table if not exists public.store_discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent', 'fixed', 'free_delivery')),
  value_bps int check (value_bps is null or (value_bps >= 0 and value_bps <= 10000)),
  value_cents int check (value_cents is null or value_cents >= 0),
  min_subtotal_cents int not null default 0,
  max_redemptions int,
  redemption_count int not null default 0,
  member_only boolean not null default false,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.store_discounts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.store_orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists store_discount_redemptions_user_idx
  on public.store_discount_redemptions (user_id, created_at desc);

alter table public.store_discounts enable row level security;
alter table public.store_discount_redemptions enable row level security;

-- Members can read active public codes metadata only via RPC; no direct select of all codes
create policy "store_discounts_admin" on public.store_discounts
  for all using (public.is_admin()) with check (public.is_admin());

create policy "store_discount_redemptions_own_select" on public.store_discount_redemptions
  for select using (user_id = auth.uid() or public.is_admin());

create policy "store_discount_redemptions_admin" on public.store_discount_redemptions
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists store_discounts_updated on public.store_discounts;
create trigger store_discounts_updated
  before update on public.store_discounts
  for each row execute function public.set_updated_at();

-- Collection drop helpers already have release_at; ensure products support drop scheduling
alter table public.store_products
  add column if not exists drop_label text;

-- Notification preference columns for store (additive)
alter table public.notification_preferences
  add column if not exists store_orders boolean not null default true,
  add column if not exists store_drops boolean not null default true,
  add column if not exists store_back_in_stock boolean not null default false;

-- Replace create_store_order with discount-aware version
create or replace function public.create_store_order(p_payload jsonb)
returns public.store_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_validated jsonb;
  v_lines jsonb;
  v_line jsonb;
  v_subtotal int := 0;
  v_delivery int := 0;
  v_discount int := 0;
  v_total int;
  v_method text;
  v_order public.store_orders;
  v_settings jsonb;
  v_code text;
  v_discount_row public.store_discounts;
  v_variant_id uuid;
  v_qty int;
  v_stock int;
  v_membership_ok boolean := false;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  v_method := coalesce(p_payload->>'fulfillment_method', 'pickup');
  if v_method not in ('delivery', 'pickup') then
    raise exception 'Invalid fulfillment method';
  end if;

  v_validated := public.validate_store_cart_lines(coalesce(p_payload->'lines', '[]'::jsonb));
  if jsonb_array_length(v_validated->'issues') > 0 then
    raise exception 'CART_INVALID:%', v_validated::text;
  end if;

  v_lines := v_validated->'lines';
  if jsonb_array_length(v_lines) = 0 then
    raise exception 'Cart is empty';
  end if;

  for v_line in select * from jsonb_array_elements(v_lines)
  loop
    v_subtotal := v_subtotal + (v_line->>'line_total_cents')::int;
  end loop;

  select value into v_settings from public.store_settings where key = 'fulfillment';
  if v_method = 'delivery' then
    v_delivery := coalesce((v_settings->>'standard_delivery_cents')::int, 500);
  else
    v_delivery := 0;
  end if;

  v_code := nullif(trim(coalesce(p_payload->>'discount_code', '')), '');
  if v_code is not null then
    select * into v_discount_row
    from public.store_discounts
    where upper(code) = upper(v_code)
      and active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    limit 1;

    if not found then
      raise exception 'Invalid discount code';
    end if;

    if v_discount_row.max_redemptions is not null
       and v_discount_row.redemption_count >= v_discount_row.max_redemptions then
      raise exception 'Discount code fully redeemed';
    end if;

    if v_subtotal < v_discount_row.min_subtotal_cents then
      raise exception 'Order does not meet discount minimum';
    end if;

    if v_discount_row.member_only then
      select exists (
        select 1 from public.member_memberships m
        where m.member_id = v_user and m.status in ('paid', 'trial')
      ) into v_membership_ok;
      if not v_membership_ok then
        raise exception 'Discount requires an active membership';
      end if;
    end if;

    if v_discount_row.kind = 'percent' then
      v_discount := least(v_subtotal, (v_subtotal * coalesce(v_discount_row.value_bps, 0)) / 10000);
    elsif v_discount_row.kind = 'fixed' then
      v_discount := least(v_subtotal, coalesce(v_discount_row.value_cents, 0));
    elsif v_discount_row.kind = 'free_delivery' then
      v_delivery := 0;
      v_discount := 0;
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_delivery - v_discount);

  if coalesce(p_payload->>'contact_email', '') = '' then
    raise exception 'Contact email is required';
  end if;

  if v_method = 'delivery' and (
    coalesce(p_payload->>'shipping_line1', '') = ''
    or coalesce(p_payload->>'shipping_city', '') = ''
    or coalesce(p_payload->>'shipping_postal_code', '') = ''
  ) then
    raise exception 'Delivery address is required';
  end if;

  insert into public.store_orders (
    order_number, user_id, status, fulfillment_method, currency,
    subtotal_cents, delivery_cents, discount_cents, total_cents, discount_code,
    contact_email, contact_phone,
    shipping_first_name, shipping_last_name, shipping_line1, shipping_line2,
    shipping_city, shipping_postal_code, shipping_country,
    pickup_location, payment_provider, payment_status
  ) values (
    public.next_store_order_number(),
    v_user,
    'awaiting_payment',
    v_method,
    coalesce(v_settings->>'currency', 'EUR'),
    v_subtotal,
    v_delivery,
    v_discount,
    v_total,
    v_code,
    p_payload->>'contact_email',
    p_payload->>'contact_phone',
    p_payload->>'shipping_first_name',
    p_payload->>'shipping_last_name',
    p_payload->>'shipping_line1',
    p_payload->>'shipping_line2',
    p_payload->>'shipping_city',
    p_payload->>'shipping_postal_code',
    coalesce(p_payload->>'shipping_country', 'CY'),
    case when v_method = 'pickup' then coalesce(v_settings->>'pickup_location', 'REFORGE Limassol') else null end,
    coalesce(p_payload->>'payment_provider', 'mock'),
    'unpaid'
  ) returning * into v_order;

  for v_line in select * from jsonb_array_elements(v_lines)
  loop
    insert into public.store_order_items (
      order_id, product_id, variant_id, product_name, sku, size_label, color_label,
      unit_price_cents, quantity, line_total_cents
    ) values (
      v_order.id,
      (v_line->>'product_id')::uuid,
      (v_line->>'variant_id')::uuid,
      v_line->>'product_name',
      v_line->>'sku',
      v_line->>'size_label',
      v_line->>'color_label',
      (v_line->>'unit_price_cents')::int,
      (v_line->>'quantity')::int,
      (v_line->>'line_total_cents')::int
    );

    v_variant_id := (v_line->>'variant_id')::uuid;
    v_qty := (v_line->>'quantity')::int;
    select stock_qty into v_stock from public.store_product_variants where id = v_variant_id for update;
    if v_stock is null or v_stock < v_qty then
      raise exception 'Insufficient stock while placing order';
    end if;
    update public.store_product_variants set stock_qty = stock_qty - v_qty where id = v_variant_id;
    insert into public.store_inventory_movements (variant_id, delta, reason, note, order_id, created_by)
    values (v_variant_id, -v_qty, 'order', 'Order ' || v_order.order_number, v_order.id, v_user);
  end loop;

  if v_discount_row.id is not null then
    update public.store_discounts
    set redemption_count = redemption_count + 1
    where id = v_discount_row.id;
    insert into public.store_discount_redemptions (discount_id, user_id, order_id)
    values (v_discount_row.id, v_user, v_order.id);
  end if;

  insert into public.store_order_events (order_id, status, note, created_by)
  values (v_order.id, 'awaiting_payment', 'Order created', v_user);

  delete from public.store_cart_items
  where cart_id in (select id from public.store_carts where user_id = v_user);

  return v_order;
end;
$$;

-- Preview discount without trusting client math
create or replace function public.preview_store_discount(
  p_code text,
  p_subtotal_cents int,
  p_delivery_cents int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.store_discounts;
  v_discount int := 0;
  v_delivery int := greatest(0, p_delivery_cents);
  v_membership_ok boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.store_discounts
  where upper(code) = upper(trim(p_code))
    and active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Invalid discount code');
  end if;

  if v_row.member_only then
    select exists (
      select 1 from public.member_memberships m
      where m.member_id = auth.uid() and m.status in ('paid', 'trial')
    ) into v_membership_ok;
    if not v_membership_ok then
      return jsonb_build_object('ok', false, 'message', 'Requires active membership');
    end if;
  end if;

  if p_subtotal_cents < v_row.min_subtotal_cents then
    return jsonb_build_object('ok', false, 'message', 'Minimum spend not met');
  end if;

  if v_row.kind = 'percent' then
    v_discount := least(p_subtotal_cents, (p_subtotal_cents * coalesce(v_row.value_bps, 0)) / 10000);
  elsif v_row.kind = 'fixed' then
    v_discount := least(p_subtotal_cents, coalesce(v_row.value_cents, 0));
  elsif v_row.kind = 'free_delivery' then
    v_delivery := 0;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_row.code,
    'kind', v_row.kind,
    'discount_cents', v_discount,
    'delivery_cents', v_delivery
  );
end;
$$;

grant execute on function public.preview_store_discount(text, int, int) to authenticated;

insert into public.store_discounts (code, kind, value_bps, member_only, active)
values ('REFORGE10', 'percent', 1000, true, true)
on conflict (code) do nothing;
