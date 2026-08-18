import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { formatVolumeKg } from '@/lib/training/volume';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export type PeriodRecapData = {
  title: string;
  workouts: number;
  volumeKg: number;
  prCount: number;
  streak: number;
};

export function PeriodRecap({ data }: { data: PeriodRecapData }) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(200,255,0,0.14)', 'rgba(200,255,0,0.02)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.head}>
        <Text style={styles.kicker}>MONTHLY RECAP</Text>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.sub}>Training load · records · consistency</Text>
      </View>
      <View style={styles.grid}>
        <Stat label="Workouts" value={data.workouts} featured delay={80} />
        <Stat label="Volume" value={data.volumeKg} formatter={formatVolumeKg} delay={130} />
        <Stat label="PRs" value={data.prCount} delay={180} />
        <Stat label="Streak" value={data.streak} delay={230} />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  featured,
  formatter,
  delay = 0,
}: {
  label: string;
  value: number;
  featured?: boolean;
  formatter?: (value: number) => string;
  delay?: number;
}) {
  return (
    <View style={[styles.stat, featured && styles.statFeatured]}>
      <Text style={styles.label}>{label}</Text>
      <AnimatedCount
        value={value}
        formatter={formatter}
        delay={delay}
        duration={1000}
        style={[styles.value, featured && styles.valueFeatured]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  head: { gap: 4 },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.text,
    textTransform: 'uppercase',
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stat: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  statFeatured: {
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
  },
  valueFeatured: {
    color: colors.accent,
    fontSize: 34,
    lineHeight: 36,
  },
});
