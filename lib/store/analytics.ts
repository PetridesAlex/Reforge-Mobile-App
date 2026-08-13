type StoreAnalyticsEvent =
  | 'store_opened'
  | 'catalog_opened'
  | 'product_viewed'
  | 'product_favorited'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_started'
  | 'checkout_completed'
  | 'product_search'
  | 'category_selected';

/** Lightweight analytics sink — swap for Segment/PostHog later. No PII. */
export function trackStoreEvent(
  event: StoreAnalyticsEvent,
  props?: Record<string, string | number | boolean | null | undefined>,
) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[store-analytics]', event, props ?? {});
  }
}
