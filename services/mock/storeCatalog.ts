import type { StoreCategory, StoreProduct, StoreProductImage, StoreProductVariant } from '@/types';

const now = '2026-08-13T10:00:00.000Z';

/** Editorial apparel photography placeholders — replace with REFORGE 360 shoots later. */
const IMG = {
  tee1: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
  tee2: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=900&q=80',
  tee3: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=900&q=80',
  tee4: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=80',
  tee5: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80',
  tee6: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=900&q=80',
  hoodie1: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80',
  hoodie2: 'https://images.unsplash.com/photo-1578768079052-d2c5fcf5db4f?auto=format&fit=crop&w=900&q=80',
  hoodie3: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80',
  hoodie4: 'https://images.unsplash.com/photo-1556821840-c18052bd4d8a?auto=format&fit=crop&w=900&q=80',
  hoodie5: 'https://images.unsplash.com/photo-1578587018452-892baccfd552?auto=format&fit=crop&w=900&q=80',
  hoodie6: 'https://images.unsplash.com/photo-1618354691438-25bc04584c23?auto=format&fit=crop&w=900&q=80',
  socks1: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=900&q=80',
  socks2: 'https://images.unsplash.com/photo-1582966772680-860e8367871f?auto=format&fit=crop&w=900&q=80',
  socks3: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=900&q=80',
  socks4: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=900&q=80',
  socks5: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80',
  socks6: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80',
  hat1: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=900&q=80',
  hat2: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&w=900&q=80',
  hat3: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=80',
  hat4: 'https://images.unsplash.com/photo-1534215754734-18e55d13e346?auto=format&fit=crop&w=900&q=80',
  hat5: 'https://images.unsplash.com/photo-1556306535-0f09a537f0a3?auto=format&fit=crop&w=900&q=80',
  hat6: 'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?auto=format&fit=crop&w=900&q=80',
} as const;

const ANGLE_SETS: Record<string, string[]> = {
  't-shirts': [IMG.tee1, IMG.tee2, IMG.tee3, IMG.tee4, IMG.tee5, IMG.tee6],
  hoodies: [IMG.hoodie1, IMG.hoodie2, IMG.hoodie3, IMG.hoodie4, IMG.hoodie5, IMG.hoodie6],
  socks: [IMG.socks1, IMG.socks2, IMG.socks3, IMG.socks4, IMG.socks5, IMG.socks6],
  headwear: [IMG.hat1, IMG.hat2, IMG.hat3, IMG.hat4, IMG.hat5, IMG.hat6],
};

/** Build a 6-frame orbit starting from the product hero image. */
function orbitFrames(primary: string, categorySlug: string): string[] {
  const pool = ANGLE_SETS[categorySlug] ?? [primary];
  const rest = pool.filter((uri) => uri !== primary);
  return [primary, ...rest].slice(0, 6);
}

export const EXAMPLE_CATEGORIES: StoreCategory[] = [
  {
    id: 'cat-tees',
    slug: 't-shirts',
    name: 'T-Shirts',
    sort_order: 10,
    active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cat-hoodies',
    slug: 'hoodies',
    name: 'Hoodies',
    sort_order: 20,
    active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cat-socks',
    slug: 'socks',
    name: 'Socks',
    sort_order: 30,
    active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'cat-hats',
    slug: 'headwear',
    name: 'Headwear',
    sort_order: 40,
    active: true,
    created_at: now,
    updated_at: now,
  },
];

type SeedDef = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  categorySlug: string;
  price_cents: number;
  compare_at_cents?: number;
  featured?: boolean;
  is_new?: boolean;
  is_limited?: boolean;
  is_bestseller?: boolean;
  is_best_of_month?: boolean;
  details: string;
  materials: string;
  care: string;
  image: string;
  stock: number;
};

const SEEDS: SeedDef[] = [
  {
    id: 'prod-tee-core',
    slug: 'core-oversized-tee',
    name: 'Core Oversized Tee',
    subtitle: 'Heavyweight athletic cut',
    description: 'Relaxed athletic fit with minimal REFORGE branding. Built for training days and beyond.',
    categorySlug: 't-shirts',
    price_cents: 3900,
    featured: true,
    is_new: true,
    is_best_of_month: true,
    details: 'Oversized silhouette. Dropped shoulder. Clean hem.',
    materials: '100% premium cotton, 220gsm',
    care: 'Machine wash cold. Hang dry.',
    image: IMG.tee1,
    stock: 24,
  },
  {
    id: 'prod-tee-cut',
    slug: 'training-cut-tee',
    name: 'Training Cut Tee',
    subtitle: 'Performance fit',
    description: 'Slightly tapered through the body for unrestricted movement under load.',
    categorySlug: 't-shirts',
    price_cents: 3400,
    details: 'Athletic fit. Breathable knit.',
    materials: 'Cotton-elastane blend',
    care: 'Machine wash cold.',
    image: IMG.tee2,
    stock: 18,
  },
  {
    id: 'prod-tee-crew',
    slug: 'essentials-crew-tee',
    name: 'Essentials Crew Tee',
    subtitle: 'Everyday staple',
    description: 'The daily driver. Soft hand-feel with a structured crew neck.',
    categorySlug: 't-shirts',
    price_cents: 2900,
    compare_at_cents: 3400,
    details: 'Classic crew. Midweight.',
    materials: 'Organic cotton jersey',
    care: 'Wash inside out.',
    image: IMG.tee3,
    stock: 40,
  },
  {
    id: 'prod-hood-forge',
    slug: 'forge-heavy-hoodie',
    name: 'Forge Heavy Hoodie',
    subtitle: 'Studio weight',
    description: 'Dense fleece for cool mornings and post-session recovery.',
    categorySlug: 'hoodies',
    price_cents: 7900,
    featured: true,
    is_bestseller: true,
    details: 'Kangaroo pocket. Ribbed cuffs.',
    materials: 'Cotton fleece, 380gsm',
    care: 'Wash cold. Tumble low.',
    image: IMG.hoodie1,
    stock: 14,
  },
  {
    id: 'prod-hood-zip',
    slug: 'studio-zip-hoodie',
    name: 'Studio Zip Hoodie',
    subtitle: 'Layer ready',
    description: 'Full-zip layering piece with a clean REFORGE mark at the chest.',
    categorySlug: 'hoodies',
    price_cents: 6900,
    is_new: true,
    details: 'YKK zip. Lined hood.',
    materials: 'French terry',
    care: 'Machine wash cold.',
    image: IMG.hoodie2,
    stock: 11,
  },
  {
    id: 'prod-hood-warm',
    slug: 'warm-up-fleece',
    name: 'Warm-Up Fleece',
    subtitle: 'Pre-session cover',
    description: 'Lightweight fleece to stay sharp during warm-ups without bulk.',
    categorySlug: 'hoodies',
    price_cents: 5900,
    details: 'Quarter details. Soft brushed interior.',
    materials: 'Recycled polyester blend',
    care: 'Wash cold.',
    image: IMG.hoodie3,
    stock: 3,
  },
  {
    id: 'prod-socks-crew',
    slug: 'performance-crew-socks',
    name: 'Performance Crew Socks',
    subtitle: '3-pack',
    description: 'Cushioned sole and arch support for long training blocks.',
    categorySlug: 'socks',
    price_cents: 1800,
    is_new: true,
    featured: true,
    is_bestseller: true,
    details: 'Crew height. Reinforced heel and toe.',
    materials: 'Cotton / nylon / elastane',
    care: 'Machine wash warm.',
    image: IMG.socks1,
    stock: 60,
  },
  {
    id: 'prod-socks-ankle',
    slug: 'ankle-training-socks',
    name: 'Ankle Training Socks',
    subtitle: 'Low profile',
    description: 'Low-cut socks that stay put through conditioning.',
    categorySlug: 'socks',
    price_cents: 1400,
    details: 'Ankle height. Grip tab.',
    materials: 'Performance knit',
    care: 'Machine wash.',
    image: IMG.socks2,
    stock: 48,
  },
  {
    id: 'prod-socks-comp',
    slug: 'recovery-compression-socks',
    name: 'Recovery Compression Socks',
    subtitle: 'Post-session',
    description: 'Graduated compression for recovery days and travel.',
    categorySlug: 'socks',
    price_cents: 2400,
    details: 'Knee-high. Targeted zones.',
    materials: 'Nylon / elastane',
    care: 'Hand wash preferred.',
    image: IMG.socks3,
    stock: 22,
  },
  {
    id: 'prod-hat-cap',
    slug: 'reforge-cap',
    name: 'REFORGE Cap',
    subtitle: 'Structured 6-panel',
    description: 'Clean structured cap with tonal REFORGE embroidery.',
    categorySlug: 'headwear',
    price_cents: 3200,
    featured: true,
    is_bestseller: true,
    details: 'Adjustable strap. Pre-curved brim.',
    materials: 'Cotton twill',
    care: 'Spot clean.',
    image: IMG.hat1,
    stock: 16,
  },
  {
    id: 'prod-hat-beanie',
    slug: 'training-beanie',
    name: 'Training Beanie',
    subtitle: 'Cold start',
    description: 'Soft ribbed beanie for early sessions and outdoor warm-ups.',
    categorySlug: 'headwear',
    price_cents: 2800,
    is_new: true,
    details: 'Double-layer cuff. Soft touch.',
    materials: 'Acrylic knit',
    care: 'Hand wash.',
    image: IMG.hat2,
    stock: 20,
  },
  {
    id: 'prod-hat-dad',
    slug: 'studio-dad-hat',
    name: 'Studio Dad Hat',
    subtitle: 'Soft crown',
    description: 'Unstructured dad hat — limited Essentials drop.',
    categorySlug: 'headwear',
    price_cents: 3000,
    is_limited: true,
    details: 'Soft crown. Metal buckle.',
    materials: 'Washed cotton',
    care: 'Spot clean.',
    image: IMG.hat3,
    stock: 8,
  },
];

function buildCatalog() {
  const products: StoreProduct[] = [];
  const images: StoreProductImage[] = [];
  const variants: StoreProductVariant[] = [];

  for (const seed of SEEDS) {
    const category = EXAMPLE_CATEGORIES.find((c) => c.slug === seed.categorySlug)!;
    const product: StoreProduct = {
      id: seed.id,
      slug: seed.slug,
      name: seed.name,
      subtitle: seed.subtitle,
      description: seed.description,
      category_id: category.id,
      collection_id: null,
      size_guide_id: null,
      status: 'active',
      price_cents: seed.price_cents,
      compare_at_cents: seed.compare_at_cents ?? null,
      currency: 'EUR',
      featured: seed.featured ?? false,
      is_new: seed.is_new ?? false,
      is_limited: seed.is_limited ?? false,
      is_bestseller: seed.is_bestseller ?? false,
      is_best_of_month: seed.is_best_of_month ?? false,
      details: seed.details,
      materials: seed.materials,
      care_instructions: seed.care,
      release_at: null,
      published_at: now,
      created_at: now,
      updated_at: now,
      category,
      primary_image_url: seed.image,
      total_stock: seed.stock,
    };
    products.push(product);

    orbitFrames(seed.image, seed.categorySlug).forEach((uri, index) => {
      images.push({
        id: `img-${seed.id}-${index}`,
        product_id: seed.id,
        storage_path: `external/${seed.slug}-${index}`,
        public_url: uri,
        alt_text: `${seed.name} — angle ${index + 1}`,
        sort_order: index,
        is_primary: index === 0,
        created_at: now,
      });
    });

    const sizes =
      seed.categorySlug === 'socks' || seed.categorySlug === 'headwear'
        ? ['ONE']
        : ['S', 'M', 'L', 'XL'];
    const colors = seed.categorySlug === 'socks' ? ['Black'] : ['Black', 'White'];
    let remaining = seed.stock;
    for (const color of colors) {
      for (const size of sizes) {
        const share = Math.max(1, Math.floor(seed.stock / (colors.length * sizes.length)));
        const qty = Math.min(share, remaining);
        remaining -= qty;
        variants.push({
          id: `var-${seed.id}-${color}-${size}`.toLowerCase(),
          product_id: seed.id,
          sku: `RFG-${seed.slug.slice(0, 8)}-${color.slice(0, 3)}-${size}`.toUpperCase(),
          size_label: size === 'ONE' ? null : size,
          color_label: color,
          color_hex: color === 'Black' ? '#111111' : '#F5F5F5',
          stock_qty: qty,
          price_override_cents: null,
          image_url: seed.image,
          active: true,
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  return { products, images, variants };
}

const built = buildCatalog();

export const EXAMPLE_PRODUCTS = built.products;
export const EXAMPLE_IMAGES = built.images;
export const EXAMPLE_VARIANTS = built.variants;
