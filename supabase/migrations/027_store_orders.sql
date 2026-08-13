-- REFORGE Store Phase 3 — addresses, orders, order items, fulfillment

create table if not exists public.store_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  first_name text not null,
  last_name text not null,
  line1 text not null,
  line2 text,
  city text not null,
  postal_code text not null,
  country text not null default 'CY',
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_addresses_user_idx on public.store_addresses (user_id);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'awaiting_payment'
    check (status in (
      'pending',
      'awaiting_payment',
      'paid',
      'processing',
      'ready_for_pickup',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    )),
  fulfillment_method text not null
    check (fulfillment_method in ('delivery', 'pickup')),
  currency text not null default 'EUR',
  subtotal_cents int not null check (subtotal_cents >= 0),
  delivery_cents int not null default 0 check (delivery_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  discount_code text,
  contact_email text not null,
  contact_phone text,
  shipping_first_name text,
  shipping_last_name text,
  shipping_line1 text,
  shipping_line2 text,
  shipping_city text,
  shipping_postal_code text,
  shipping_country text,
  pickup_location text,
  payment_provider text not null default 'none'
    check (payment_provider in ('none', 'mock', 'stripe')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_orders_user_idx on public.store_orders (user_id, created_at desc);
create index if not exists store_orders_status_idx on public.store_orders (status);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders (id) on delete cascade,
  product_id uuid references public.store_products (id) on delete set null,
  variant_id uuid references public.store_product_variants (id) on delete set null,
  product_name text not null,
  sku text,
  size_label text,
  color_label text,
  unit_price_cents int not null check (unit_price_cents >= 0),
  quantity int not null check (quantity > 0),
  line_total_cents int not null check (line_total_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists store_order_items_order_idx on public.store_order_items (order_id);

create table if not exists public.store_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders (id) on delete cascade,
  status text not null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists store_order_events_order_idx
  on public.store_order_events (order_id, created_at);

drop trigger if exists store_addresses_updated on public.store_addresses;
create trigger store_addresses_updated
  before update on public.store_addresses
  for each row execute function public.set_updated_at();

drop trigger if exists store_orders_updated on public.store_orders;
create trigger store_orders_updated
  before update on public.store_orders
  for each row execute function public.set_updated_at();

alter table public.store_addresses enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_order_events enable row level security;

create policy "store_addresses_own" on public.store_addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "store_orders_select" on public.store_orders
  for select using (user_id = auth.uid() or public.is_admin());

create policy "store_orders_admin_update" on public.store_orders
  for update using (public.is_admin()) with check (public.is_admin());

-- Inserts only via security definer RPC
create policy "store_order_items_select" on public.store_order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.store_orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy "store_order_events_select" on public.store_order_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.store_orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy "store_order_events_admin_insert" on public.store_order_events
  for insert with check (public.is_admin());

-- Order number sequence
create sequence if not exists public.store_order_number_seq start 1000;

create or replace function public.next_store_order_number()
returns text
language plpgsql
as $$
begin
  return 'RF-' || lpad(nextval('public.store_order_number_seq')::text, 4, '0');
end;
$$;

-- Validate cart lines against live catalog (returns jsonb array of issues + priced lines)
create or replace function public.validate_store_cart_lines(p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_variant public.store_product_variants;
  v_product public.store_products;
  v_unit int;
  v_issues jsonb := '[]'::jsonb;
  v_priced jsonb := '[]'::jsonb;
  v_qty int;
  v_prev int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := greatest(1, coalesce((v_line->>'quantity')::int, 1));
    select * into v_variant from public.store_product_variants where id = (v_line->>'variant_id')::uuid;
    if not found or v_variant.active is not true then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line->>'variant_id',
        'code', 'unavailable',
        'message', 'This size/color is no longer available.'
      ));
      continue;
    end if;

    select * into v_product from public.store_products where id = v_variant.product_id;
    if not found or v_product.status <> 'active' then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant.id,
        'code', 'product_inactive',
        'message', 'Product is no longer available.'
      ));
      continue;
    end if;

    v_unit := coalesce(v_variant.price_override_cents, v_product.price_cents);
    v_prev := nullif((v_line->>'unit_price_cents')::int, null);
    if v_prev is not null and v_prev <> v_unit then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant.id,
        'code', 'price_changed',
        'message', format('Price changed from €%.2f to €%.2f.', v_prev / 100.0, v_unit / 100.0),
        'previous_cents', v_prev,
        'current_cents', v_unit
      ));
    end if;

    if v_variant.stock_qty < v_qty then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant.id,
        'code', 'stock',
        'message', case
          when v_variant.stock_qty <= 0 then 'Size is no longer available.'
          else format('Only %s left in stock.', v_variant.stock_qty)
        end,
        'available', v_variant.stock_qty
      ));
      v_qty := greatest(0, v_variant.stock_qty);
    end if;

    if v_qty > 0 then
      v_priced := v_priced || jsonb_build_array(jsonb_build_object(
        'product_id', v_product.id,
        'variant_id', v_variant.id,
        'product_name', v_product.name,
        'sku', v_variant.sku,
        'size_label', v_variant.size_label,
        'color_label', v_variant.color_label,
        'unit_price_cents', v_unit,
        'quantity', v_qty,
        'line_total_cents', v_unit * v_qty,
        'image_url', coalesce(v_variant.image_url, (
          select public_url from public.store_product_images i
          where i.product_id = v_product.id
          order by i.is_primary desc, i.sort_order
          limit 1
        ))
      ));
    end if;
  end loop;

  return jsonb_build_object('issues', v_issues, 'lines', v_priced);
end;
$$;

grant execute on function public.validate_store_cart_lines(jsonb) to authenticated;

-- Create order from validated lines (server-priced)
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
  v_variant_id uuid;
  v_qty int;
  v_stock int;
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

  v_discount := greatest(0, coalesce((p_payload->>'discount_cents')::int, 0));
  -- Client-supplied discount_cents is ignored for security — always 0 here.
  -- Migration 028 replaces this function with server-side promo validation.
  v_discount := 0;
  v_code := null;

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
    coalesce(p_payload->>'contact_email', ''),
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

    -- Deduct stock inside this security-definer transaction
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

  insert into public.store_order_events (order_id, status, note, created_by)
  values (v_order.id, 'awaiting_payment', 'Order created', v_user);

  -- Clear cart items
  delete from public.store_cart_items
  where cart_id in (select id from public.store_carts where user_id = v_user);

  return v_order;
end;
$$;

grant execute on function public.create_store_order(jsonb) to authenticated;

-- Admin fulfillment status update
create or replace function public.update_store_order_status(
  p_order_id uuid,
  p_status text,
  p_note text default null
)
returns public.store_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.store_orders;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_status not in (
    'pending','awaiting_payment','paid','processing','ready_for_pickup',
    'shipped','delivered','cancelled','refunded'
  ) then
    raise exception 'Invalid status';
  end if;

  update public.store_orders
  set status = p_status,
      payment_status = case
        when p_status in ('paid','processing','ready_for_pickup','shipped','delivered') and payment_status = 'unpaid'
          then payment_status
        else payment_status
      end
  where id = p_order_id
  returning * into v_order;

  if not found then
    raise exception 'Order not found';
  end if;

  insert into public.store_order_events (order_id, status, note, created_by)
  values (p_order_id, p_status, p_note, auth.uid());

  -- Notify member on key milestones
  if p_status in ('processing', 'ready_for_pickup', 'shipped', 'delivered') then
    insert into public.notifications (user_id, title, body, type, read)
    values (
      v_order.user_id,
      case p_status
        when 'processing' then 'Order processing'
        when 'ready_for_pickup' then 'Ready for pickup'
        when 'shipped' then 'Order shipped'
        when 'delivered' then 'Order delivered'
      end,
      'Order ' || v_order.order_number || ' is now ' || replace(p_status, '_', ' ') || '.',
      case p_status
        when 'processing' then 'store_order_processing'
        when 'ready_for_pickup' then 'store_ready_pickup'
        when 'shipped' then 'store_order_shipped'
        when 'delivered' then 'store_order_delivered'
      end,
      false
    );
  end if;

  return v_order;
end;
$$;

grant execute on function public.update_store_order_status(uuid, text, text) to authenticated;

-- Mark paid — only via service role / edge function (mock or Stripe webhook)
create or replace function public.mark_store_order_paid(
  p_order_id uuid,
  p_provider text,
  p_stripe_payment_intent_id text default null,
  p_stripe_checkout_session_id text default null
)
returns public.store_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.store_orders;
  v_role text;
begin
  -- Callable by service role (auth.uid null with service) or admin for mock recovery
  v_role := coalesce(auth.jwt() ->> 'role', '');
  if v_role <> 'service_role' and not public.is_admin() then
    -- Allow the owning user ONLY for mock provider in development-style flows
    select * into v_order from public.store_orders where id = p_order_id;
    if not found then raise exception 'Order not found'; end if;
    if v_order.user_id <> auth.uid() or p_provider <> 'mock' or v_order.payment_provider <> 'mock' then
      raise exception 'Not allowed';
    end if;
  else
    select * into v_order from public.store_orders where id = p_order_id for update;
    if not found then raise exception 'Order not found'; end if;
  end if;

  if v_order.payment_status = 'paid' then
    return v_order;
  end if;

  update public.store_orders
  set payment_status = 'paid',
      status = case when status = 'awaiting_payment' then 'paid' else status end,
      payment_provider = p_provider,
      stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
      stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
      paid_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.store_order_events (order_id, status, note, created_by)
  values (p_order_id, 'paid', 'Payment confirmed (' || p_provider || ')', auth.uid());

  insert into public.notifications (user_id, title, body, type, read)
  values (
    v_order.user_id,
    'Payment received',
    'Order ' || v_order.order_number || ' is paid and will be prepared.',
    'store_order_paid',
    false
  );

  return v_order;
end;
$$;

grant execute on function public.mark_store_order_paid(uuid, text, text, text) to authenticated;
