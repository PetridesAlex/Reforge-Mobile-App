import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { trackStoreEvent } from '@/lib/store/analytics';
import { GYM_IMAGES } from '@/constants/media';
import * as store from '@/services/store';
import type { StoreHomeHero, StoreProduct } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const FALLBACK_HERO: StoreHomeHero = {
  kicker: 'REFORGE STORE',
  title: 'ESSENTIALS',
  headline: 'REFORGE ESSENTIALS',
  subtitle: 'Training gear built for the floor — sharp cuts, durable fabrics, studio-ready.',
  cta: 'ENTER STORE',
};

/** Soft champagne-lime — premium hover vs neon rest state */
const CTA_REST = colors.accent;
const CTA_HOVER = '#F2FFB8';

type Props = {
  /** Delay for staggered entrance on the home feed */
  enterDelay?: number;
};

function StoreFeatureCta({ label, onPress }: { label: string; onPress: () => void }) {
  const hover = useSharedValue(0);
  const press = useSharedValue(0);
  const arrowIdle = useSharedValue(0);
  const sheenSweep = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    arrowIdle.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    sheenSweep.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    glow.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [arrowIdle, sheenSweep, glow]);

  const setHover = (active: boolean) => {
    hover.value = withTiming(active ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  };

  const setPress = (active: boolean) => {
    press.value = withSpring(active ? 1 : 0, { damping: 18, stiffness: 320 });
  };

  const ctaStyle = useAnimatedStyle(() => {
    const idleScale = 1 + glow.value * 0.012;
    return {
      backgroundColor: interpolateColor(hover.value, [0, 1], [CTA_REST, CTA_HOVER]),
      transform: [
        {
          scale:
            idleScale * (1 - press.value * 0.04) * (1 + hover.value * 0.02),
        },
      ],
      shadowColor: '#C8FF00',
      shadowOpacity: 0.18 + glow.value * 0.22 + hover.value * 0.25,
      shadowRadius: 6 + glow.value * 10 + hover.value * 8,
      shadowOffset: { width: 0, height: 2 + glow.value * 2 + hover.value * 3 },
      elevation: 3 + glow.value * 3 + hover.value * 4,
      opacity: 1 - press.value * 0.04,
    };
  });

  const arrowStyle = useAnimatedStyle(() => {
    const idle = arrowIdle.value * (1 - hover.value * 0.35) * 5;
    const boost = hover.value * 6;
    return {
      transform: [{ translateX: idle + boost }],
    };
  });

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: 0.14 + glow.value * 0.16 + hover.value * 0.22,
    transform: [
      { translateX: -56 + sheenSweep.value * 200 + hover.value * 24 },
      { rotate: '18deg' },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + glow.value * 0.45,
    transform: [{ scale: 1 + glow.value * 0.04 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPressIn={() => setPress(true)}
      onPressOut={() => setPress(false)}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Animated.View style={[styles.cta, ctaStyle]}>
        <Animated.View pointerEvents="none" style={[styles.ctaRing, ringStyle]} />
        <Animated.View pointerEvents="none" style={[styles.ctaSheen, sheenStyle]} />
        <Text style={styles.ctaText}>{label}</Text>
        <Animated.View style={arrowStyle}>
          <Ionicons name="arrow-forward" size={15} color={colors.background} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export function HomeStoreFeature({ enterDelay = 140 }: Props) {
  const [hero, setHero] = useState<StoreHomeHero>(FALLBACK_HERO);
  const [product, setProduct] = useState<StoreProduct | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [homeHero, featured] = await Promise.all([
          store.getHomeHero(),
          store.listProducts({ status: 'active', featuredOnly: true, sort: 'newest', limit: 1 }),
        ]);
        if (!active) return;
        if (homeHero) setHero(homeHero);
        setProduct(featured[0] ?? null);
      } catch {
        // Keep fallback creative — store may be offline / mock-only
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const headline = hero.headline?.trim() || FALLBACK_HERO.headline;
  const parts = headline.split(/\s+/);
  const brand = parts[0] ?? 'REFORGE';
  const collection = parts.slice(1).join(' ') || 'ESSENTIALS';

  const openStore = () => {
    trackStoreEvent('store_opened', { source: 'home_feature' });
    router.push('/(member)/store');
  };

  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(480)} style={styles.wrap}>
      <Pressable
        onPress={openStore}
        accessibilityRole="link"
        accessibilityLabel="Open REFORGE Store"
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        <View style={styles.media}>
          <Image
            source={GYM_IMAGES.reforgeStore}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={400}
          />

          <LinearGradient
            colors={['rgba(5,5,5,0.15)', 'rgba(5,5,5,0.55)', 'rgba(5,5,5,0.96)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(200,255,0,0.2)', 'transparent', 'transparent']}
            locations={[0, 0.35, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topHairline} />
          <View style={styles.sideRail} />
          <View style={styles.cornerTL} />
          <View style={styles.cornerBR} />

          <View style={styles.content}>
            <View style={styles.metaRow}>
              <View style={styles.liveDot} />
              <Text style={styles.meta}>
                {(hero.kicker || 'REFORGE STORE').toUpperCase()}
                {'  ·  '}
                FEATURED
              </Text>
            </View>

            <View style={styles.lockup}>
              <Text style={styles.brand}>{brand}</Text>
              <Text style={styles.collection}>{collection}</Text>
            </View>

            <View style={styles.ruleRow}>
              <View style={styles.rule} />
              <Text style={styles.ruleMark}>RFG</Text>
              <View style={styles.rule} />
            </View>

            <Text style={styles.subtitle} numberOfLines={2}>
              {hero.subtitle || FALLBACK_HERO.subtitle}
            </Text>

            {product?.name ? (
              <Text style={styles.productHint} numberOfLines={1}>
                Now featuring · {product.name}
              </Text>
            ) : null}

            <View style={styles.ctaRow}>
              <StoreFeatureCta label={hero.cta || FALLBACK_HERO.cta} onPress={openStore} />
              <View style={styles.shopMark}>
                <Ionicons name="bag-handle" size={16} color={colors.accent} />
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  pressable: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.32)',
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  media: {
    minHeight: 248,
    justifyContent: 'flex-end',
    backgroundColor: '#070707',
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(200,255,0,0.45)',
  },
  sideRail: {
    position: 'absolute',
    left: 0,
    top: 18,
    bottom: 18,
    width: 2,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  cornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 14,
    height: 14,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: 'rgba(200,255,0,0.55)',
  },
  cornerBR: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 14,
    height: 14,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  content: {
    paddingHorizontal: spacing.md + 4,
    paddingBottom: spacing.md + 2,
    paddingTop: spacing.xl,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  meta: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  lockup: {
    gap: 0,
    marginTop: 2,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 42,
    letterSpacing: 1.2,
    color: colors.text,
  },
  collection: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: 1,
    color: colors.accent,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ruleMark: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.72)',
    maxWidth: 320,
  },
  productHint: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.textMuted,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 2,
    backgroundColor: colors.accent,
    overflow: 'hidden',
  },
  ctaRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ctaSheen: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 40,
    backgroundColor: '#FFFFFF',
  },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.background,
    zIndex: 1,
  },
  shopMark: {
    width: 38,
    height: 38,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
});
