/** Format integer minor units (cents) as EUR display. */
export function formatStoreMoney(cents: number, currency = 'EUR'): string {
  const amount = (cents / 100).toFixed(2);
  if (currency === 'EUR') return `€${amount}`;
  return `${amount} ${currency}`;
}

export function slugifyStoreName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function variantEffectivePriceCents(
  productPriceCents: number,
  priceOverrideCents: number | null | undefined,
): number {
  return priceOverrideCents != null ? priceOverrideCents : productPriceCents;
}

export function stockLabel(
  qty: number,
  lowThreshold: number,
  showExact: boolean,
): 'in_stock' | 'low_stock' | 'sold_out' {
  if (qty <= 0) return 'sold_out';
  if (qty <= lowThreshold) return 'low_stock';
  return 'in_stock';
}

export function stockBadgeText(
  qty: number,
  lowThreshold: number,
  showExact: boolean,
): string | null {
  const status = stockLabel(qty, lowThreshold, showExact);
  if (status === 'sold_out') return 'SOLD OUT';
  if (status === 'low_stock') {
    return showExact ? `ONLY ${qty} LEFT` : 'LOW STOCK';
  }
  return null;
}
