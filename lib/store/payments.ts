import type { StorePaymentProvider } from '@/types';
import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';

/** Development / pre-Stripe checkout — confirms payment via secure RPC (mock provider only). */
export const mockPaymentProvider: StorePaymentProvider = {
  id: 'mock',
  async createCheckoutSession(input) {
    return { mockComplete: true, checkoutUrl: undefined };
  },
};

/**
 * Stripe provider stub — calls Edge Function `store-checkout`.
 * Secret keys never leave the server.
 */
export const stripePaymentProvider: StorePaymentProvider = {
  id: 'stripe',
  async createCheckoutSession(input) {
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke('store-checkout', {
      body: {
        orderId: input.orderId,
        amountCents: input.amountCents,
        currency: input.currency,
      },
    });
    if (error) throw new Error(formatSupabaseError(error));
    return data as { clientSecret?: string; checkoutUrl?: string };
  },
};

export function getActiveStorePaymentProvider(): StorePaymentProvider {
  const mode = process.env.EXPO_PUBLIC_STORE_PAYMENT_PROVIDER;
  if (mode === 'stripe') return stripePaymentProvider;
  return mockPaymentProvider;
}
