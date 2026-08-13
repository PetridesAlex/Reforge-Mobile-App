-- Merchandising flags for admin-controlled badges on product cards.
alter table public.store_products
  add column if not exists is_bestseller boolean not null default false,
  add column if not exists is_best_of_month boolean not null default false;

create index if not exists store_products_bestseller_idx
  on public.store_products (is_bestseller)
  where is_bestseller = true and status = 'active';

create index if not exists store_products_best_month_idx
  on public.store_products (is_best_of_month)
  where is_best_of_month = true and status = 'active';
