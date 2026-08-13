import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { slugifyStoreName } from '@/lib/store/money';
import type {
  StoreCategory,
  StoreCollection,
  StoreDashboardStats,
  StoreFulfillmentSettings,
  StoreHomeHero,
  StoreInventoryMovement,
  StoreInventoryReason,
  StoreInventorySettings,
  StoreProduct,
  StoreProductImage,
  StoreProductStatus,
  StoreProductVariant,
  StoreSizeGuide,
  StoreSizeGuideRow,
} from '@/types';

const DEFAULT_HERO: StoreHomeHero = {
  kicker: 'REFORGE',
  title: 'STORE',
  headline: 'REFORGE ESSENTIALS',
  subtitle: 'Forged under load. Cut for the work. No soft layers.',
  cta: 'SHOP COLLECTION',
};

const DEFAULT_FULFILLMENT: StoreFulfillmentSettings = {
  pickup_label: 'PICK UP FROM REFORGE',
  pickup_location: 'REFORGE Limassol',
  standard_delivery_cents: 500,
  currency: 'EUR',
};

const DEFAULT_INVENTORY: StoreInventorySettings = {
  low_stock_threshold: 5,
  show_exact_stock: false,
};

type ProductListOpts = {
  status?: StoreProductStatus | 'all';
  categoryId?: string | null;
  featuredOnly?: boolean;
  search?: string;
  sort?: 'featured' | 'newest' | 'price_asc' | 'price_desc';
  limit?: number;
  offset?: number;
};

function mapProduct(row: Record<string, unknown>): StoreProduct {
  const images = (row.images as StoreProductImage[] | undefined) ?? undefined;
  const variants = (row.variants as StoreProductVariant[] | undefined) ?? undefined;
  const primary =
    images?.find((i) => i.is_primary)?.public_url ?? images?.[0]?.public_url ?? null;
  const total_stock = variants?.reduce((sum, v) => sum + (v.active ? v.stock_qty : 0), 0);

  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    subtitle: (row.subtitle as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    category_id: (row.category_id as string | null) ?? null,
    collection_id: (row.collection_id as string | null) ?? null,
    size_guide_id: (row.size_guide_id as string | null) ?? null,
    status: row.status as StoreProductStatus,
    price_cents: row.price_cents as number,
    compare_at_cents: (row.compare_at_cents as number | null) ?? null,
    currency: (row.currency as string) ?? 'EUR',
    featured: Boolean(row.featured),
    is_new: Boolean(row.is_new),
    is_limited: Boolean(row.is_limited),
    is_bestseller: Boolean(row.is_bestseller),
    is_best_of_month: Boolean(row.is_best_of_month),
    details: (row.details as string | null) ?? null,
    materials: (row.materials as string | null) ?? null,
    care_instructions: (row.care_instructions as string | null) ?? null,
    release_at: (row.release_at as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    category: (row.category as StoreCategory | null) ?? null,
    collection: (row.collection as StoreCollection | null) ?? null,
    images,
    variants,
    primary_image_url: primary,
    total_stock,
  };
}

export async function listCategories(): Promise<StoreCategory[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as StoreCategory[];
}

export async function listCollections(): Promise<StoreCollection[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_collections')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as StoreCollection[];
}

export async function listSizeGuides(): Promise<StoreSizeGuide[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_size_guides')
    .select('*, rows:store_size_guide_rows(*)')
    .order('name', { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((g) => ({
    ...(g as StoreSizeGuide),
    rows: ((g as { rows?: StoreSizeGuideRow[] }).rows ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));
}

export async function getHomeHero(): Promise<StoreHomeHero> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', 'home_hero')
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return { ...DEFAULT_HERO, ...(data?.value as Partial<StoreHomeHero> | undefined) };
}

export async function getFulfillmentSettings(): Promise<StoreFulfillmentSettings> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', 'fulfillment')
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return {
    ...DEFAULT_FULFILLMENT,
    ...(data?.value as Partial<StoreFulfillmentSettings> | undefined),
  };
}

export async function getInventorySettings(): Promise<StoreInventorySettings> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_settings')
    .select('value')
    .eq('key', 'inventory')
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return {
    ...DEFAULT_INVENTORY,
    ...(data?.value as Partial<StoreInventorySettings> | undefined),
  };
}

export async function updateStoreSetting(key: string, value: Record<string, unknown>): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('store_settings').upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function listProducts(opts: ProductListOpts = {}): Promise<StoreProduct[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('store_products')
    .select(
      `
      *,
      category:store_categories(*),
      collection:store_collections(*),
      images:store_product_images(*),
      variants:store_product_variants(*)
    `,
    );

  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  }
  if (opts.categoryId) {
    query = query.eq('category_id', opts.categoryId);
  }
  if (opts.featuredOnly) {
    query = query.eq('featured', true);
  }
  if (opts.search?.trim()) {
    query = query.ilike('name', `%${opts.search.trim()}%`);
  }

  switch (opts.sort) {
    case 'price_asc':
      query = query.order('price_cents', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price_cents', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'featured':
    default:
      query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
      break;
  }

  if (opts.limit != null) query = query.limit(opts.limit);
  if (opts.offset != null) query = query.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);

  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => mapProduct(row as Record<string, unknown>));
}

export async function getProduct(productId: string): Promise<StoreProduct | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_products')
    .select(
      `
      *,
      category:store_categories(*),
      collection:store_collections(*),
      images:store_product_images(*),
      variants:store_product_variants(*)
    `,
    )
    .eq('id', productId)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) return null;
  const product = mapProduct(data as Record<string, unknown>);
  if (product.images) {
    product.images = [...product.images].sort((a, b) => a.sort_order - b.sort_order);
  }
  if (product.variants) {
    product.variants = [...product.variants].sort((a, b) =>
      `${a.color_label ?? ''}${a.size_label ?? ''}`.localeCompare(
        `${b.color_label ?? ''}${b.size_label ?? ''}`,
      ),
    );
  }
  return product;
}

export type UpsertProductInput = {
  id?: string;
  name: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  category_id?: string | null;
  collection_id?: string | null;
  size_guide_id?: string | null;
  status: StoreProductStatus;
  price_cents: number;
  compare_at_cents?: number | null;
  featured?: boolean;
  is_new?: boolean;
  is_limited?: boolean;
  is_bestseller?: boolean;
  is_best_of_month?: boolean;
  details?: string | null;
  materials?: string | null;
  care_instructions?: string | null;
  release_at?: string | null;
};

export async function upsertProduct(input: UpsertProductInput): Promise<StoreProduct> {
  const supabase = getSupabase();
  const slug = input.slug?.trim() || slugifyStoreName(input.name);
  const payload = {
    name: input.name.trim(),
    slug,
    subtitle: input.subtitle ?? null,
    description: input.description ?? null,
    category_id: input.category_id ?? null,
    collection_id: input.collection_id ?? null,
    size_guide_id: input.size_guide_id ?? null,
    status: input.status,
    price_cents: input.price_cents,
    compare_at_cents: input.compare_at_cents ?? null,
    featured: input.featured ?? false,
    is_new: input.is_new ?? false,
    is_limited: input.is_limited ?? false,
    is_bestseller: input.is_bestseller ?? false,
    is_best_of_month: input.is_best_of_month ?? false,
    details: input.details ?? null,
    materials: input.materials ?? null,
    care_instructions: input.care_instructions ?? null,
    release_at: input.release_at ?? null,
  };

  if (input.id) {
    const { data: existing } = await supabase
      .from('store_products')
      .select('published_at, status')
      .eq('id', input.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('store_products')
      .update({
        ...payload,
        published_at:
          input.status === 'active'
            ? (existing?.published_at as string | null) ?? new Date().toISOString()
            : (existing?.published_at as string | null) ?? null,
      })
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw new Error(formatSupabaseError(error));
    return mapProduct(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('store_products')
    .insert({
      ...payload,
      published_at: input.status === 'active' ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return mapProduct(data as Record<string, unknown>);
}

export async function archiveProduct(productId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('store_products')
    .update({ status: 'archived' })
    .eq('id', productId);
  if (error) throw new Error(formatSupabaseError(error));
}

export type UpsertVariantInput = {
  id?: string;
  product_id: string;
  sku: string;
  size_label?: string | null;
  color_label?: string | null;
  color_hex?: string | null;
  stock_qty?: number;
  price_override_cents?: number | null;
  image_url?: string | null;
  active?: boolean;
};

export async function upsertVariant(input: UpsertVariantInput): Promise<StoreProductVariant> {
  const supabase = getSupabase();
  const payload = {
    product_id: input.product_id,
    sku: input.sku.trim().toUpperCase(),
    size_label: input.size_label ?? null,
    color_label: input.color_label ?? null,
    color_hex: input.color_hex ?? null,
    stock_qty: input.stock_qty ?? 0,
    price_override_cents: input.price_override_cents ?? null,
    image_url: input.image_url ?? null,
    active: input.active ?? true,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('store_product_variants')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw new Error(formatSupabaseError(error));
    return data as StoreProductVariant;
  }

  const { data, error } = await supabase
    .from('store_product_variants')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as StoreProductVariant;
}

export async function generateVariants(input: {
  product_id: string;
  skuPrefix: string;
  colors: string[];
  sizes: string[];
  stock_qty?: number;
}): Promise<StoreProductVariant[]> {
  const created: StoreProductVariant[] = [];
  for (const color of input.colors) {
    for (const size of input.sizes) {
      const sku = `${input.skuPrefix}-${color.slice(0, 3)}-${size}`
        .toUpperCase()
        .replace(/\s+/g, '');
      try {
        const row = await upsertVariant({
          product_id: input.product_id,
          sku,
          color_label: color,
          size_label: size,
          stock_qty: input.stock_qty ?? 0,
        });
        created.push(row);
      } catch {
        // Skip duplicates (unique sku / color+size)
      }
    }
  }
  return created;
}

export async function adjustVariantStock(input: {
  variantId: string;
  delta: number;
  reason: StoreInventoryReason;
  note?: string;
}): Promise<StoreProductVariant> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('adjust_store_variant_stock', {
    p_variant_id: input.variantId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_note: input.note ?? null,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return data as StoreProductVariant;
}

export async function listInventory(opts?: {
  lowOnly?: boolean;
  threshold?: number;
}): Promise<
  Array<
    StoreProductVariant & {
      product_name: string;
      product_status: StoreProductStatus;
    }
  >
> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_product_variants')
    .select('*, product:store_products(name, status)')
    .order('stock_qty', { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));

  const threshold = opts?.threshold ?? 5;
  const rows = (data ?? []).map((row) => {
    const product = row.product as { name: string; status: StoreProductStatus } | null;
    return {
      id: row.id as string,
      product_id: row.product_id as string,
      sku: row.sku as string,
      size_label: (row.size_label as string | null) ?? null,
      color_label: (row.color_label as string | null) ?? null,
      color_hex: (row.color_hex as string | null) ?? null,
      stock_qty: row.stock_qty as number,
      price_override_cents: (row.price_override_cents as number | null) ?? null,
      image_url: (row.image_url as string | null) ?? null,
      active: Boolean(row.active),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      product_name: product?.name ?? 'Product',
      product_status: product?.status ?? 'draft',
    };
  });

  if (opts?.lowOnly) {
    return rows.filter((r) => r.active && r.stock_qty <= threshold);
  }
  return rows;
}

export async function listVariantMovements(
  variantId: string,
  limit = 30,
): Promise<StoreInventoryMovement[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_inventory_movements')
    .select('*')
    .eq('variant_id', variantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as StoreInventoryMovement[];
}

export async function getDashboardStats(): Promise<StoreDashboardStats> {
  const supabase = getSupabase();
  const inventorySettings = await getInventorySettings();
  const threshold = inventorySettings.low_stock_threshold;

  const [
    { data: products, error: pErr },
    { data: variants, error: vErr },
    { data: orders, error: oErr },
  ] = await Promise.all([
    supabase.from('store_products').select('status'),
    supabase.from('store_product_variants').select('stock_qty, active'),
    supabase.from('store_orders').select('status, payment_status, total_cents'),
  ]);
  if (pErr) throw new Error(formatSupabaseError(pErr));
  if (vErr) throw new Error(formatSupabaseError(vErr));
  if (oErr) throw new Error(formatSupabaseError(oErr));

  const productRows = products ?? [];
  const variantRows = (variants ?? []).filter((v) => v.active);
  const orderRows = orders ?? [];
  const openStatuses = new Set([
    'awaiting_payment',
    'paid',
    'processing',
    'ready_for_pickup',
    'shipped',
  ]);

  return {
    activeProducts: productRows.filter((p) => p.status === 'active').length,
    draftProducts: productRows.filter((p) => p.status === 'draft').length,
    archivedProducts: productRows.filter((p) => p.status === 'archived').length,
    lowStockVariants: variantRows.filter(
      (v) => (v.stock_qty as number) > 0 && (v.stock_qty as number) <= threshold,
    ).length,
    outOfStockVariants: variantRows.filter((v) => (v.stock_qty as number) <= 0).length,
    totalUnits: variantRows.reduce((sum, v) => sum + (v.stock_qty as number), 0),
    openOrders: orderRows.filter((o) => openStatuses.has(o.status as string)).length,
    awaitingPaymentOrders: orderRows.filter((o) => o.status === 'awaiting_payment').length,
    paidOrders: orderRows.filter((o) => o.payment_status === 'paid').length,
    revenueCents: orderRows
      .filter((o) => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (o.total_cents as number), 0),
  };
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

export async function uploadProductImage(input: {
  productId: string;
  localUri: string;
  altText?: string;
  makePrimary?: boolean;
}): Promise<StoreProductImage> {
  const supabase = getSupabase();
  const ext = input.localUri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
  const path = `${input.productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  const body = await uriToArrayBuffer(input.localUri);
  const contentType =
    safeExt === 'png'
      ? 'image/png'
      : safeExt === 'webp'
        ? 'image/webp'
        : safeExt === 'heic'
          ? 'image/heic'
          : 'image/jpeg';

  const { error: uploadError } = await supabase.storage.from('store-products').upload(path, body, {
    contentType,
    upsert: false,
  });
  if (uploadError) throw new Error(formatSupabaseError(uploadError));

  const { data: publicData } = supabase.storage.from('store-products').getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  if (input.makePrimary) {
    await supabase
      .from('store_product_images')
      .update({ is_primary: false })
      .eq('product_id', input.productId);
  }

  const { data: existing } = await supabase
    .from('store_product_images')
    .select('sort_order')
    .eq('product_id', input.productId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = ((existing?.[0]?.sort_order as number | undefined) ?? -1) + 1;
  const isPrimary = input.makePrimary || nextOrder === 0;

  const { data, error } = await supabase
    .from('store_product_images')
    .insert({
      product_id: input.productId,
      storage_path: path,
      public_url: publicUrl,
      alt_text: input.altText ?? null,
      sort_order: nextOrder,
      is_primary: isPrimary,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as StoreProductImage;
}

export async function setPrimaryImage(productId: string, imageId: string): Promise<void> {
  const supabase = getSupabase();
  const { error: clearErr } = await supabase
    .from('store_product_images')
    .update({ is_primary: false })
    .eq('product_id', productId);
  if (clearErr) throw new Error(formatSupabaseError(clearErr));
  const { error } = await supabase
    .from('store_product_images')
    .update({ is_primary: true })
    .eq('id', imageId)
    .eq('product_id', productId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function reorderImages(
  productId: string,
  orderedIds: string[],
): Promise<void> {
  const supabase = getSupabase();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('store_product_images')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
      .eq('product_id', productId);
    if (error) throw new Error(formatSupabaseError(error));
  }
}

export async function deleteProductImage(image: StoreProductImage): Promise<void> {
  const supabase = getSupabase();
  if (image.storage_path) {
    await supabase.storage.from('store-products').remove([image.storage_path]);
  }
  const { error } = await supabase.from('store_product_images').delete().eq('id', image.id);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function createSizeGuide(input: {
  name: string;
  description?: string;
  rows: Array<{
    size_label: string;
    chest_cm?: number | null;
    length_cm?: number | null;
    waist_cm?: number | null;
    hip_cm?: number | null;
  }>;
}): Promise<StoreSizeGuide> {
  const supabase = getSupabase();
  const { data: guide, error } = await supabase
    .from('store_size_guides')
    .insert({
      name: input.name.trim(),
      description: input.description ?? null,
      published: true,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));

  if (input.rows.length) {
    const { error: rowErr } = await supabase.from('store_size_guide_rows').insert(
      input.rows.map((r, i) => ({
        size_guide_id: guide.id,
        size_label: r.size_label,
        chest_cm: r.chest_cm ?? null,
        length_cm: r.length_cm ?? null,
        waist_cm: r.waist_cm ?? null,
        hip_cm: r.hip_cm ?? null,
        sort_order: i,
      })),
    );
    if (rowErr) throw new Error(formatSupabaseError(rowErr));
  }

  return getSizeGuide(guide.id as string);
}

async function getSizeGuide(id: string): Promise<StoreSizeGuide> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_size_guides')
    .select('*, rows:store_size_guide_rows(*)')
    .eq('id', id)
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return {
    ...(data as StoreSizeGuide),
    rows: ((data as { rows?: StoreSizeGuideRow[] }).rows ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  };
}
