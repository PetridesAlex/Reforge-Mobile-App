import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { PerformanceBuildProfile } from '@/components/performance/PerformanceBuildProfile';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type MemberStats = {
  weeklyWorkouts: number;
  weightKg: number | null;
  bodyFatPct: number | null;
  monthlyWorkouts: number;
};

type PerformanceMeta = {
  onboardingComplete: boolean;
  profileCompletionPct: number;
  weeklyGoal: number;
  streak: number;
};

type StatKey = 'weeklyWorkouts' | 'weightKg' | 'bodyFatPct' | 'monthlyWorkouts';

type StatConfig = {
  key: StatKey;
  label: string;
  kicker: string;
  icon: keyof typeof Ionicons.glyphMap;
  featured?: boolean;
  decimals?: number;
  suffix?: string;
  emptyLabel?: string;
  emptyHint?: string;
  href?: string;
};

const STAT_ITEMS: StatConfig[] = [
  {
    key: 'weeklyWorkouts',
    kicker: 'Activity',
    label: 'Sessions this week',
    icon: 'barbell-outline',
    featured: true,
  },
  {
    key: 'weightKg',
    kicker: 'Body',
    label: 'Current weight',
    icon: 'scale-outline',
    decimals: 1,
    suffix: ' kg',
    emptyLabel: '—',
    emptyHint: 'Add baseline',
    href: '/(member)/progress/setup',
  },
  {
    key: 'bodyFatPct',
    kicker: 'Composition',
    label: 'Body fat',
    icon: 'pulse-outline',
    decimals: 1,
    suffix: '%',
    emptyLabel: '—',
    emptyHint: 'Track progress',
    href: '/(member)/progress/setup',
  },
  {
    key: 'monthlyWorkouts',
    kicker: 'Volume',
    label: 'Sessions this month',
    icon: 'calendar-outline',
    href: '/(member)/progress',
  },
];

type MemberStatsStripProps = {
  stats: MemberStats;
  performance?: PerformanceMeta;
  memberName?: string | null;
};

function StatValue({
  value,
  decimals = 0,
  suffix = '',
  emptyLabel = '—',
  featured = false,
}: {
  value: number | null | undefined;
  decimals?: number;
  suffix?: string;
  emptyLabel?: string;
  featured?: boolean;
}) {
  const hasValue = value != null && !Number.isNaN(value);

  if (!hasValue) {
    return (
      <Text style={[styles.statEmptyValue, featured && styles.statEmptyValueFeatured]}>
        {emptyLabel}
      </Text>
    );
  }

  return (
    <View style={styles.statValueRow}>
      <AnimatedCount
        value={value}
        decimals={decimals}
        style={[styles.statValue, featured && styles.statValueFeatured]}
        duration={1100}
        emptyLabel={emptyLabel}
      />
      {suffix ? (
        <Text style={[styles.statSuffix, featured && styles.statSuffixFeatured]}>{suffix}</Text>
      ) : null}
    </View>
  );
}

export function MemberStatsStrip({ stats, performance, memberName }: MemberStatsStripProps) {
  const values: Record<StatKey, number | null> = {
    weeklyWorkouts: stats.weeklyWorkouts,
    weightKg: stats.weightKg,
    bodyFatPct: stats.bodyFatPct,
    monthlyWorkouts: stats.monthlyWorkouts,
  };

  const needsSetup = performance ? !performance.onboardingComplete : false;

  return (
    <View style={styles.wrap}>
      <SectionHeader
        title="Your stats"
        kicker="Performance"
        actionLabel={needsSetup ? undefined : 'Progress'}
        onActionPress={needsSetup ? undefined : () => router.push('/(member)/progress')}
      />

      <PerformanceBuildProfile stats={stats} performance={performance} memberName={memberName} />

      <View style={styles.grid}>
        {STAT_ITEMS.map((item, index) => {
          const featured = item.featured ?? false;
          const value = values[item.key];
          const hasValue = value != null && !Number.isNaN(value);
          const href = item.href ?? (needsSetup ? '/(member)/progress/setup' : '/(member)/progress');

          const card = (
            <View style={[styles.card, featured && styles.cardFeatured]}>
              {featured ? (
                <LinearGradient
                  colors={['rgba(200,255,0,0.12)', 'rgba(200,255,0,0.02)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGlow}
                />
              ) : null}
              {featured ? <View style={styles.featuredRail} /> : null}

              <View style={styles.cardTop}>
                <Text style={[styles.statKicker, featured && styles.statKickerFeatured]}>
                  {item.kicker}
                </Text>
                <View style={[styles.iconWrap, featured && styles.iconWrapFeatured]}>
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={featured ? colors.accent : colors.textSecondary}
                  />
                </View>
              </View>

              <StatValue
                value={value}
                decimals={item.decimals}
                suffix={item.suffix}
                emptyLabel={item.emptyLabel}
                featured={featured}
              />

              <Text style={styles.statLabel}>{item.label}</Text>

              {!hasValue && item.emptyHint ? (
                <Text style={styles.statHint}>{item.emptyHint}</Text>
              ) : null}
            </View>
          );

          return (
            <Animated.View
              key={item.key}
              entering={FadeInDown.delay(80 + index * 60).duration(420).springify()}
              style={styles.cardPressable}>
              <Pressable
                onPress={() => router.push(href as never)}
                style={({ pressed }) => [pressed && styles.cardPressed]}>
                {card}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardPressable: {
    width: '48.5%',
    flexGrow: 1,
    minWidth: 148,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 118,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
    justifyContent: 'flex-end',
  },
  cardFeatured: {
    backgroundColor: '#121812',
    borderColor: 'rgba(200, 255, 0, 0.28)',
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  statKickerFeatured: {
    color: 'rgba(200, 255, 0, 0.72)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconWrapFeatured: {
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: 0.8,
  },
  statValueFeatured: {
    color: colors.accent,
  },
  statSuffix: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  statSuffixFeatured: {
    color: 'rgba(200, 255, 0, 0.65)',
  },
  statEmptyValue: {
    fontFamily: fonts.display,
    color: colors.textMuted,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 1,
  },
  statEmptyValueFeatured: {
    color: 'rgba(200, 255, 0, 0.35)',
  },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  statHint: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
