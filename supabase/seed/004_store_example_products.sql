-- Optional: seed 12 example Essentials products (3 per category) for demos.
-- Safe to re-run: skips existing slugs.
-- Requires 025_store_catalog.sql first.

insert into public.store_collections (slug, name, description, featured, active)
values ('essentials', 'REFORGE Essentials', 'Forged under load. Cut for the work. No soft layers.', true, true)
on conflict (slug) do nothing;

with cats as (
  select slug, id from public.store_categories
),
col as (
  select id from public.store_collections where slug = 'essentials' limit 1
),
seed(slug, name, subtitle, description, category_slug, price_cents, compare_at_cents, featured, is_new, is_limited, details, materials, care_instructions, image_url, stock) as (
  values
  ('core-oversized-tee', 'Core Oversized Tee', 'Heavyweight athletic cut',
   'Relaxed athletic fit with minimal REFORGE branding. Built for training days and beyond.',
   't-shirts', 3900, null::int, true, true, false,
   'Oversized silhouette. Dropped shoulder. Clean hem.',
   '100% premium cotton, 220gsm', 'Machine wash cold. Hang dry.',
   'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80', 24),
  ('training-cut-tee', 'Training Cut Tee', 'Performance fit',
   'Slightly tapered through the body for unrestricted movement under load.',
   't-shirts', 3400, null, false, false, false,
   'Athletic fit. Breathable knit.', 'Cotton-elastane blend', 'Machine wash cold.',
   'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=900&q=80', 18),
  ('essentials-crew-tee', 'Essentials Crew Tee', 'Everyday staple',
   'The daily driver. Soft hand-feel with a structured crew neck.',
   't-shirts', 2900, 3400, false, false, false,
   'Classic crew. Midweight.', 'Organic cotton jersey', 'Wash inside out.',
   'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=900&q=80', 40),
  ('forge-heavy-hoodie', 'Forge Heavy Hoodie', 'Studio weight',
   'Dense fleece for cool mornings and post-session recovery.',
   'hoodies', 7900, null, true, false, false,
   'Kangaroo pocket. Ribbed cuffs.', 'Cotton fleece, 380gsm', 'Wash cold. Tumble low.',
   'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80', 14),
  ('studio-zip-hoodie', 'Studio Zip Hoodie', 'Layer ready',
   'Full-zip layering piece with a clean REFORGE mark at the chest.',
   'hoodies', 6900, null, false, true, false,
   'YKK zip. Lined hood.', 'French terry', 'Machine wash cold.',
   'https://images.unsplash.com/photo-1578768079052-d2c5fcf5db4f?auto=format&fit=crop&w=900&q=80', 11),
  ('warm-up-fleece', 'Warm-Up Fleece', 'Pre-session cover',
   'Lightweight fleece to stay sharp during warm-ups without bulk.',
   'hoodies', 5900, null, false, false, false,
   'Quarter details. Soft brushed interior.', 'Recycled polyester blend', 'Wash cold.',
   'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80', 3),
  ('performance-crew-socks', 'Performance Crew Socks', '3-pack',
   'Cushioned sole and arch support for long training blocks.',
   'socks', 1800, null, true, true, false,
   'Crew height. Reinforced heel and toe.', 'Cotton / nylon / elastane', 'Machine wash warm.',
   'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=900&q=80', 60),
  ('ankle-training-socks', 'Ankle Training Socks', 'Low profile',
   'Low-cut socks that stay put through conditioning.',
   'socks', 1400, null, false, false, false,
   'Ankle height. Grip tab.', 'Performance knit', 'Machine wash.',
   'https://images.unsplash.com/photo-1582966772680-860e8367871f?auto=format&fit=crop&w=900&q=80', 48),
  ('recovery-compression-socks', 'Recovery Compression Socks', 'Post-session',
   'Graduated compression for recovery days and travel.',
   'socks', 2400, null, false, false, false,
   'Knee-high. Targeted zones.', 'Nylon / elastane', 'Hand wash preferred.',
   'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=900&q=80', 22),
  ('reforge-cap', 'REFORGE Cap', 'Structured 6-panel',
   'Clean structured cap with tonal REFORGE embroidery.',
   'headwear', 3200, null, true, false, false,
   'Adjustable strap. Pre-curved brim.', 'Cotton twill', 'Spot clean.',
   'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=900&q=80', 16),
  ('training-beanie', 'Training Beanie', 'Cold start',
   'Soft ribbed beanie for early sessions and outdoor warm-ups.',
   'headwear', 2800, null, false, true, false,
   'Double-layer cuff. Soft touch.', 'Acrylic knit', 'Hand wash.',
   'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=900&q=80', 20),
  ('studio-dad-hat', 'Studio Dad Hat', 'Soft crown',
   'Unstructured dad hat — limited Essentials drop.',
   'headwear', 3000, null, false, false, true,
   'Soft crown. Metal buckle.', 'Washed cotton', 'Spot clean.',
   'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=80', 8)
)
insert into public.store_products (
  slug, name, subtitle, description, category_id, collection_id, status,
  price_cents, compare_at_cents, featured, is_new, is_limited,
  details, materials, care_instructions, published_at
)
select
  s.slug,
  s.name,
  s.subtitle,
  s.description,
  c.id,
  (select id from col),
  'active',
  s.price_cents,
  s.compare_at_cents,
  s.featured,
  s.is_new,
  s.is_limited,
  s.details,
  s.materials,
  s.care_instructions,
  now()
from seed s
join cats c on c.slug = s.category_slug
on conflict (slug) do nothing;

-- Product images (hero + orbit frames for 360° viewer demos)
insert into public.store_product_images (product_id, storage_path, public_url, alt_text, sort_order, is_primary)
select
  p.id,
  'external/' || p.slug || '-' || f.sort_order,
  f.public_url,
  p.name || ' — angle ' || (f.sort_order + 1),
  f.sort_order,
  f.sort_order = 0
from public.store_products p
join (
  values
  -- core-oversized-tee
  ('core-oversized-tee', 0, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'),
  ('core-oversized-tee', 1, 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=900&q=80'),
  ('core-oversized-tee', 2, 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=900&q=80'),
  ('core-oversized-tee', 3, 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=80'),
  ('core-oversized-tee', 4, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80'),
  ('core-oversized-tee', 5, 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=900&q=80'),
  -- training-cut-tee
  ('training-cut-tee', 0, 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=900&q=80'),
  ('training-cut-tee', 1, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'),
  ('training-cut-tee', 2, 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=900&q=80'),
  ('training-cut-tee', 3, 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=80'),
  ('training-cut-tee', 4, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80'),
  ('training-cut-tee', 5, 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=900&q=80'),
  -- essentials-crew-tee
  ('essentials-crew-tee', 0, 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=900&q=80'),
  ('essentials-crew-tee', 1, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'),
  ('essentials-crew-tee', 2, 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=900&q=80'),
  ('essentials-crew-tee', 3, 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=80'),
  ('essentials-crew-tee', 4, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80'),
  ('essentials-crew-tee', 5, 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=900&q=80'),
  -- forge-heavy-hoodie
  ('forge-heavy-hoodie', 0, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80'),
  ('forge-heavy-hoodie', 1, 'https://images.unsplash.com/photo-1578768079052-d2c5fcf5db4f?auto=format&fit=crop&w=900&q=80'),
  ('forge-heavy-hoodie', 2, 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80'),
  ('forge-heavy-hoodie', 3, 'https://images.unsplash.com/photo-1556821840-c18052bd4d8a?auto=format&fit=crop&w=900&q=80'),
  ('forge-heavy-hoodie', 4, 'https://images.unsplash.com/photo-1578587018452-892baccfd552?auto=format&fit=crop&w=900&q=80'),
  ('forge-heavy-hoodie', 5, 'https://images.unsplash.com/photo-1618354691438-25bc04584c23?auto=format&fit=crop&w=900&q=80'),
  -- studio-zip-hoodie
  ('studio-zip-hoodie', 0, 'https://images.unsplash.com/photo-1578768079052-d2c5fcf5db4f?auto=format&fit=crop&w=900&q=80'),
  ('studio-zip-hoodie', 1, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80'),
  ('studio-zip-hoodie', 2, 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80'),
  ('studio-zip-hoodie', 3, 'https://images.unsplash.com/photo-1556821840-c18052bd4d8a?auto=format&fit=crop&w=900&q=80'),
  ('studio-zip-hoodie', 4, 'https://images.unsplash.com/photo-1578587018452-892baccfd552?auto=format&fit=crop&w=900&q=80'),
  ('studio-zip-hoodie', 5, 'https://images.unsplash.com/photo-1618354691438-25bc04584c23?auto=format&fit=crop&w=900&q=80'),
  -- warm-up-fleece
  ('warm-up-fleece', 0, 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80'),
  ('warm-up-fleece', 1, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80'),
  ('warm-up-fleece', 2, 'https://images.unsplash.com/photo-1578768079052-d2c5fcf5db4f?auto=format&fit=crop&w=900&q=80'),
  ('warm-up-fleece', 3, 'https://images.unsplash.com/photo-1556821840-c18052bd4d8a?auto=format&fit=crop&w=900&q=80'),
  ('warm-up-fleece', 4, 'https://images.unsplash.com/photo-1578587018452-892baccfd552?auto=format&fit=crop&w=900&q=80'),
  ('warm-up-fleece', 5, 'https://images.unsplash.com/photo-1618354691438-25bc04584c23?auto=format&fit=crop&w=900&q=80'),
  -- performance-crew-socks
  ('performance-crew-socks', 0, 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=900&q=80'),
  ('performance-crew-socks', 1, 'https://images.unsplash.com/photo-1582966772680-860e8367871f?auto=format&fit=crop&w=900&q=80'),
  ('performance-crew-socks', 2, 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=900&q=80'),
  ('performance-crew-socks', 3, 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=900&q=80'),
  ('performance-crew-socks', 4, 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80'),
  ('performance-crew-socks', 5, 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80'),
  -- ankle-training-socks
  ('ankle-training-socks', 0, 'https://images.unsplash.com/photo-1582966772680-860e8367871f?auto=format&fit=crop&w=900&q=80'),
  ('ankle-training-socks', 1, 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=900&q=80'),
  ('ankle-training-socks', 2, 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=900&q=80'),
  ('ankle-training-socks', 3, 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=900&q=80'),
  ('ankle-training-socks', 4, 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80'),
  ('ankle-training-socks', 5, 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80'),
  -- recovery-compression-socks
  ('recovery-compression-socks', 0, 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=900&q=80'),
  ('recovery-compression-socks', 1, 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=900&q=80'),
  ('recovery-compression-socks', 2, 'https://images.unsplash.com/photo-1582966772680-860e8367871f?auto=format&fit=crop&w=900&q=80'),
  ('recovery-compression-socks', 3, 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=900&q=80'),
  ('recovery-compression-socks', 4, 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80'),
  ('recovery-compression-socks', 5, 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80'),
  -- reforge-cap
  ('reforge-cap', 0, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=900&q=80'),
  ('reforge-cap', 1, 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=900&q=80'),
  ('reforge-cap', 2, 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=80'),
  ('reforge-cap', 3, 'https://images.unsplash.com/photo-1534215754734-18e55d13e346?auto=format&fit=crop&w=900&q=80'),
  ('reforge-cap', 4, 'https://images.unsplash.com/photo-1556306535-0f09a537f0a3?auto=format&fit=crop&w=900&q=80'),
  ('reforge-cap', 5, 'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?auto=format&fit=crop&w=900&q=80'),
  -- training-beanie
  ('training-beanie', 0, 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=900&q=80'),
  ('training-beanie', 1, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=900&q=80'),
  ('training-beanie', 2, 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=80'),
  ('training-beanie', 3, 'https://images.unsplash.com/photo-1534215754734-18e55d13e346?auto=format&fit=crop&w=900&q=80'),
  ('training-beanie', 4, 'https://images.unsplash.com/photo-1556306535-0f09a537f0a3?auto=format&fit=crop&w=900&q=80'),
  ('training-beanie', 5, 'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?auto=format&fit=crop&w=900&q=80'),
  -- studio-dad-hat
  ('studio-dad-hat', 0, 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=80'),
  ('studio-dad-hat', 1, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=900&q=80'),
  ('studio-dad-hat', 2, 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=900&q=80'),
  ('studio-dad-hat', 3, 'https://images.unsplash.com/photo-1534215754734-18e55d13e346?auto=format&fit=crop&w=900&q=80'),
  ('studio-dad-hat', 4, 'https://images.unsplash.com/photo-1556306535-0f09a537f0a3?auto=format&fit=crop&w=900&q=80'),
  ('studio-dad-hat', 5, 'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?auto=format&fit=crop&w=900&q=80')
) as f(slug, sort_order, public_url) on f.slug = p.slug
where not exists (
  select 1
  from public.store_product_images i
  where i.product_id = p.id and i.sort_order = f.sort_order
);

-- Simple Black / size variants
insert into public.store_product_variants (product_id, sku, size_label, color_label, color_hex, stock_qty, active)
select
  p.id,
  upper('RFG-' || left(p.slug, 8) || '-BLK-' || sz.size_label),
  case when sz.size_label = 'ONE' then null else sz.size_label end,
  'Black',
  '#111111',
  greatest(1, 8),
  true
from public.store_products p
cross join (
  select unnest(array['S','M','L','XL']) as size_label
) sz
where p.slug in (
  'core-oversized-tee','training-cut-tee','essentials-crew-tee',
  'forge-heavy-hoodie','studio-zip-hoodie','warm-up-fleece'
)
and not exists (
  select 1 from public.store_product_variants v
  where v.product_id = p.id and v.sku = upper('RFG-' || left(p.slug, 8) || '-BLK-' || sz.size_label)
);

insert into public.store_product_variants (product_id, sku, size_label, color_label, color_hex, stock_qty, active)
select
  p.id,
  upper('RFG-' || left(p.slug, 8) || '-BLK-OS'),
  null,
  'Black',
  '#111111',
  12,
  true
from public.store_products p
where p.slug in (
  'performance-crew-socks','ankle-training-socks','recovery-compression-socks',
  'reforge-cap','training-beanie','studio-dad-hat'
)
and not exists (
  select 1 from public.store_product_variants v where v.product_id = p.id
);
