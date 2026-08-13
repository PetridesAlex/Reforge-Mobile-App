import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ProductSpinViewer } from '@/components/store/ProductSpinViewer';
import { StoreBagButton } from '@/components/store/StoreBagButton';
import { StoreBadge } from '@/components/store/StoreBadge';
import { StoreDeliveryPromise } from '@/components/store/StoreDeliveryPromise';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useStoreCart } from '@/hooks/useStoreCart';
import { trackStoreEvent } from '@/lib/store/analytics';
import { getStoreProductBadges } from '@/lib/store/badges';
import { formatStoreMoney, variantEffectivePriceCents } from '@/lib/store/money';
import * as commerce from '@/services/store.commerce';
import * as store from '@/services/store';
import type { StoreProduct } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function MemberProductDetail() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { addItem } = useStoreCart();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [threshold, setThreshold] = useState(5);
  const [showExact, setShowExact] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('REFORGE Limassol');
  const [deliveryCents, setDeliveryCents] = useState(500);

  const load = useCallback(async () => {
    if (!productId) return;
    try {
      setError(null);
      const [p, inv, fulfillment] = await Promise.all([
        store.getProduct(productId),
        store.getInventorySettings(),
        store.getFulfillmentSettings(),
      ]);
      if (!p) throw new Error('Product not found');
      setProduct(p);
      setThreshold(inv.low_stock_threshold);
      setShowExact(inv.show_exact_stock);
      setPickupLocation(fulfillment.pickup_location);
      setDeliveryCents(fulfillment.standard_delivery_cents);
      trackStoreEvent('product_viewed', { product_id: p.id });
      const colorsList = [
        ...new Set((p.variants ?? []).filter((v) => v.active).map((v) => v.color_label).filter(Boolean)),
      ] as string[];
      const sizesList = [
        ...new Set((p.variants ?? []).filter((v) => v.active).map((v) => v.size_label).filter(Boolean)),
      ] as string[];
      setColor(colorsList[0] ?? null);
      setSize(sizesList[0] ?? null);
      if (profile) {
        setFavorited(await commerce.isFavorite(profile.id, p.id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const colorsList = useMemo(
    () =>
      [
        ...new Set(
          (product?.variants ?? [])
            .filter((v) => v.active)
            .map((v) => v.color_label)
            .filter(Boolean),
        ),
      ] as string[],
    [product],
  );

  const sizesList = useMemo(
    () =>
      [
        ...new Set(
          (product?.variants ?? [])
            .filter((v) => v.active)
            .map((v) => v.size_label)
            .filter(Boolean),
        ),
      ] as string[],
    [product],
  );

  const selectedVariant = useMemo(() => {
    if (!product?.variants) return null;
    return (
      product.variants.find(
        (v) =>
          v.active &&
          (color == null || v.color_label === color) &&
          (size == null || v.size_label === size),
      ) ?? null
    );
  }, [product, color, size]);

  const priceCents = selectedVariant
    ? variantEffectivePriceCents(product?.price_cents ?? 0, selectedVariant.price_override_cents)
    : product?.price_cents ?? 0;
  const stockQty = selectedVariant?.stock_qty ?? product?.total_stock ?? 0;
  const soldOut = stockQty <= 0;
  const merchBadges = product
    ? getStoreProductBadges(
        { ...product, total_stock: stockQty },
        { lowStockThreshold: threshold, showExactStock: showExact, limit: 4 },
      )
    : [];

  const onAdd = async () => {
    if (!product || !selectedVariant || soldOut) return;
    await addItem({
      product_id: product.id,
      variant_id: selectedVariant.id,
      product_name: product.name,
      size_label: selectedVariant.size_label,
      color_label: selectedVariant.color_label,
      sku: selectedVariant.sku,
      unit_price_cents: priceCents,
      image_url: selectedVariant.image_url ?? product.primary_image_url ?? null,
      quantity: qty,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToastOpen(true);
  };

  const onFavorite = async () => {
    if (!profile || !product) return;
    const next = await commerce.toggleFavorite(profile.id, product.id);
    setFavorited(next);
    if (next) trackStoreEvent('product_favorited', { product_id: product.id });
    void Haptics.selectionAsync();
  };

  if (loading) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={width - 32} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error || !product) {
    return (
      <Screen>
        <BackButton />
        <ErrorState message={error ?? 'Not found'} onRetry={load} />
      </Screen>
    );
  }

  const images = [...(product.images ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton />
        <View style={styles.topActions}>
          <Pressable
            onPress={() => void onFavorite()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
            <Ionicons
              name={favorited ? 'heart' : 'heart-outline'}
              size={20}
              color={favorited ? colors.danger : colors.accent}
            />
          </Pressable>
          <StoreBagButton />
        </View>
      </View>

      {images.length > 0 ? (
        <ProductSpinViewer
          uris={images.map((img) => img.public_url)}
          width={width - spacing.md * 2}
          height={420}
          alt={product.name}
        />
      ) : (
        <View style={[styles.galleryPlaceholder, { width: width - spacing.md * 2 }]} />
      )}

      <View style={styles.titleBlock}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>REFORGE</Text>
          {product.category?.name ? (
            <>
              <View style={styles.brandDot} />
              <Text style={styles.category}>{product.category.name.toUpperCase()}</Text>
            </>
          ) : null}
        </View>

        <Text style={styles.name}>{product.name}</Text>

        {product.subtitle ? <Text style={styles.subtitle}>{product.subtitle}</Text> : null}

        <View style={styles.priceRow}>
          <View style={styles.priceGroup}>
            <Text style={styles.price}>{formatStoreMoney(priceCents, product.currency)}</Text>
            {product.compare_at_cents != null && product.compare_at_cents > priceCents ? (
              <Text style={styles.compare}>
                {formatStoreMoney(product.compare_at_cents, product.currency)}
              </Text>
            ) : null}
          </View>
          <View style={styles.badgeRow}>
            {merchBadges.map((badge) => (
              <StoreBadge key={badge.id} label={badge.label} tone={badge.tone} />
            ))}
          </View>
        </View>
      </View>

      {colorsList.length > 0 ? (
        <>
          <Text style={styles.label}>COLOR</Text>
          <View style={styles.chips}>
            {colorsList.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[styles.chip, color === c && styles.chipActive]}>
                <Text style={[styles.chipText, color === c && styles.chipTextActive]}>
                  {c.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {sizesList.length > 0 ? (
        <>
          <Text style={styles.label}>SIZE</Text>
          <View style={styles.chips}>
            {sizesList.map((s) => {
              const available = product.variants?.some(
                (v) =>
                  v.active &&
                  v.size_label === s &&
                  (color == null || v.color_label === color) &&
                  v.stock_qty > 0,
              );
              return (
                <Pressable
                  key={s}
                  onPress={() => setSize(s)}
                  style={[
                    styles.sizeChip,
                    size === s && styles.chipActive,
                    !available && styles.sizeDisabled,
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      size === s && styles.chipTextActive,
                      !available && { color: colors.textMuted },
                    ]}>
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>QUANTITY</Text>
      <View style={styles.qtyRow}>
        <Pressable
          onPress={() => setQty((q) => Math.max(1, q - 1))}
          style={styles.qtyBtn}>
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>
        <Text style={styles.qty}>{qty}</Text>
        <Pressable
          onPress={() => setQty((q) => Math.min(stockQty || 1, q + 1))}
          style={styles.qtyBtn}>
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => void onAdd()}
        disabled={soldOut || !selectedVariant}
        style={({ pressed }) => [
          styles.cta,
          (soldOut || !selectedVariant) && styles.ctaDisabled,
          pressed && !(soldOut || !selectedVariant) && styles.ctaPressed,
        ]}>
        <View style={styles.ctaLead}>
          <Ionicons
            name={soldOut ? 'ban-outline' : 'bag-handle-outline'}
            size={18}
            color={colors.background}
          />
          <Text style={styles.ctaText}>{soldOut ? 'SOLD OUT' : 'ADD TO BAG'}</Text>
        </View>
        {!soldOut ? (
          <Text style={styles.ctaPrice}>{formatStoreMoney(priceCents * qty, product.currency)}</Text>
        ) : null}
      </Pressable>

      <StoreDeliveryPromise
        pickupLocation={pickupLocation}
        deliveryCents={deliveryCents}
        currency={product.currency}
      />

      {(product.description || product.details || product.materials || product.care_instructions) ? (
        <View style={styles.detailsPanel}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsKicker}>SPEC</Text>
            <Text style={styles.detailsTitle}>PRODUCT DETAILS</Text>
            <View style={styles.detailsRule} />
          </View>

          {product.description ? (
            <Text style={styles.detailsLead}>{product.description}</Text>
          ) : null}

          {product.details ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>CONSTRUCTION</Text>
              <Text style={styles.detailBody}>{product.details}</Text>
            </View>
          ) : null}

          {product.materials ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>MATERIALS</Text>
              <Text style={styles.detailBody}>{product.materials}</Text>
            </View>
          ) : null}

          {product.care_instructions ? (
            <View style={[styles.detailBlock, styles.detailBlockLast]}>
              <Text style={styles.detailLabel}>CARE</Text>
              <Text style={styles.detailBody}>{product.care_instructions}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {!product.variants?.length ? (
        <EmptyState
          icon="shirt-outline"
          title="Variants coming soon"
          description="Sizes and colors will appear once inventory is set."
        />
      ) : null}
      <View style={{ height: spacing.xl }} />

      <Modal visible={toastOpen} transparent animationType="fade">
        <View style={styles.toastBackdrop}>
          <View style={styles.toastCard}>
            <Text style={styles.toastKicker}>ADDED TO YOUR BAG</Text>
            <Text style={styles.toastTitle}>{product.name}</Text>
            <Text style={styles.toastMeta}>
              {[color, size].filter(Boolean).join(' · ').toUpperCase()}
            </Text>
            <PrimaryButton
              title="VIEW BAG"
              onPress={() => {
                setToastOpen(false);
                router.push('/(member)/store/cart');
              }}
            />
            <Pressable onPress={() => setToastOpen(false)} style={styles.toastClose}>
              <Text style={styles.toastCloseText}>KEEP SHOPPING</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: spacing.md,
    zIndex: 2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(200,255,0,0.22)',
    borderColor: 'rgba(200,255,0,0.5)',
    transform: [{ scale: 0.96 }],
  },
  galleryPlaceholder: {
    height: 420,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  titleBlock: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.6,
    color: colors.accent,
  },
  brandDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.55)',
  },
  category: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(163,163,163,0.9)',
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 44,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(245,245,245,0.72)',
    letterSpacing: 0.2,
    maxWidth: 360,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.6,
    color: colors.text,
  },
  compare: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 1,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.textSecondary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeChip: {
    minWidth: 48,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeDisabled: { opacity: 0.45 },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  chipTextActive: { color: colors.accent },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.text, minWidth: 20, textAlign: 'center' },
  cta: {
    marginTop: spacing.lg,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    borderRadius: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  ctaPressed: { opacity: 0.9 },
  ctaDisabled: { opacity: 0.45 },
  ctaLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    letterSpacing: 1.8,
    color: colors.background,
  },
  ctaPrice: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.background,
  },
  detailsPanel: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,255,0,0.18)',
  },
  detailsHeader: {
    marginBottom: spacing.md,
    gap: 6,
  },
  detailsKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.8,
    color: colors.accent,
  },
  detailsTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 1.2,
    color: colors.text,
  },
  detailsRule: {
    width: 40,
    height: 2,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  detailsLead: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(245,245,245,0.86)',
    marginBottom: spacing.lg,
    letterSpacing: 0.2,
  },
  detailBlock: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  detailBlockLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(163,163,163,0.95)',
  },
  detailBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  toastBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  toastCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    gap: spacing.sm,
  },
  toastKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
  },
  toastTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
  },
  toastMeta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  toastClose: { alignItems: 'center', padding: spacing.md },
  toastCloseText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
});
