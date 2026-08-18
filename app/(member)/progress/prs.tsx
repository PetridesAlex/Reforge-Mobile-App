import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseWorkouts } from '@/lib/workouts/config';
import { listPersonalRecords } from '@/services/pr.supabase';
import type { PersonalRecord } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

function formatPrValue(pr: PersonalRecord): string {
  if (pr.record_type === 'max_weight' || pr.record_type === 'estimated_1rm') {
    return `${pr.weight_kg ?? pr.value} KG`;
  }
  if (pr.record_type === 'max_volume') {
    return `${Math.round(pr.value)} KG VOL`;
  }
  if (pr.reps != null && pr.weight_kg != null) {
    return `${pr.reps} × ${pr.weight_kg} KG`;
  }
  return String(pr.value);
}

function recordLabel(type: PersonalRecord['record_type']): string {
  switch (type) {
    case 'max_weight':
      return 'Heaviest';
    case 'estimated_1rm':
      return 'Est. 1RM';
    case 'max_volume':
      return 'Best volume';
    case 'reps_at_weight':
      return 'Best reps';
    default:
      return type;
  }
}

export default function MyPrsScreen() {
  const { profile } = useAuth();
  const hasSupabaseWorkouts = useSupabaseWorkouts();
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      if (!hasSupabaseWorkouts) {
        setPrs([]);
        return;
      }
      setPrs(await listPersonalRecords(profile.id, 100));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PRs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, hasSupabaseWorkouts]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, PersonalRecord[]>();
    for (const pr of prs) {
      const key = pr.exercise_name ?? pr.exercise_id;
      const list = map.get(key) ?? [];
      list.push(pr);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [prs]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={88} style={{ marginTop: spacing.lg }} />
        <Skeleton height={88} style={{ marginTop: spacing.sm }} />
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
      <View style={styles.top}>
        <BackButton />
        <View style={styles.topCopy}>
          <Text style={styles.kicker}>STRENGTH</Text>
          <Text style={styles.title}>MY PRS</Text>
        </View>
      </View>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!error && !prs.length ? (
        <EmptyState
          icon="flash-outline"
          variant="panel"
          title="Your PRs will appear here"
          description="REFORGE auto-detects personal records from the weighted sets you log in your workouts."
          steps={[
            { label: 'Log sets', desc: 'Strength or weighted cardio (weight + reps)' },
            { label: 'Finish', desc: 'We sweep your session to save PRs automatically' },
            { label: 'Check back', desc: 'Come here to see your bests per exercise' },
          ]}
        />
      ) : null}

      <View style={styles.list}>
        {grouped.map(([exercise, rows]) => (
          <View key={exercise} style={styles.group}>
            <Text style={styles.exercise}>{exercise.toUpperCase()}</Text>
            {rows.map((pr) => (
              <View key={pr.id} style={styles.row}>
                <View style={styles.mark}>
                  <Ionicons name="flash" size={14} color={colors.accent} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.type}>{recordLabel(pr.record_type)}</Text>
                  <Text style={styles.meta}>
                    {new Date(pr.achieved_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={styles.value}>{formatPrValue(pr)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => router.push('/(member)/workouts')}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}>
        <Text style={styles.ctaText}>TRAIN TO BEAT A PR</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.background} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  topCopy: { flex: 1, gap: 2 },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
  },
  list: { gap: spacing.lg, marginBottom: spacing.xl },
  group: { gap: 8 },
  exercise: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surfaceElevated,
  },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  copy: { flex: 1, gap: 2 },
  type: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.accent,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.xxl,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.background,
  },
});
