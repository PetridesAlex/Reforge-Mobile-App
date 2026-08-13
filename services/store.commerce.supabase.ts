import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type {
  StoreCartLine,
  StoreCartValidationIssue,
  StoreFulfillmentMethod,
  StoreOrder,
  StoreOrderEvent,
  StoreOrderItem,
  StoreOrderStatus,
  StoreProduct,
} from '@/types';

export type CreateOrderPayload = {
  userId: string;
  lines: StoreCartLine[];
  fulfillment_method: StoreFulfillmentMethod;
  contact_email: string;
  contact_phone?: string;
  shipping_first_name?: string;
  shipping_last_name?: string;
  shipping_line1?: string;
  shipping_line2?: string;
  shipping_city?: string;
  shipping_postal_code?: string;
  shipping_country?: string;
  discount_code?: string;
  payment_provider?: 'mock' | 'stripe';
};

function mapOrder(row: Record<string, unknown>): StoreOrder {
  return {
    id: row.id as string,
    order_number: row.order_number as string,
    user_id: row.user_id as string,
    status: row.status as StoreOrder['status'],
    fulfillment_method: row.fulfillment_method as StoreOrder['fulfillment_method'],
    currency: (row.currency as string) ?? 'EUR',
    subtotal_cents: row.subtotal_cents as number,
    delivery_cents: row.delivery_cents as number,
    discount_cents: row.discount_cents as number,
    total_cents: row.total_cents as number,
    discount_code: (row.discount_code as string | null) ?? null,
    contact_email: row.contact_email as string,
    contact_phone: (row.contact_phone as string | null) ?? null,
    shipping_first_name: (row.shipping_first_name as string | null) ?? null,
    shipping_last_name: (row.shipping_last_name as string | null) ?? null,
    shipping_line1: (row.shipping_line1 as string | null) ?? null,
    shipping_line2: (row.shipping_line2 as string | null) ?? null,
    shipping_city: (row.shipping_city as string | null) ?? null,
    shipping_postal_code: (row.shipping_postal_code as string | null) ?? null,
    shipping_country: (row.shipping_country as string | null) ?? null,
    pickup_location: (row.pickup_location as string | null) ?? null,
    payment_provider: row.payment_provider as StoreOrder['payment_provider'],
    payment_status: row.payment_status as StoreOrder['payment_status'],
    paid_at: (row.paid_at as string | null) ?? null,
    internal_notes: (row.internal_notes as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    items: row.items as StoreOrderItem[] | undefined,
    events: row.events as StoreOrderEvent[] | undefined,
    customer_name: (row.customer_name as string | undefined) ?? undefined,
  };
}

export async function pullCart(userId: string): Promise<StoreCartLine[]> {
  const supabase = getSupabase();
  const { data: cart, error: cartErr } = await supabase
    .from('store_carts')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (cartErr) throw new Error(formatSupabaseError(cartErr));
  if (!cart) return [];

  const { data, error } = await supabase
    .from('store_cart_items')
    .select(
      `
      id, quantity, product_id, variant_id,
      product:store_products(name, price_cents),
      variant:store_product_variants(sku, size_label, color_label, price_override_cents, image_url, stock_qty, active)
    `,
    )
    .eq('cart_id', cart.id);
  if (error) throw new Error(formatSupabaseError(error));

  return (data ?? []).map((row) => {
    const product = row.product as unknown as { name: string; price_cents: number } | null;
    const variant = row.variant as unknown as {
      sku: string;
      size_label: string | null;
      color_label: string | null;
      price_override_cents: number | null;
      image_url: string | null;
    } | null;
    return {
      id: row.id as string,
      product_id: row.product_id as string,
      variant_id: row.variant_id as string,
      product_name: product?.name ?? 'Product',
      size_label: variant?.size_label ?? null,
      color_label: variant?.color_label ?? null,
      sku: variant?.sku ?? null,
      unit_price_cents: variant?.price_override_cents ?? product?.price_cents ?? 0,
      quantity: row.quantity as number,
      image_url: variant?.image_url ?? null,
    };
  });
}

export async function pushCart(userId: string, lines: StoreCartLine[]): Promise<void> {
  const supabase = getSupabase();
  const { data: cartId, error: ensureErr } = await supabase.rpc('ensure_store_cart', {
    p_user_id: userId,
  });
  if (ensureErr) throw new Error(formatSupabaseError(ensureErr));

  await supabase.from('store_cart_items').delete().eq('cart_id', cartId);
  if (!lines.length) return;

  const { error } = await supabase.from('store_cart_items').insert(
    lines.map((l) => ({
      cart_id: cartId,
      product_id: l.product_id,
      variant_id: l.variant_id,
      quantity: l.quantity,
    })),
  );
  if (error) throw new Error(formatSupabaseError(error));
}

export async function validateCart(lines: StoreCartLine[]) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('validate_store_cart_lines', {
    p_lines: lines.map((l) => ({
      variant_id: l.variant_id,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
    })),
  });
  if (error) throw new Error(formatSupabaseError(error));
  const payload = data as {
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
  };
  return { issues: payload.issues ?? [], lines: payload.lines ?? [] };
}

export async function createOrder(input: CreateOrderPayload): Promise<StoreOrder> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('create_store_order', {
    p_payload: {
      lines: input.lines.map((l) => ({
        variant_id: l.variant_id,
        quantity: l.quantity,
        unit_price_cents: l.unit_price_cents,
      })),
      fulfillment_method: input.fulfillment_method,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone ?? null,
      shipping_first_name: input.shipping_first_name ?? null,
      shipping_last_name: input.shipping_last_name ?? null,
      shipping_line1: input.shipping_line1 ?? null,
      shipping_line2: input.shipping_line2 ?? null,
      shipping_city: input.shipping_city ?? null,
      shipping_postal_code: input.shipping_postal_code ?? null,
      shipping_country: input.shipping_country ?? 'CY',
      discount_code: input.discount_code ?? null,
      payment_provider: input.payment_provider ?? 'mock',
    },
  });
  if (error) throw new Error(formatSupabaseError(error));
  return mapOrder(data as Record<string, unknown>);
}

export async function markOrderPaid(orderId: string, provider: 'mock' | 'stripe') {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('mark_store_order_paid', {
    p_order_id: orderId,
    p_provider: provider,
    p_stripe_payment_intent_id: null,
    p_stripe_checkout_session_id: null,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return mapOrder(data as Record<string, unknown>);
}

export async function listMyOrders(userId: string): Promise<StoreOrder[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_orders')
    .select('*, items:store_order_items(*), events:store_order_events(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => mapOrder(row as Record<string, unknown>));
}

export async function getOrder(orderId: string, _userId?: string): Promise<StoreOrder | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_orders')
    .select(
      '*, items:store_order_items(*), events:store_order_events(*), customer:profiles!store_orders_user_id_fkey(full_name, email)',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) return null;
  const customer = data.customer as { full_name?: string; email?: string } | null;
  return mapOrder({
    ...(data as Record<string, unknown>),
    customer_name: customer?.full_name ?? undefined,
    contact_email: (data.contact_email as string) || customer?.email || '',
  });
}

export async function updateOrderInternalNotes(
  orderId: string,
  notes: string,
): Promise<StoreOrder> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_orders')
    .update({ internal_notes: notes.trim() || null })
    .eq('id', orderId)
    .select(
      '*, items:store_order_items(*), events:store_order_events(*), customer:profiles!store_orders_user_id_fkey(full_name)',
    )
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  const customer = data.customer as { full_name?: string } | null;
  return mapOrder({
    ...(data as Record<string, unknown>),
    customer_name: customer?.full_name,
  });
}

export async function listAdminOrders(status?: StoreOrderStatus | 'all'): Promise<StoreOrder[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('store_orders')
    .select(
      '*, items:store_order_items(*), events:store_order_events(*), customer:profiles!store_orders_user_id_fkey(full_name)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => {
    const customer = row.customer as { full_name?: string } | null;
    return mapOrder({
      ...(row as Record<string, unknown>),
      customer_name: customer?.full_name,
    });
  });
}

export async function updateOrderStatus(
  orderId: string,
  status: StoreOrderStatus,
  note?: string,
): Promise<StoreOrder> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('update_store_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return mapOrder(data as Record<string, unknown>);
}

export async function listFavorites(userId: string): Promise<StoreProduct[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_favorites')
    .select(
      `
      product_id,
      product:store_products(
        *,
        category:store_categories(*),
        images:store_product_images(*),
        variants:store_product_variants(*)
      )
    `,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? [])
    .map((row) => row.product as unknown as StoreProduct | null)
    .filter(Boolean) as StoreProduct[];
}

export async function toggleFavorite(userId: string, productId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('store_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from('store_favorites').delete().eq('id', existing.id);
    if (error) throw new Error(formatSupabaseError(error));
    return false;
  }
  const { error } = await supabase.from('store_favorites').insert({
    user_id: userId,
    product_id: productId,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return true;
}

export async function isFavorite(userId: string, productId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('store_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return Boolean(data);
}

export async function previewDiscount(code: string, subtotalCents: number, deliveryCents: number) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('preview_store_discount', {
    p_code: code,
    p_subtotal_cents: subtotalCents,
    p_delivery_cents: deliveryCents,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return data as
    | {
        ok: true;
        code: string;
        kind: string;
        discount_cents: number;
        delivery_cents: number;
      }
    | { ok: false; message: string };
}
