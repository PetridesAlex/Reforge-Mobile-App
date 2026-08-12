import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { formatVolumeKg } from '@/lib/training/volume';
import type { WorkoutSummary } from '@/types';
import { colors, fonts, spacing, typography } from '@/constants/theme';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function WorkoutSummaryCard({ summary }: { summary: WorkoutSummary }) {
  return (
    <AppCard style={styles.card}>
      {summary.workoutName ? <Text style={styles.workoutName}>{summary.workoutName}</Text> : null}
      <View style={styles.grid}>
        <Metric label="DURATION" value={formatDuration(summary.durationSeconds)} />
        <Metric label="VOLUME" value={formatVolumeKg(summary.estimatedVolumeKg)} />
        <Metric label="SETS" value={String(summary.totalSets)} />
        <Metric label="EXERCISES" value={String(summary.exercisesCompleted)} />
      </View>
      {summary.completionPct != null ? (
        <View style={styles.completion}>
          <Text style={styles.completionLabel}>COMPLETION</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${summary.completionPct}%` }]} />
          </View>
          <Text style={styles.completionValue}>{summary.completionPct}%</Text>
        </View>
      ) : null}
      {summary.highlight ? (
        <View style={styles.highlight}>
          <Text style={styles.highlightKicker}>{summary.highlight.title}</Text>
          <Text style={styles.highlightValue}>{summary.highlight.subtitle}</Text>
        </View>
      ) : null}
      {summary.personalRecords.length > 0 ? (
        <View style={styles.prs}>
          <Text style={styles.prLabel}>PERSONAL RECORDS</Text>
          {summary.personalRecords.map((pr) => (
            <Text key={pr} style={styles.prItem}>
              {pr}
            </Text>
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  workoutName: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metric: {
    width: '47%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    gap: 4,
  },
  metricLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  metricValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.accent,
  },
  completion: { gap: spacing.sm },
  completionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.accent },
  completionValue: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  highlight: {
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    borderRadius: 12,
    padding: spacing.md,
    gap: 4,
  },
  highlightKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  highlightValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
  },
  prs: { gap: spacing.xs },
  prLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  prItem: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accent,
  },
});
