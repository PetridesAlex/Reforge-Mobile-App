import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import {
  membershipNeedsPayment,
  membershipStatusMeta,
  type MembershipStatusTone,
} from '@/lib/memberships/statusMeta';
import type { MembershipStatus } from '@/services/mock/data';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  memberName: string;
  planLabel: string;
  status: MembershipStatus | null;
  amountEur?: number | null;
  periodEnd?: string | null;
  memberId?: string;
  loading?: boolean;
};

const TONE_GRADIENT: Record<MembershipStatusTone, [string, string, string]> = {
  ok: ['rgba(200,255,0,0.22)', 'rgba(18,22,14,0.98)', 'rgba(8,10,8,1)'],
  trial: ['rgba(200,255,0,0.18)', 'rgba(18,22,14,0.98)', 'rgba(8,10,8,1)'],
  warn: ['rgba(250,204,21,0.16)', 'rgba(22,20,10,0.98)', 'rgba(10,8,4,1)'],
  danger: ['rgba(255,77,77,0.18)', 'rgba(24,12,12,0.98)', 'rgba(10,4,4,1)'],
  muted: ['rgba(255,255,255,0.08)', 'rgba(18,18,18,0.98)', 'rgba(8,8,8,1)'],
};

const TONE_BORDER: Record<MembershipStatusTone, string> = {
  ok: 'rgba(200,255,0,0.35)',
  trial: 'rgba(200,255,0,0.28)',
  warn: 'rgba(250,204,21,0.35)',
  danger: 'rgba(255,77,77,0.35)',
  muted: 'rgba(255,255,255,0.12)',
};

const TONE_PILL_TEXT: Record<MembershipStatusTone, string> = {
  ok: colors.success,
  trial: colors.accent,
  warn: '#FACC15',
  danger: colors.danger,
  muted: colors.textMuted,
};

function memberIdSuffix(memberId?: string, memberName?: string) {
  if (memberId) {
    const cleaned = memberId.replace(/-/g, '').slice(0, 8).toUpperCase();
    if (cleaned) return cleaned;
  }
  const initials = (memberName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return initials || 'MEMBER';
}

export function DigitalMembershipCard({
  memberName,
  planLabel,
  status,
  amountEur,
  periodEnd,
  memberId,
  loading,
}: Props) {
  const [cardWidth, setCardWidth] = useState(320);
  const cardHeight = Math.round(cardWidth * 0.62);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const hintOpacity = useSharedValue(1);
  const [hintVisible, setHintVisible] = useState(true);
  const [didHaptic, setDidHaptic] = useState(false);

  const meta = membershipStatusMeta(status);
  const needsPayment = membershipNeedsPayment(status);
  const periodLabel =
    periodEnd != null
      ? format(parseISO(periodEnd.length === 10 ? `${periodEnd}T12:00:00` : periodEnd), 'MMM d, yyyy')
      : null;
  const idChip = useMemo(
    () => memberIdSuffix(memberId, memberName),
    [memberId, memberName],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0) setCardWidth(next);
  }, []);

  const hideHint = useCallback(() => {
    if (!hintVisible) return;
    setHintVisible(false);
    hintOpacity.value = withTiming(0, { duration: 280 });
  }, [hintOpacity, hintVisible]);

  const triggerHaptic = useCallback(() => {
    if (didHaptic || Platform.OS === 'web') return;
    setDidHaptic(true);
    void Haptics.selectionAsync();
  }, [didHaptic]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .failOffsetY([-24, 24])
        .onBegin(() => {
          runOnJS(hideHint)();
          runOnJS(triggerHaptic)();
        })
        .onUpdate((e) => {
          dragX.value = e.translationX;
          dragY.value = e.translationY;
        })
        .onEnd(() => {
          dragX.value = withSpring(0, { damping: 16, stiffness: 200 });
          dragY.value = withSpring(0, { damping: 16, stiffness: 200 });
        }),
    [dragX, dragY, hideHint, triggerHaptic],
  );

  const cardStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(dragX.value, [-160, 0, 160], [18, 0, -18], Extrapolation.CLAMP);
    const rotateX = interpolate(dragY.value, [-100, 0, 100], [-10, 0, 10], Extrapolation.CLAMP);
    const scale = interpolate(
      Math.max(Math.abs(dragX.value), Math.abs(dragY.value)),
      [0, 160],
      [1, 1.03],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
        { rotateX: `${rotateX}deg` },
        { scale },
      ],
    };
  });

  const sheenStyle = useAnimatedStyle(() => {
    const shift = interpolate(dragX.value, [-160, 0, 160], [-40, 0, 40], Extrapolation.CLAMP);
    return {
      transform: [{ translateX: shift }],
      opacity: interpolate(Math.abs(dragX.value), [0, 80], [0.35, 0.7], Extrapolation.CLAMP),
    };
  });

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  if (loading) {
    return (
      <View style={styles.shell} onLayout={onLayout}>
        <View style={[styles.cardLoading, { height: cardHeight }]}>
          <Text style={styles.loadingText}>Loading membership…</Text>
        </View>
      </View>
    );
  }

  const a11y = `${memberName}, ${planLabel}, membership ${meta.label}${
    periodLabel ? `, ${needsPayment ? 'due' : 'renews'} ${periodLabel}` : ''
  }${amountEur != null ? `, €${Math.round(amountEur)}` : ''}`;

  return (
    <Animated.View
      entering={FadeInDown.duration(520).springify()}
      style={styles.shell}
      onLayout={onLayout}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessible
            accessibilityRole="text"
            accessibilityLabel={a11y}
            style={[
              styles.card,
              {
                height: cardHeight,
                borderColor: TONE_BORDER[meta.tone],
              },
              cardStyle,
            ]}>
            <LinearGradient
              colors={TONE_GRADIENT[meta.tone]}
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <Animated.View style={[styles.sheen, sheenStyle]} pointerEvents="none">
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.14)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <View style={styles.topRow}>
              <View style={styles.brandRow}>
                <ReforgeLogo width={48} height={48} variant="badge" />
                <View>
                  <Text style={styles.brandKicker}>REFORGE</Text>
                  <Text style={styles.brandSub}>DIGITAL MEMBER</Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    borderColor: TONE_BORDER[meta.tone],
                    backgroundColor:
                      meta.tone === 'ok'
                        ? 'rgba(74,222,128,0.12)'
                        : meta.tone === 'danger'
                          ? 'rgba(255,77,77,0.12)'
                          : meta.tone === 'warn'
                            ? 'rgba(250,204,21,0.12)'
                            : meta.tone === 'trial'
                              ? 'rgba(200,255,0,0.1)'
                              : 'rgba(255,255,255,0.05)',
                  },
                ]}>
                <Ionicons name={meta.icon} size={12} color={TONE_PILL_TEXT[meta.tone]} />
                <Text style={[styles.statusPillText, { color: TONE_PILL_TEXT[meta.tone] }]}>
                  {meta.label}
                </Text>
              </View>
            </View>

            <View style={styles.chipRow}>
              <LinearGradient
                colors={['#D4AF37', '#F5E6A3', '#B8860B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.chip}
              />
              <View style={styles.premiumBadge}>
                <Ionicons name="diamond-outline" size={11} color={colors.accent} />
                <Text style={styles.premiumText}>PREMIUM</Text>
              </View>
            </View>

            <View style={styles.centerBlock}>
              <Text style={styles.memberName} numberOfLines={1}>
                {memberName}
              </Text>
              <Text style={styles.planLabel} numberOfLines={1}>
                {planLabel}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.bottomLeft}>
                <Text style={styles.metaLabel}>{needsPayment ? 'DUE BY' : 'RENEWS'}</Text>
                <Text style={styles.metaValue}>{periodLabel ?? '—'}</Text>
                <Text style={styles.idChip}>ID · {idChip}</Text>
              </View>
              {amountEur != null ? (
                <View style={styles.bottomRight}>
                  <Text style={styles.metaLabel}>{needsPayment ? 'AMOUNT DUE' : 'PLAN'}</Text>
                  <AnimatedCount
                    value={amountEur}
                    decimals={0}
                    formatter={(v) => `€${Math.round(v)}`}
                    style={styles.amountValue}
                    duration={900}
                    delay={140}
                  />
                </View>
              ) : null}
            </View>

            <Animated.View style={[styles.hint, hintStyle]} pointerEvents="none">
              <Text style={styles.hintText}>DRAG TO EXPLORE</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  gestureRoot: {
    width: '100%',
  },
  card: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  cardLoading: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    width: '140%',
    left: '-20%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandKicker: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: 1.6,
    color: colors.text,
  },
  brandSub: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.accent,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  chip: {
    width: 42,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  premiumText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  centerBlock: {
    marginTop: spacing.sm,
    gap: 4,
  },
  memberName: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  planLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  bottomLeft: {
    gap: 2,
    flex: 1,
  },
  bottomRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metaLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.3,
    color: colors.textMuted,
  },
  metaValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  idChip: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textMuted,
    marginTop: 2,
  },
  amountValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.accent,
  },
  hint: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.45)',
  },
});
