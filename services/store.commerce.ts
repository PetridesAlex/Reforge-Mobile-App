import { useSupabaseStore } from '@/lib/store/config';
import { EXAMPLE_PRODUCTS, EXAMPLE_VARIANTS, EXAMPLE_IMAGES } from '@/services/mock/storeCatalog';
import * as commerceSupabase from '@/services/store.commerce.supabase';
import type { CreateOrderPayload } from '@/services/store.commerce.supabase';
import type {
  StoreCartLine,
  StoreCartValidationIssue,
  StoreOrder,
  StoreOrderStatus,
  StoreProduct,
} from '@/types';

export type CreateOrderInput = CreateOrderPayload;

let mockOrders: StoreOrder[] = [];
let mockFavorites = new Map<string, Set<string>>();
let mockOrderSeq = 1048;

/** Snapshot for admin dashboard KPIs (mock mode). */
export function getMockOrdersSnapshot(): StoreOrder[] {
  return mockOrders;
}

function isDemoCatalogLine(lines: StoreCartLine[]) {
  return lines.some((l) => l.product_id.startsWith('prod-') || l.variant_id.startsWith('var-'));
}

export async function pullCart(userId: string): Promise<StoreCartLine[]> {
  if (useSupabaseStore()) {
    try {
      return await commerceSupabase.pullCart(userId);
    } catch {
      return [];
    }
  }
  return [];
}

export async function pushCart(userId: string, lines: StoreCartLine[]): Promise<void> {
  if (!useSupabaseStore() || isDemoCatalogLine(lines)) return;
  await commerceSupabase.pushCart(userId, lines);
}

export async function validateCart(lines: StoreCartLine[]): Promise<{
  issues: StoreCartValidationIssue[];
  lines: Array<{
    product_id: string;
    variant_id: string;
    product_name: string;
    sku: string | null;
    size_label: string | null;
    color_label: string | null;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
    image_url: string | null;
  }>;
}> {
  if (useSupabaseStore() && !isDemoCatalogLine(lines)) {
    return commerceSupabase.validateCart(lines);
  }

  const issues: StoreCartValidationIssue[] = [];
  const priced: Array<{
    product_id: string;
    variant_id: string;
    product_name: string;
    sku: string | null;
    size_label: string | null;
    color_label: string | null;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
    image_url: string | null;
  }> = [];

  for (const line of lines) {
    const variant = EXAMPLE_VARIANTS.find((v) => v.id === line.variant_id);
    const product = EXAMPLE_PRODUCTS.find((p) => p.id === line.product_id);
    if (!variant?.active || !product || product.status !== 'active') {
      issues.push({
        variant_id: line.variant_id,
        code: 'unavailable',
        message: `${line.product_name} is no longer available.`,
      });
      continue;
    }
    const unit = variant.price_override_cents ?? product.price_cents;
    if (unit !== line.unit_price_cents) {
      issues.push({
        variant_id: line.variant_id,
        code: 'price_changed',
        message: `Price changed from €${(line.unit_price_cents / 100).toFixed(2)} to €${(unit / 100).toFixed(2)}.`,
        previous_cents: line.unit_price_cents,
        current_cents: unit,
      });
    }
    let qty = line.quantity;
    if (variant.stock_qty < qty) {
      issues.push({
        variant_id: line.variant_id,
        code: 'stock',
        message:
          variant.stock_qty <= 0
            ? 'Size is no longer available.'
            : `Only ${variant.stock_qty} left in stock.`,
        available: variant.stock_qty,
      });
      qty = variant.stock_qty;
    }
    if (qty > 0) {
      priced.push({
        product_id: product.id,
        variant_id: variant.id,
        product_name: product.name,
        sku: variant.sku,
        size_label: variant.size_label,
        color_label: variant.color_label,
        unit_price_cents: unit,
        quantity: qty,
        line_total_cents: unit * qty,
        image_url:
          EXAMPLE_IMAGES.find((i) => i.product_id === product.id && i.is_primary)?.public_url ??
          null,
      });
    }
  }
  return { issues, lines: priced };
}

export async function createOrder(input: CreateOrderInput): Promise<StoreOrder> {
  if (useSupabaseStore() && !isDemoCatalogLine(input.lines)) {
    return commerceSupabase.createOrder(input);
  }

  const validated = await validateCart(input.lines);
  if (validated.issues.length && validated.lines.length === 0) {
    throw new Error(validated.issues[0]?.message ?? 'Cart is invalid');
  }
  const subtotal = validated.lines.reduce((s, l) => s + l.line_total_cents, 0);
  let delivery = input.fulfillment_method === 'delivery' ? 500 : 0;
  let discount = 0;
  const code = input.discount_code?.trim().toUpperCase();
  if (code === 'REFORGE10') {
    discount = Math.round(subtotal * 0.1);
  }
  const now = new Date().toISOString();
  const customerName =
    [input.shipping_first_name, input.shipping_last_name].filter(Boolean).join(' ').trim() ||
    input.contact_email.split('@')[0] ||
    'Member';
  const orderId = `mock-order-${Date.now()}`;
  const order: StoreOrder = {
    id: orderId,
    order_number: `RF-${mockOrderSeq++}`,
    user_id: input.userId,
    status: 'awaiting_payment',
    fulfillment_method: input.fulfillment_method,
    currency: 'EUR',
    subtotal_cents: subtotal,
    delivery_cents: delivery,
    discount_cents: discount,
    total_cents: Math.max(0, subtotal + delivery - discount),
    discount_code: code ?? null,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone ?? null,
    shipping_first_name: input.shipping_first_name ?? null,
    shipping_last_name: input.shipping_last_name ?? null,
    shipping_line1: input.shipping_line1 ?? null,
    shipping_line2: input.shipping_line2 ?? null,
    shipping_city: input.shipping_city ?? null,
    shipping_postal_code: input.shipping_postal_code ?? null,
    shipping_country: input.shipping_country ?? 'CY',
    pickup_location: input.fulfillment_method === 'pickup' ? 'REFORGE Limassol' : null,
    payment_provider: input.payment_provider ?? 'mock',
    payment_status: 'unpaid',
    paid_at: null,
    internal_notes: null,
    created_at: now,
    updated_at: now,
    customer_name: customerName,
    items: validated.lines.map((l, i) => ({
      id: `mock-item-${orderId}-${i}`,
      order_id: orderId,
      product_id: l.product_id,
      variant_id: l.variant_id,
      product_name: l.product_name,
      sku: l.sku,
      size_label: l.size_label,
      color_label: l.color_label,
      unit_price_cents: l.unit_price_cents,
      quantity: l.quantity,
      line_total_cents: l.line_total_cents,
      created_at: now,
    })),
    events: [
      {
        id: `mock-ev-${orderId}-1`,
        order_id: orderId,
        status: 'awaiting_payment',
        note: 'Order created',
        created_by: input.userId,
        created_at: now,
      },
    ],
  };
  mockOrders = [order, ...mockOrders];
  return order;
}

export async function markOrderPaid(orderId: string, provider: 'mock' | 'stripe' = 'mock') {
  if (useSupabaseStore() && !orderId.startsWith('mock-')) {
    return commerceSupabase.markOrderPaid(orderId, provider);
  }
  mockOrders = mockOrders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          payment_status: 'paid' as const,
          status: 'paid' as const,
          paid_at: new Date().toISOString(),
          payment_provider: provider,
          events: [
            ...(o.events ?? []),
            {
              id: `mock-ev-${Date.now()}`,
              order_id: orderId,
              status: 'paid',
              note: `Payment confirmed (${provider})`,
              created_by: null,
              created_at: new Date().toISOString(),
            },
          ],
        }
      : o,
  );
  const order = mockOrders.find((o) => o.id === orderId);
  if (!order) throw new Error('Order not found');
  return order;
}

export async function listMyOrders(userId: string): Promise<StoreOrder[]> {
  if (useSupabaseStore()) {
    const live = await commerceSupabase.listMyOrders(userId).catch(() => []);
    const local = mockOrders.filter((o) => o.user_id === userId);
    return [...local, ...live].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return mockOrders.filter((o) => o.user_id === userId);
}

export async function getOrder(orderId: string, userId?: string): Promise<StoreOrder | null> {
  if (orderId.startsWith('mock-') || !useSupabaseStore()) {
    return mockOrders.find((o) => o.id === orderId) ?? null;
  }
  return commerceSupabase.getOrder(orderId, userId);
}

export async function listAdminOrders(status?: StoreOrderStatus | 'all'): Promise<StoreOrder[]> {
  if (useSupabaseStore()) {
    return commerceSupabase.listAdminOrders(status);
  }
  return status && status !== 'all' ? mockOrders.filter((o) => o.status === status) : mockOrders;
}

export async function updateOrderStatus(orderId: string, status: StoreOrderStatus, note?: string) {
  if (useSupabaseStore() && !orderId.startsWith('mock-')) {
    return commerceSupabase.updateOrderStatus(orderId, status, note);
  }
  mockOrders = mockOrders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          status,
          updated_at: new Date().toISOString(),
          events: [
            ...(o.events ?? []),
            {
              id: `mock-ev-${Date.now()}`,
              order_id: orderId,
              status,
              note: note ?? null,
              created_by: null,
              created_at: new Date().toISOString(),
            },
          ],
        }
      : o,
  );
  const order = mockOrders.find((o) => o.id === orderId);
  if (!order) throw new Error('Order not found');
  return order;
}

export async function updateOrderInternalNotes(orderId: string, notes: string) {
  if (useSupabaseStore() && !orderId.startsWith('mock-')) {
    return commerceSupabase.updateOrderInternalNotes(orderId, notes);
  }
  mockOrders = mockOrders.map((o) =>
    o.id === orderId
      ? { ...o, internal_notes: notes.trim() || null, updated_at: new Date().toISOString() }
      : o,
  );
  const order = mockOrders.find((o) => o.id === orderId);
  if (!order) throw new Error('Order not found');
  return order;
}

export async function listFavorites(userId: string): Promise<StoreProduct[]> {
  if (useSupabaseStore()) {
    try {
      return await commerceSupabase.listFavorites(userId);
    } catch {
      /* fall through */
    }
  }
  const ids = mockFavorites.get(userId) ?? new Set();
  return EXAMPLE_PRODUCTS.filter((p) => ids.has(p.id));
}

export async function toggleFavorite(userId: string, productId: string): Promise<boolean> {
  if (useSupabaseStore() && !productId.startsWith('prod-')) {
    return commerceSupabase.toggleFavorite(userId, productId);
  }
  const set = mockFavorites.get(userId) ?? new Set<string>();
  if (set.has(productId)) {
    set.delete(productId);
    mockFavorites.set(userId, set);
    return false;
  }
  set.add(productId);
  mockFavorites.set(userId, set);
  return true;
}

export async function isFavorite(userId: string, productId: string): Promise<boolean> {
  if (useSupabaseStore() && !productId.startsWith('prod-')) {
    return commerceSupabase.isFavorite(userId, productId);
  }
  return mockFavorites.get(userId)?.has(productId) ?? false;
}

export async function previewDiscount(code: string, subtotalCents: number, deliveryCents: number) {
  if (useSupabaseStore()) {
    try {
      return await commerceSupabase.previewDiscount(code, subtotalCents, deliveryCents);
    } catch {
      /* mock below */
    }
  }
  if (code.trim().toUpperCase() === 'REFORGE10') {
    return {
      ok: true as const,
      code: 'REFORGE10',
      kind: 'percent' as const,
      discount_cents: Math.round(subtotalCents * 0.1),
      delivery_cents: deliveryCents,
    };
  }
  return { ok: false as const, message: 'Invalid discount code' };
}
