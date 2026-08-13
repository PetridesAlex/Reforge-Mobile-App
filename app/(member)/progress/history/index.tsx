import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { BackButton, NavChevron } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { formatVolumeKg } from '@/lib/training/volume';
import * as memberService from '@/services/member';
import type { WorkoutHistoryItem } from '@/services/workouts.supabase';
import { colors, fonts, spacing } from '@/constants/theme';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function kindLabel(kind: WorkoutHistoryItem['kind']) {
  switch (kind) {
    case 'wod':
      return 'WOD';
    case 'solo':
      return 'SOLO';
    default:
      return 'PROGRAM';
  }
}

function kindAccent(kind: WorkoutHistoryItem['kind']) {
  switch (kind) {
    case 'wod':
      return colors.accent;
    case 'solo':
      return '#7DD3FC';
    default:
      return '#A3A3A3';
  }
}

export default function WorkoutHistoryScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<WorkoutHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setItems(await memberService.getWorkoutHistory(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={120} style={{ marginTop: spacing.lg }} />
        <Skeleton height={120} style={{ marginTop: spacing.sm }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.accent}
        />
      }>
      <BackButton label="Progress" style={styles.back} />

      <View style={styles.hero}>
        <View style={styles.kickerRow}>
          <View style={styles.kickerDot} />
          <Text style={styles.kicker}>YOUR TRAINING</Text>
        </View>
        <Text style={styles.title}>WORKOUT{'\n'}HISTORY</Text>
        <View style={styles.ruleRow}>
          <View style={styles.rule} />
          <Text style={styles.ruleMark}>RFG</Text>
          <View style={styles.rule} />
        </View>
        <Text style={styles.sub}>
          Every completed session — duration, type, volume, and what you logged.
        </Text>
        {items.length > 0 ? (
          <View style={styles.countChip}>
            <Text style={styles.countValue}>{items.length}</Text>
            <Text style={styles.countLabel}>
              SESSION{items.length === 1 ? '' : 'S'} LOGGED
            </Text>
          </View>
        ) : null}
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="barbell-outline"
          title="No completed workouts yet"
          description="Finish a session and it will show up here for progress tracking."
          actionLabel="Go to workouts"
          onAction={() => router.push('/(member)/workouts')}
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <HistoryCard key={item.sessionId} item={item} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function HistoryCard({ item }: { item: WorkoutHistoryItem }) {
  const when = item.finishedAt ?? item.startedAt;
  const accent = kindAccent(item.kind);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={() => router.push(`/(member)/progress/history/${item.sessionId}`)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.card,
        hovered && styles.cardHovered,
        pressed && styles.pressed,
        Platform.OS === 'web'
          ? ({
              transitionProperty: 'border-color, background-color, transform',
              transitionDuration: '200ms',
            } as object)
          : null,
      ]}>
      <View style={[styles.sideRail, { backgroundColor: accent }]} />
      <View style={styles.topHairline} />

      <View style={styles.cardTop}>
        <View style={[styles.kindPill, { borderColor: `${accent}55`, backgroundColor: `${accent}18` }]}>
          <View style={[styles.kindDot, { backgroundColor: accent }]} />
          <Text style={[styles.kindText, { color: accent }]}>{kindLabel(item.kind)}</Text>
        </View>
        <Text style={styles.date}>{format(parseISO(when), 'EEE d MMM · HH:mm')}</Text>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>

      <View style={styles.metrics}>
        <Metric icon="time-outline" label="TIME" value={formatDuration(item.durationSeconds)} />
        <Metric icon="layers-outline" label="SETS" value={String(item.completedSets)} />
        <Metric icon="barbell-outline" label="MOVES" value={String(item.exerciseCount)} />
        <Metric icon="pulse-outline" label="VOLUME" value={formatVolumeKg(item.volumeKg)} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerHint}>VIEW SESSION</Text>
        <View style={[styles.footerArrow, hovered && styles.footerArrowHot]}>
          <NavChevron size="sm" />
        </View>
      </View>
    </Pressable>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricHead}>
        <Ionicons name={icon} size={12} color={colors.accent} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  hero: {
    marginBottom: spacing.lg,
    gap: 8,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 46,
    lineHeight: 44,
    letterSpacing: 1.2,
    color: colors.text,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  ruleMark: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.62)',
    maxWidth: 340,
  },
  countChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  countValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 22,
    color: colors.accent,
  },
  countLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  list: {
    gap: 12,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.14)',
    backgroundColor: colors.surface,
    padding: spacing.md + 2,
    gap: 12,
    overflow: 'hidden',
  },
  cardHovered: {
    borderColor: 'rgba(200,255,0,0.36)',
    backgroundColor: '#121212',
    transform: [{ translateY: -1 }],
  },
  pressed: { opacity: 0.94 },
  sideRail: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 2,
    opacity: 0.85,
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(200,255,0,0.28)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
    gap: 10,
  },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
  },
  kindDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  kindText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  date: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.textMuted,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 4,
  },
  metric: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  metricHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.3,
    color: colors.textMuted,
  },
  metricValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    letterSpacing: 0.2,
    color: colors.text,
  },
  cardFooter: {
    marginTop: 2,
    paddingTop: 10,
    paddingLeft: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerHint: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  footerArrow: {
    width: 28,
    height: 28,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  footerArrowHot: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: 'rgba(200,255,0,0.14)',
  },
});
