import { useSupabaseStore } from '@/lib/store/config';
import { formatStoreMoney, slugifyStoreName } from '@/lib/store/money';
import {
  EXAMPLE_CATEGORIES,
  EXAMPLE_IMAGES,
  EXAMPLE_PRODUCTS,
  EXAMPLE_VARIANTS,
} from '@/services/mock/storeCatalog';
import * as storeSupabase from '@/services/store.supabase';
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
} from '@/types';

export { formatStoreMoney, slugifyStoreName };

const MOCK_CATEGORIES = EXAMPLE_CATEGORIES;

const MOCK_HERO: StoreHomeHero = {
  kicker: 'REFORGE',
  title: 'STORE',
  headline: 'REFORGE ESSENTIALS',
  subtitle: 'Forged under load. Cut for the work. No soft layers.',
  cta: 'SHOP COLLECTION',
};

/** Start with example Essentials catalogue (3 pieces per category). */
let mockProducts: StoreProduct[] = [...EXAMPLE_PRODUCTS];
let mockVariants: StoreProductVariant[] = [...EXAMPLE_VARIANTS];
let mockImages: StoreProductImage[] = [...EXAMPLE_IMAGES];
let mockMovements: StoreInventoryMovement[] = [];

function enrichMockProduct(p: StoreProduct): StoreProduct {
  const images = mockImages
    .filter((i) => i.product_id === p.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const variants = mockVariants.filter((v) => v.product_id === p.id);
  return {
    ...p,
    images,
    variants,
    category: MOCK_CATEGORIES.find((c) => c.id === p.category_id) ?? p.category ?? null,
    primary_image_url:
      images.find((i) => i.is_primary)?.public_url ??
      images[0]?.public_url ??
      p.primary_image_url ??
      null,
    total_stock: variants.filter((v) => v.active).reduce((s, v) => s + v.stock_qty, 0),
  };
}

/**
 * When Supabase catalog is empty (migration applied, no products yet),
 * fall back to example Essentials so the member store is demoable.
 */
async function listProductsWithExampleFallback(
  opts: Parameters<typeof storeSupabase.listProducts>[0] = {},
): Promise<StoreProduct[]> {
  const rows = await storeSupabase.listProducts(opts);
  if (rows.length > 0) return rows;

  // Example Essentials are for member browsing only — never fake admin inventory.
  if (opts.status === 'all' || opts.status === 'draft' || opts.status === 'archived') {
    return [];
  }

  let fallback = EXAMPLE_PRODUCTS.map((p) => enrichMockProduct(p));

  // Remaining statuses are active / undefined (member browse).
  if (opts.status === 'active' || !opts.status) {
    fallback = fallback.filter((p) => p.status === 'active');
  }
  if (opts.categoryId) {
    const liveCats = await storeSupabase.listCategories().catch(() => [] as StoreCategory[]);
    const slug =
      liveCats.find((c) => c.id === opts.categoryId)?.slug ??
      EXAMPLE_CATEGORIES.find((c) => c.id === opts.categoryId)?.slug;
    if (slug) {
      fallback = fallback.filter((p) => p.category?.slug === slug);
    }
  }
  if (opts.featuredOnly) fallback = fallback.filter((p) => p.featured);
  if (opts.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    fallback = fallback.filter((p) => p.name.toLowerCase().includes(q));
  }
  switch (opts.sort) {
    case 'price_asc':
      fallback.sort((a, b) => a.price_cents - b.price_cents);
      break;
    case 'price_desc':
      fallback.sort((a, b) => b.price_cents - a.price_cents);
      break;
    case 'newest':
      fallback.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    default:
      fallback.sort((a, b) => Number(b.featured) - Number(a.featured));
      break;
  }
  if (opts.limit != null) {
    fallback = fallback.slice(opts.offset ?? 0, (opts.offset ?? 0) + opts.limit);
  }
  return fallback;
}

export async function listCategories(): Promise<StoreCategory[]> {
  if (useSupabaseStore()) return storeSupabase.listCategories();
  return MOCK_CATEGORIES;
}

export async function listCollections(): Promise<StoreCollection[]> {
  if (useSupabaseStore()) return storeSupabase.listCollections();
  return [];
}

export async function listSizeGuides(): Promise<StoreSizeGuide[]> {
  if (useSupabaseStore()) return storeSupabase.listSizeGuides();
  return [];
}

export async function getHomeHero(): Promise<StoreHomeHero> {
  if (useSupabaseStore()) return storeSupabase.getHomeHero();
  return MOCK_HERO;
}

export async function getFulfillmentSettings(): Promise<StoreFulfillmentSettings> {
  if (useSupabaseStore()) return storeSupabase.getFulfillmentSettings();
  return {
    pickup_label: 'PICK UP FROM REFORGE',
    pickup_location: 'REFORGE Limassol',
    standard_delivery_cents: 500,
    currency: 'EUR',
  };
}

export async function getInventorySettings(): Promise<StoreInventorySettings> {
  if (useSupabaseStore()) return storeSupabase.getInventorySettings();
  return { low_stock_threshold: 5, show_exact_stock: false };
}

export async function updateStoreSetting(
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  if (useSupabaseStore()) return storeSupabase.updateStoreSetting(key, value);
}

export async function listProducts(
  opts: Parameters<typeof storeSupabase.listProducts>[0] = {},
): Promise<StoreProduct[]> {
  if (useSupabaseStore()) return listProductsWithExampleFallback(opts);
  let rows = mockProducts.map(enrichMockProduct);
  if (opts.status && opts.status !== 'all') {
    rows = rows.filter((p) => p.status === opts.status);
  } else if (!opts.status) {
    rows = rows.filter((p) => p.status === 'active');
  }
  if (opts.categoryId) rows = rows.filter((p) => p.category_id === opts.categoryId);
  if (opts.featuredOnly) rows = rows.filter((p) => p.featured);
  if (opts.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(q));
  }
  switch (opts.sort) {
    case 'price_asc':
      rows.sort((a, b) => a.price_cents - b.price_cents);
      break;
    case 'price_desc':
      rows.sort((a, b) => b.price_cents - a.price_cents);
      break;
    case 'newest':
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    default:
      rows.sort((a, b) => Number(b.featured) - Number(a.featured));
      break;
  }
  if (opts.limit != null) rows = rows.slice(opts.offset ?? 0, (opts.offset ?? 0) + opts.limit);
  return rows;
}

export async function getProduct(productId: string): Promise<StoreProduct | null> {
  if (useSupabaseStore()) {
    const live = await storeSupabase.getProduct(productId);
    if (live) return live;
    const example = EXAMPLE_PRODUCTS.find((p) => p.id === productId);
    return example ? enrichMockProduct(example) : null;
  }
  const p = mockProducts.find((x) => x.id === productId);
  if (!p) return null;
  return enrichMockProduct(p);
}

export async function upsertProduct(
  input: storeSupabase.UpsertProductInput,
): Promise<StoreProduct> {
  if (useSupabaseStore()) return storeSupabase.upsertProduct(input);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = mockProducts.findIndex((p) => p.id === input.id);
    if (idx < 0) throw new Error('Product not found');
    mockProducts[idx] = {
      ...mockProducts[idx],
      ...input,
      slug: input.slug || slugifyStoreName(input.name),
      updated_at: now,
    } as StoreProduct;
    return mockProducts[idx];
  }
  const product: StoreProduct = {
    id: `mock-prod-${Date.now()}`,
    slug: input.slug || slugifyStoreName(input.name),
    name: input.name,
    subtitle: input.subtitle ?? null,
    description: input.description ?? null,
    category_id: input.category_id ?? null,
    collection_id: input.collection_id ?? null,
    size_guide_id: input.size_guide_id ?? null,
    status: input.status,
    price_cents: input.price_cents,
    compare_at_cents: input.compare_at_cents ?? null,
    currency: 'EUR',
    featured: input.featured ?? false,
    is_new: input.is_new ?? false,
    is_limited: input.is_limited ?? false,
    is_bestseller: input.is_bestseller ?? false,
    is_best_of_month: input.is_best_of_month ?? false,
    details: input.details ?? null,
    materials: input.materials ?? null,
    care_instructions: input.care_instructions ?? null,
    release_at: input.release_at ?? null,
    published_at: input.status === 'active' ? now : null,
    created_at: now,
    updated_at: now,
  };
  mockProducts = [product, ...mockProducts];
  return product;
}

export async function archiveProduct(productId: string): Promise<void> {
  if (useSupabaseStore()) return storeSupabase.archiveProduct(productId);
  mockProducts = mockProducts.map((p) =>
    p.id === productId ? { ...p, status: 'archived' as const } : p,
  );
}

export async function upsertVariant(
  input: storeSupabase.UpsertVariantInput,
): Promise<StoreProductVariant> {
  if (useSupabaseStore()) return storeSupabase.upsertVariant(input);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = mockVariants.findIndex((v) => v.id === input.id);
    if (idx < 0) throw new Error('Variant not found');
    mockVariants[idx] = { ...mockVariants[idx], ...input, updated_at: now } as StoreProductVariant;
    return mockVariants[idx];
  }
  const variant: StoreProductVariant = {
    id: `mock-var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: input.product_id,
    sku: input.sku,
    size_label: input.size_label ?? null,
    color_label: input.color_label ?? null,
    color_hex: input.color_hex ?? null,
    stock_qty: input.stock_qty ?? 0,
    price_override_cents: input.price_override_cents ?? null,
    image_url: input.image_url ?? null,
    active: input.active ?? true,
    created_at: now,
    updated_at: now,
  };
  mockVariants = [...mockVariants, variant];
  return variant;
}

export async function generateVariants(
  input: Parameters<typeof storeSupabase.generateVariants>[0],
): Promise<StoreProductVariant[]> {
  if (useSupabaseStore()) return storeSupabase.generateVariants(input);
  const created: StoreProductVariant[] = [];
  for (const color of input.colors) {
    for (const size of input.sizes) {
      created.push(
        await upsertVariant({
          product_id: input.product_id,
          sku: `${input.skuPrefix}-${color.slice(0, 3)}-${size}`.toUpperCase().replace(/\s+/g, ''),
          color_label: color,
          size_label: size,
          stock_qty: input.stock_qty ?? 0,
        }),
      );
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
  if (useSupabaseStore()) return storeSupabase.adjustVariantStock(input);
  const idx = mockVariants.findIndex((v) => v.id === input.variantId);
  if (idx < 0) throw new Error('Variant not found');
  const next = mockVariants[idx].stock_qty + input.delta;
  if (next < 0) throw new Error('Insufficient stock');
  mockVariants[idx] = {
    ...mockVariants[idx],
    stock_qty: next,
    updated_at: new Date().toISOString(),
  };
  mockMovements = [
    {
      id: `mock-mov-${Date.now()}`,
      variant_id: input.variantId,
      delta: input.delta,
      reason: input.reason,
      note: input.note ?? null,
      order_id: null,
      created_by: null,
      created_at: new Date().toISOString(),
    },
    ...mockMovements,
  ];
  return mockVariants[idx];
}

export async function listInventory(opts?: {
  lowOnly?: boolean;
  threshold?: number;
}): Promise<
  Array<StoreProductVariant & { product_name: string; product_status: StoreProductStatus }>
> {
  if (useSupabaseStore()) return storeSupabase.listInventory(opts);
  const threshold = opts?.threshold ?? 5;
  const rows = mockVariants.map((v) => ({
    ...v,
    product_name: mockProducts.find((p) => p.id === v.product_id)?.name ?? 'Product',
    product_status: mockProducts.find((p) => p.id === v.product_id)?.status ?? 'draft',
  }));
  if (opts?.lowOnly) return rows.filter((r) => r.active && r.stock_qty <= threshold);
  return rows;
}

export async function listVariantMovements(
  variantId: string,
  limit = 30,
): Promise<StoreInventoryMovement[]> {
  if (useSupabaseStore()) return storeSupabase.listVariantMovements(variantId, limit);
  return mockMovements.filter((m) => m.variant_id === variantId).slice(0, limit);
}

export async function getDashboardStats(): Promise<StoreDashboardStats> {
  if (useSupabaseStore()) return storeSupabase.getDashboardStats();
  const activeVariants = mockVariants.filter((v) => v.active);
  const { getMockOrdersSnapshot } = await import('@/services/store.commerce');
  const orders = getMockOrdersSnapshot();
  const openStatuses = new Set([
    'awaiting_payment',
    'paid',
    'processing',
    'ready_for_pickup',
    'shipped',
  ]);
  return {
    activeProducts: mockProducts.filter((p) => p.status === 'active').length,
    draftProducts: mockProducts.filter((p) => p.status === 'draft').length,
    archivedProducts: mockProducts.filter((p) => p.status === 'archived').length,
    lowStockVariants: activeVariants.filter((v) => v.stock_qty > 0 && v.stock_qty <= 5).length,
    outOfStockVariants: activeVariants.filter((v) => v.stock_qty <= 0).length,
    totalUnits: activeVariants.reduce((s, v) => s + v.stock_qty, 0),
    openOrders: orders.filter((o) => openStatuses.has(o.status)).length,
    awaitingPaymentOrders: orders.filter((o) => o.status === 'awaiting_payment').length,
    paidOrders: orders.filter((o) => o.payment_status === 'paid').length,
    revenueCents: orders
      .filter((o) => o.payment_status === 'paid')
      .reduce((s, o) => s + o.total_cents, 0),
  };
}

export async function uploadProductImage(input: {
  productId: string;
  localUri: string;
  altText?: string;
  makePrimary?: boolean;
}): Promise<StoreProductImage> {
  if (useSupabaseStore()) return storeSupabase.uploadProductImage(input);
  const image: StoreProductImage = {
    id: `mock-img-${Date.now()}`,
    product_id: input.productId,
    storage_path: input.localUri,
    public_url: input.localUri,
    alt_text: input.altText ?? null,
    sort_order: mockImages.filter((i) => i.product_id === input.productId).length,
    is_primary:
      input.makePrimary ||
      mockImages.filter((i) => i.product_id === input.productId).length === 0,
    created_at: new Date().toISOString(),
  };
  if (image.is_primary) {
    mockImages = mockImages.map((i) =>
      i.product_id === input.productId ? { ...i, is_primary: false } : i,
    );
  }
  mockImages = [...mockImages, image];
  return image;
}

export async function setPrimaryImage(productId: string, imageId: string): Promise<void> {
  if (useSupabaseStore()) return storeSupabase.setPrimaryImage(productId, imageId);
  mockImages = mockImages.map((i) =>
    i.product_id === productId ? { ...i, is_primary: i.id === imageId } : i,
  );
}

export async function reorderImages(productId: string, orderedIds: string[]): Promise<void> {
  if (useSupabaseStore()) return storeSupabase.reorderImages(productId, orderedIds);
  mockImages = mockImages.map((i) => {
    if (i.product_id !== productId) return i;
    const idx = orderedIds.indexOf(i.id);
    return idx >= 0 ? { ...i, sort_order: idx } : i;
  });
}

export async function deleteProductImage(image: StoreProductImage): Promise<void> {
  if (useSupabaseStore()) return storeSupabase.deleteProductImage(image);
  mockImages = mockImages.filter((i) => i.id !== image.id);
}

export async function createSizeGuide(
  input: Parameters<typeof storeSupabase.createSizeGuide>[0],
): Promise<StoreSizeGuide> {
  if (useSupabaseStore()) return storeSupabase.createSizeGuide(input);
  return {
    id: `mock-sg-${Date.now()}`,
    name: input.name,
    description: input.description ?? null,
    published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rows: input.rows.map((r, i) => ({
      id: `mock-sgr-${i}`,
      size_guide_id: `mock-sg-${Date.now()}`,
      size_label: r.size_label,
      chest_cm: r.chest_cm ?? null,
      length_cm: r.length_cm ?? null,
      waist_cm: r.waist_cm ?? null,
      hip_cm: r.hip_cm ?? null,
      sort_order: i,
      created_at: new Date().toISOString(),
    })),
  };
}
