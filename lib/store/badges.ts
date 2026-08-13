import { stockBadgeText } from '@/lib/store/money';
import type { StoreProduct } from '@/types';

export type StoreBadgeTone = 'accent' | 'solid' | 'warn' | 'danger' | 'muted' | 'hot';

export type StoreProductBadge = {
  id: string;
  label: string;
  tone: StoreBadgeTone;
};

type Options = {
  lowStockThreshold?: number;
  showExactStock?: boolean;
  /** Max badges to show on cards */
  limit?: number;
};

/**
 * Build premium merchandising badges for product cards / PDP.
 * Priority: stock urgency → monthly bestseller → bestseller → limited → new → featured.
 */
export function getStoreProductBadges(
  product: StoreProduct,
  opts: Options = {},
): StoreProductBadge[] {
  const lowStockThreshold = opts.lowStockThreshold ?? 5;
  const showExactStock = opts.showExactStock ?? false;
  const limit = opts.limit ?? 3;
  const total = product.total_stock ?? 0;
  const stockText = stockBadgeText(total, lowStockThreshold, showExactStock);
  const badges: StoreProductBadge[] = [];

  if (stockText === 'SOLD OUT') {
    badges.push({ id: 'sold_out', label: 'SOLD OUT', tone: 'danger' });
  } else if (stockText) {
    badges.push({ id: 'low_stock', label: stockText, tone: 'warn' });
  }

  if (product.is_best_of_month) {
    badges.push({ id: 'best_month', label: 'BEST OF THE MONTH', tone: 'hot' });
  } else if (product.is_bestseller) {
    badges.push({ id: 'bestseller', label: 'BEST SELLER', tone: 'solid' });
  } else if (product.featured) {
    badges.push({ id: 'featured', label: 'FEATURED', tone: 'solid' });
  }

  if (product.is_limited) {
    badges.push({ id: 'limited', label: 'LIMITED DROP', tone: 'warn' });
  }

  if (product.is_new) {
    badges.push({ id: 'new', label: 'NEW', tone: 'accent' });
  }

  return badges.slice(0, limit);
}
