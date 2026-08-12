import { StyleSheet, Text, View } from 'react-native';

import type { WorkoutSummary } from '@/types';
import { formatVolumeKg } from '@/lib/training/volume';
import { colors, fonts, radius, spacing } from '@/constants/theme';

/** Privacy-safe share preview — no body metrics, no readiness. */
export function WorkoutShareCard({ summary }: { summary: WorkoutSummary }) {
  const mins = Math.max(1, Math.round(summary.durationSeconds / 60));

  return (
    <View style={styles.card}>
      <Text style={styles.brand}>REFORGE</Text>
      <Text style={styles.title}>{summary.workoutName ?? 'Workout complete'}</Text>
      <View style={styles.row}>
        <Stat label="TIME" value={`${mins} MIN`} />
        <Stat label="SETS" value={String(summary.totalSets)} />
        <Stat label="VOLUME" value={formatVolumeKg(summary.estimatedVolumeKg)} />
      </View>
      <Text style={styles.footer}>Shared from REFORGE · private by default</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.lg,
    gap: spacing.md,
  },
  brand: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
  },
  footer: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
});
