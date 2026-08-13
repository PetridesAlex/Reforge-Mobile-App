import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MediaImage } from '@/components/ui/MediaImage';
import { StoreBadge } from '@/components/store/StoreBadge';
import { getStoreProductBadges } from '@/lib/store/badges';
import { formatStoreMoney } from '@/lib/store/money';
import type { StoreProduct } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  product: StoreProduct;
  onPress?: () => void;
  lowStockThreshold?: number;
  showExactStock?: boolean;
};

export function ProductCard({
  product,
  onPress,
  lowStockThreshold = 5,
  showExactStock = false,
}: Props) {
  const badges = getStoreProductBadges(product, {
    lowStockThreshold,
    showExactStock,
    limit: 3,
  });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        <MediaImage uri={product.primary_image_url} style={styles.image} rounded={0} />
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent']}
          style={styles.scrim}
          pointerEvents="none"
        />
        <View style={styles.badges}>
          {badges.map((badge) => (
            <StoreBadge key={badge.id} label={badge.label} tone={badge.tone} />
          ))}
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.brand}>REFORGE</Text>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        {product.category?.name ? (
          <Text style={styles.category}>{product.category.name.toUpperCase()}</Text>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatStoreMoney(product.price_cents, product.currency)}</Text>
          {product.compare_at_cents != null && product.compare_at_cents > product.price_cents ? (
            <Text style={styles.compare}>
              {formatStoreMoney(product.compare_at_cents, product.currency)}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.9 },
  imageWrap: {
    aspectRatio: 3 / 4,
    backgroundColor: colors.surfaceElevated,
  },
  image: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 88,
  },
  badges: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    gap: 5,
    zIndex: 2,
  },
  copy: {
    padding: spacing.md,
    gap: 4,
  },
  brand: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
    textTransform: 'uppercase',
  },
  category: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  price: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  compare: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
