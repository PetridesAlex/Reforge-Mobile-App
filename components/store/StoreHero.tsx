import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { StoreHomeHero } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  hero: StoreHomeHero;
  imageUri?: string | null;
  onShop: () => void;
};

export function StoreHero({ hero, imageUri, onShop }: Props) {
  const headline = hero.headline?.trim() || 'REFORGE ESSENTIALS';
  const parts = headline.split(/\s+/);
  const brand = parts[0] ?? 'REFORGE';
  const collection = parts.slice(1).join(' ') || 'ESSENTIALS';

  return (
    <View style={styles.wrap}>
      <View style={styles.media}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]} />
        )}

        <LinearGradient
          colors={['rgba(5,5,5,0.2)', 'rgba(5,5,5,0.72)', 'rgba(5,5,5,0.98)']}
          locations={[0, 0.42, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(200,255,0,0.22)', 'transparent', 'transparent']}
          locations={[0, 0.28, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.35)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.topRail} />
        <View style={styles.accentRail} />
        <View style={styles.cornerTL} />
        <View style={styles.cornerBR} />

        <View style={styles.copy}>
          <View style={styles.metaRow}>
            <View style={styles.metaDot} />
            <Text style={styles.collectionLabel}>DROP 01  ·  TRAINING GEAR</Text>
          </View>

          <View style={styles.lockup}>
            <Text style={styles.brand}>{brand}</Text>
            <Text style={styles.collection}>{collection}</Text>
          </View>

          <View style={styles.ruleRow}>
            <View style={styles.rule} />
            <Text style={styles.ruleMark}>RFG</Text>
          </View>

          <Text style={styles.subtitle}>{hero.subtitle}</Text>

          <Pressable onPress={onShop} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
            <Text style={styles.ctaText}>{hero.cta}</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.background} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  media: {
    minHeight: 360,
    justifyContent: 'flex-end',
    backgroundColor: '#070707',
  },
  fallback: {
    backgroundColor: '#101010',
  },
  topRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  accentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  cornerTL: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 18,
    height: 18,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: 'rgba(200,255,0,0.55)',
  },
  cornerBR: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 18,
    height: 18,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  copy: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg + 2,
    paddingTop: spacing.xl,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  collectionLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.8,
    color: colors.accent,
  },
  lockup: {
    gap: 0,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 58,
    lineHeight: 56,
    color: colors.text,
    letterSpacing: 1.5,
  },
  collection: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 34,
    color: 'rgba(200,255,0,0.92)',
    letterSpacing: 3,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  rule: {
    width: 56,
    height: 2,
    backgroundColor: colors.accent,
  },
  ruleMark: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: 'rgba(163,163,163,0.9)',
  },
  subtitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(245,245,245,0.78)',
    maxWidth: 300,
    letterSpacing: 0.3,
  },
  cta: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
    borderRadius: 2,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: colors.background,
  },
});
