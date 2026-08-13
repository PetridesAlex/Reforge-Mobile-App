-- REFORGE Store — Phase 1 catalog (products, variants, inventory, images, CMS settings)

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Collections / drops
-- ---------------------------------------------------------------------------
create table if not exists public.store_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  release_at timestamptz,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Size guides (reusable)
-- ---------------------------------------------------------------------------
create table if not exists public.store_size_guides (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_size_guide_rows (
  id uuid primary key default gen_random_uuid(),
  size_guide_id uuid not null references public.store_size_guides (id) on delete cascade,
  size_label text not null,
  chest_cm numeric(6, 1),
  length_cm numeric(6, 1),
  waist_cm numeric(6, 1),
  hip_cm numeric(6, 1),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists store_size_guide_rows_guide_idx
  on public.store_size_guide_rows (size_guide_id, sort_order);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subtitle text,
  description text,
  category_id uuid references public.store_categories (id) on delete set null,
  collection_id uuid references public.store_collections (id) on delete set null,
  size_guide_id uuid references public.store_size_guides (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  price_cents int not null check (price_cents >= 0),
  compare_at_cents int check (compare_at_cents is null or compare_at_cents >= 0),
  currency text not null default 'EUR',
  featured boolean not null default false,
  is_new boolean not null default false,
  is_limited boolean not null default false,
  details text,
  materials text,
  care_instructions text,
  release_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_products_status_idx on public.store_products (status);
create index if not exists store_products_category_idx on public.store_products (category_id);
create index if not exists store_products_featured_idx on public.store_products (featured)
  where featured = true and status = 'active';

-- ---------------------------------------------------------------------------
-- Product images
-- ---------------------------------------------------------------------------
create table if not exists public.store_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  alt_text text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists store_product_images_product_idx
  on public.store_product_images (product_id, sort_order);

-- ---------------------------------------------------------------------------
-- Variants (inventory lives here)
-- ---------------------------------------------------------------------------
create table if not exists public.store_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products (id) on delete cascade,
  sku text not null unique,
  size_label text,
  color_label text,
  color_hex text,
  stock_qty int not null default 0 check (stock_qty >= 0),
  price_override_cents int check (price_override_cents is null or price_override_cents >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size_label, color_label)
);

create index if not exists store_product_variants_product_idx
  on public.store_product_variants (product_id);
create index if not exists store_product_variants_stock_idx
  on public.store_product_variants (stock_qty)
  where active = true;

-- ---------------------------------------------------------------------------
-- Inventory audit
-- ---------------------------------------------------------------------------
create table if not exists public.store_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.store_product_variants (id) on delete cascade,
  delta int not null,
  reason text not null
    check (reason in ('restock', 'adjustment', 'order', 'return', 'correction')),
  note text,
  order_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists store_inventory_movements_variant_idx
  on public.store_inventory_movements (variant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- CMS / store settings (key-value)
-- ---------------------------------------------------------------------------
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists store_categories_updated on public.store_categories;
create trigger store_categories_updated
  before update on public.store_categories
  for each row execute function public.set_updated_at();

drop trigger if exists store_collections_updated on public.store_collections;
create trigger store_collections_updated
  before update on public.store_collections
  for each row execute function public.set_updated_at();

drop trigger if exists store_size_guides_updated on public.store_size_guides;
create trigger store_size_guides_updated
  before update on public.store_size_guides
  for each row execute function public.set_updated_at();

drop trigger if exists store_products_updated on public.store_products;
create trigger store_products_updated
  before update on public.store_products
  for each row execute function public.set_updated_at();

drop trigger if exists store_product_variants_updated on public.store_product_variants;
create trigger store_product_variants_updated
  before update on public.store_product_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Atomic stock adjustment (admin)
-- ---------------------------------------------------------------------------
create or replace function public.adjust_store_variant_stock(
  p_variant_id uuid,
  p_delta integer,
  p_reason text,
  p_note text default null
)
returns public.store_product_variants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.store_product_variants;
  v_new int;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  if p_reason not in ('restock', 'adjustment', 'order', 'return', 'correction') then
    raise exception 'Invalid reason';
  end if;

  select * into v_row
  from public.store_product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'Variant not found';
  end if;

  v_new := v_row.stock_qty + p_delta;
  if v_new < 0 then
    raise exception 'Insufficient stock';
  end if;

  update public.store_product_variants
  set stock_qty = v_new
  where id = p_variant_id
  returning * into v_row;

  insert into public.store_inventory_movements (variant_id, delta, reason, note, created_by)
  values (p_variant_id, p_delta, p_reason, p_note, auth.uid());

  return v_row;
end;
$$;

grant execute on function public.adjust_store_variant_stock(uuid, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.store_categories enable row level security;
alter table public.store_collections enable row level security;
alter table public.store_size_guides enable row level security;
alter table public.store_size_guide_rows enable row level security;
alter table public.store_products enable row level security;
alter table public.store_product_images enable row level security;
alter table public.store_product_variants enable row level security;
alter table public.store_inventory_movements enable row level security;
alter table public.store_settings enable row level security;

-- Categories: public read active; admin manage
create policy "store_categories_select" on public.store_categories
  for select using (active = true or public.is_admin());
create policy "store_categories_admin" on public.store_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- Collections
create policy "store_collections_select" on public.store_collections
  for select using (active = true or public.is_admin());
create policy "store_collections_admin" on public.store_collections
  for all using (public.is_admin()) with check (public.is_admin());

-- Size guides
create policy "store_size_guides_select" on public.store_size_guides
  for select using (published = true or public.is_admin());
create policy "store_size_guides_admin" on public.store_size_guides
  for all using (public.is_admin()) with check (public.is_admin());

create policy "store_size_guide_rows_select" on public.store_size_guide_rows
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.store_size_guides g
      where g.id = size_guide_id and g.published = true
    )
  );
create policy "store_size_guide_rows_admin" on public.store_size_guide_rows
  for all using (public.is_admin()) with check (public.is_admin());

-- Products: members see active (and released); admin sees all
create policy "store_products_select" on public.store_products
  for select using (
    public.is_admin()
    or (
      status = 'active'
      and (release_at is null or release_at <= now())
    )
  );
create policy "store_products_admin" on public.store_products
  for all using (public.is_admin()) with check (public.is_admin());

-- Images follow product visibility
create policy "store_product_images_select" on public.store_product_images
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.store_products p
      where p.id = product_id
        and p.status = 'active'
        and (p.release_at is null or p.release_at <= now())
    )
  );
create policy "store_product_images_admin" on public.store_product_images
  for all using (public.is_admin()) with check (public.is_admin());

-- Variants: active variants of visible products
create policy "store_product_variants_select" on public.store_product_variants
  for select using (
    public.is_admin()
    or (
      active = true
      and exists (
        select 1 from public.store_products p
        where p.id = product_id
          and p.status = 'active'
          and (p.release_at is null or p.release_at <= now())
      )
    )
  );
create policy "store_product_variants_admin" on public.store_product_variants
  for all using (public.is_admin()) with check (public.is_admin());

-- Inventory movements: admin only
create policy "store_inventory_movements_admin" on public.store_inventory_movements
  for all using (public.is_admin()) with check (public.is_admin());

-- Settings: authenticated read; admin write
create policy "store_settings_select" on public.store_settings
  for select using (auth.uid() is not null);
create policy "store_settings_admin" on public.store_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-products',
  'store-products',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "store_products_public_read" on storage.objects;
create policy "store_products_public_read"
  on storage.objects for select
  using (bucket_id = 'store-products');

drop policy if exists "store_products_admin_insert" on storage.objects;
create policy "store_products_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'store-products' and public.is_admin());

drop policy if exists "store_products_admin_update" on storage.objects;
create policy "store_products_admin_update"
  on storage.objects for update
  using (bucket_id = 'store-products' and public.is_admin())
  with check (bucket_id = 'store-products' and public.is_admin());

drop policy if exists "store_products_admin_delete" on storage.objects;
create policy "store_products_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'store-products' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed defaults
-- ---------------------------------------------------------------------------
insert into public.store_categories (slug, name, sort_order) values
  ('t-shirts', 'T-Shirts', 10),
  ('hoodies', 'Hoodies', 20),
  ('socks', 'Socks', 30),
  ('headwear', 'Headwear', 40)
on conflict (slug) do nothing;

insert into public.store_collections (slug, name, description, featured, active) values
  ('essentials', 'REFORGE Essentials', 'Forged under load. Cut for the work. No soft layers.', true, true)
on conflict (slug) do nothing;

insert into public.store_settings (key, value) values
  (
    'home_hero',
    jsonb_build_object(
      'kicker', 'REFORGE',
      'title', 'STORE',
      'headline', 'REFORGE ESSENTIALS',
      'subtitle', 'Forged under load. Cut for the work. No soft layers.',
      'cta', 'SHOP COLLECTION'
    )
  ),
  (
    'fulfillment',
    jsonb_build_object(
      'pickup_label', 'PICK UP FROM REFORGE',
      'pickup_location', 'REFORGE Limassol',
      'standard_delivery_cents', 500,
      'currency', 'EUR'
    )
  ),
  (
    'inventory',
    jsonb_build_object(
      'low_stock_threshold', 5,
      'show_exact_stock', false
    )
  )
on conflict (key) do nothing;
