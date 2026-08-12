import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';

const BRAND = 'REFORGE';

/** Per-letter graffiti tilt and vertical nudge */
const LETTER_STYLE = [
  { rotate: '-7deg', nudgeY: 2 },
  { rotate: '5deg', nudgeY: -1 },
  { rotate: '-4deg', nudgeY: 1 },
  { rotate: '6deg', nudgeY: -2 },
  { rotate: '-5deg', nudgeY: 0 },
  { rotate: '4deg', nudgeY: 1 },
  { rotate: '-6deg', nudgeY: -1 },
] as const;

const SIZE_TOKENS = {
  xs: { fontSize: 22, lineHeight: 24, letterWidth: 17, letterGap: 0 },
  sm: { fontSize: 28, lineHeight: 30, letterWidth: 22, letterGap: 0 },
  md: { fontSize: 34, lineHeight: 36, letterWidth: 27, letterGap: 1 },
  lg: { fontSize: 44, lineHeight: 46, letterWidth: 34, letterGap: 1 },
} as const;

type ReforgeGraffitiMarkProps = {
  style?: StyleProp<ViewStyle>;
  /** Re-run entrance animation when this changes (e.g. home focus refresh) */
  animateKey?: string | number;
  size?: keyof typeof SIZE_TOKENS;
  /** Shrink on narrow screens so the mark fits beside header actions */
  responsive?: boolean;
};

function resolveSize(
  size: keyof typeof SIZE_TOKENS,
  responsive: boolean,
  screenWidth: number,
): keyof typeof SIZE_TOKENS {
  if (!responsive) return size;
  if (screenWidth < 360) return 'xs';
  if (screenWidth < 400) return 'sm';
  if (screenWidth < 480) return 'md';
  return size === 'lg' ? 'md' : size;
}

function GraffitiLetter({
  char,
  index,
  opacity,
  metrics,
}: {
  char: string;
  index: number;
  opacity: Animated.Value;
  metrics: (typeof SIZE_TOKENS)[keyof typeof SIZE_TOKENS];
}) {
  const tilt = LETTER_STYLE[index % LETTER_STYLE.length];
  const { fontSize, lineHeight, letterWidth } = metrics;

  const y = opacity.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const scale = opacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0.68, 1],
  });

  const layerStyle = { fontSize, lineHeight, width: letterWidth };

  return (
    <Animated.View
      style={[
        styles.letterWrap,
        {
          width: letterWidth,
          height: lineHeight + 6,
          opacity,
          transform: [{ translateY: y }, { scale }, { rotate: tilt.rotate }],
          marginTop: tilt.nudgeY,
        },
      ]}>
      <Text style={[styles.layerShadow, layerStyle]} pointerEvents="none">
        {char}
      </Text>
      <Text style={[styles.layerOutline, layerStyle]} pointerEvents="none">
        {char}
      </Text>
      <Text style={[styles.layerFill, layerStyle]} pointerEvents="none">
        {char}
      </Text>
      <Text style={[styles.layerHighlight, layerStyle]} pointerEvents="none">
        {char}
      </Text>
    </Animated.View>
  );
}

export function ReforgeGraffitiMark({
  style,
  animateKey = 'reforge',
  size = 'lg',
  responsive = false,
}: ReforgeGraffitiMarkProps) {
  const { width: screenWidth } = useWindowDimensions();
  const resolvedSize = resolveSize(size, responsive, screenWidth);
  const metrics = SIZE_TOKENS[resolvedSize];
  const anims = useRef(BRAND.split('').map(() => new Animated.Value(0))).current;

  const underlineWidth = useMemo(() => {
    const letters = BRAND.length * metrics.letterWidth;
    const gaps = (BRAND.length - 1) * metrics.letterGap;
    return letters + gaps;
  }, [metrics.letterGap, metrics.letterWidth]);

  useEffect(() => {
    anims.forEach((anim) => anim.setValue(0));
    const animation = Animated.stagger(
      45,
      anims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [animateKey, anims]);

  return (
    <View style={[styles.root, style]} accessibilityLabel="REFORGE">
      <View style={[styles.wordRow, { gap: metrics.letterGap }]}>
        {BRAND.split('').map((char, index) => (
          <GraffitiLetter
            key={`${animateKey}-${char}-${index}`}
            char={char}
            index={index}
            opacity={anims[index]}
            metrics={metrics}
          />
        ))}
      </View>
      <View style={[styles.underlineRow, { width: underlineWidth }]}>
        <View style={[styles.dripShort, { width: underlineWidth * 0.18 }]} />
        <View style={[styles.dripMain, { width: underlineWidth * 0.62 }]} />
        <View style={styles.dripDot} />
      </View>
      <View
        style={[
          styles.sprayMist,
          resolvedSize === 'lg' && styles.sprayMistLg,
          resolvedSize === 'xs' && styles.sprayMistXs,
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const layerBase = {
  position: 'absolute' as const,
  left: 0,
  top: 0,
  fontFamily: fonts.display,
  textAlign: 'center' as const,
  letterSpacing: 1,
  ...(Platform.OS === 'web'
    ? ({
        userSelect: 'none',
      } as const)
    : null),
};

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    alignSelf: 'flex-start',
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    paddingRight: spacing.xs,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  letterWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  layerShadow: {
    ...layerBase,
    left: 3,
    top: 3,
    color: '#000000',
    opacity: 0.88,
  },
  layerOutline: {
    ...layerBase,
    left: 1.5,
    top: 1,
    color: '#1a2600',
  },
  layerFill: {
    ...layerBase,
    color: colors.accent,
    textShadowColor: 'rgba(200,255,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  layerHighlight: {
    ...layerBase,
    color: 'rgba(255,255,255,0.24)',
  },
  underlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
  },
  dripShort: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.35)',
    transform: [{ rotate: '-8deg' }],
  },
  dripMain: {
    height: 5,
    borderRadius: 2,
    backgroundColor: colors.accent,
    opacity: 0.55,
    transform: [{ rotate: '-2deg' }],
  },
  dripDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    opacity: 0.4,
    marginBottom: -2,
  },
  sprayMist: {
    position: 'absolute',
    right: -8,
    top: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(200,255,0,0.07)',
  },
  sprayMistLg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    right: -12,
    top: -8,
  },
  sprayMistXs: {
    width: 24,
    height: 24,
    borderRadius: 12,
    right: -4,
    top: -4,
  },
});
