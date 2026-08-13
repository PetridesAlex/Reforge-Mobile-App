-- REFORGE Store Phase 2 — carts & favorites

create table if not exists public.store_carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.store_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.store_carts (id) on delete cascade,
  product_id uuid not null references public.store_products (id) on delete cascade,
  variant_id uuid not null references public.store_product_variants (id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create index if not exists store_cart_items_cart_idx on public.store_cart_items (cart_id);

create table if not exists public.store_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.store_products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists store_favorites_user_idx on public.store_favorites (user_id, created_at desc);

drop trigger if exists store_carts_updated on public.store_carts;
create trigger store_carts_updated
  before update on public.store_carts
  for each row execute function public.set_updated_at();

drop trigger if exists store_cart_items_updated on public.store_cart_items;
create trigger store_cart_items_updated
  before update on public.store_cart_items
  for each row execute function public.set_updated_at();

alter table public.store_carts enable row level security;
alter table public.store_cart_items enable row level security;
alter table public.store_favorites enable row level security;

create policy "store_carts_own" on public.store_carts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "store_cart_items_own" on public.store_cart_items
  for all using (
    exists (
      select 1 from public.store_carts c
      where c.id = cart_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.store_carts c
      where c.id = cart_id and c.user_id = auth.uid()
    )
  );

create policy "store_favorites_own" on public.store_favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ensure cart row helper
create or replace function public.ensure_store_cart(p_user_id uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Not allowed';
  end if;
  insert into public.store_carts (user_id)
  values (p_user_id)
  on conflict (user_id) do update set updated_at = now()
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.store_carts where user_id = p_user_id;
  end if;
  return v_id;
end;
$$;

grant execute on function public.ensure_store_cart(uuid) to authenticated;
