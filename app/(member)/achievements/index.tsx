import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AchievementBadgeCard } from '@/components/achievements/AchievementBadgeCard';
import { XpProgressBar } from '@/components/achievements/XpProgressBar';
import { AtmosphereBackdrop } from '@/components/ui/AtmosphereBackdrop';
import { BackButton } from '@/components/ui/BackButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { GYM_IMAGES } from '@/constants/media';
import * as achievements from '@/services/achievements';
import * as challenges from '@/services/challenges';
import type { Achievement, AthleteXp, MemberAchievement } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'training', label: 'Training' },
  { id: 'performance', label: 'Performance' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'special', label: 'Special' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

export default function MemberAchievementsScreen() {
  const { profile } = useAuth();
  const [catalog, setCatalog] = useState<Achievement[]>([]);
  const [owned, setOwned] = useState<MemberAchievement[]>([]);
  const [xp, setXp] = useState<AthleteXp | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ sessions: 0, prs: 0, streak: 0 });

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const [cat, mine, athleteXp, trophy] = await Promise.all([
        achievements.listAchievements({ activeOnly: true }),
        achievements.listMemberAchievements(profile.id),
        challenges.getAthleteXp(profile.id),
        challenges.getTrophyCabinet(profile.id),
      ]);
      setCatalog(cat);
      setOwned(mine);
      setXp(athleteXp);
      setProgress({
        sessions: trophy.total_workouts,
        prs: trophy.personal_records,
        streak: trophy.longest_streak,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load achievements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownedCodes = useMemo(
    () => new Set(owned.map((o) => o.achievement?.code).filter(Boolean) as string[]),
    [owned],
  );

  const progressFor = (a: Achievement) => {
    if (a.code.startsWith('sessions_') || a.code === 'first_session') {
      return { current: progress.sessions, target: a.threshold ?? (a.code === 'first_session' ? 1 : null) };
    }
    if (a.code.startsWith('streak_')) {
      return { current: progress.streak, target: a.threshold };
    }
    if (a.code.startsWith('prs_') || a.code === 'new_pr') {
      return { current: progress.prs, target: a.threshold ?? (a.code === 'new_pr' ? 1 : null) };
    }
    return { current: ownedCodes.has(a.code) ? 1 : 0, target: 1 };
  };

  const filtered = useMemo(() => {
    const rows = catalog.filter((a) => (filter === 'all' ? true : a.category === filter));
    return rows.sort((a, b) => {
      const aOn = ownedCodes.has(a.code) ? 1 : 0;
      const bOn = ownedCodes.has(b.code) ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      const ap = progressFor(a);
      const bp = progressFor(b);
      const aPct = ap.target ? ap.current / ap.target : 0;
      const bPct = bp.target ? bp.current / bp.target : 0;
      return bPct - aPct;
    });
  }, [catalog, filter, ownedCodes, progress]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={40} style={{ marginTop: spacing.md }} />
        <Skeleton height={140} style={{ marginTop: spacing.lg }} />
        <Skeleton height={88} style={{ marginTop: spacing.md }} />
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
          <Text style={styles.kicker}>PERFORMANCE</Text>
          <Text style={styles.title}>ACHIEVEMENTS</Text>
        </View>
      </View>

      {xp ? <XpProgressBar xp={xp} /> : null}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{owned.length}</Text>
          <Text style={styles.summaryLabel}>Unlocked</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{catalog.length}</Text>
          <Text style={styles.summaryLabel}>In catalog</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{progress.streak}d</Text>
          <Text style={styles.summaryLabel}>Streak</Text>
        </View>
      </View>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filterScroll}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, active && styles.chipOn]}>
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{f.label.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionHint}>
        {filter === 'all' ? 'Closest progress first' : `${filter} · closest progress first`}
      </Text>

      <View style={styles.list}>
        {filtered.map((a) => {
          const unlocked = ownedCodes.has(a.code);
          const p = progressFor(a);
          return (
            <AchievementBadgeCard
              key={a.id}
              achievement={a}
              unlocked={unlocked}
              progressCurrent={p.current}
              progressTarget={p.target}
            />
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push('/(member)/challenges')}
        style={({ pressed }) => [styles.challengeCta, pressed && styles.pressed]}>
        <AtmosphereBackdrop source={GYM_IMAGES.rackDumbbells} intensity="strong" />
        <Text style={styles.ctaKicker}>COMPETE</Text>
        <Text style={styles.ctaTitle}>Weekly Challenge</Text>
        <Text style={styles.ctaMeta}>Rank up · earn podium hardware</Text>
      </Pressable>
      <View style={{ height: spacing.xxl }} />
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
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
  },
  summaryLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  filterScroll: { marginHorizontal: -spacing.lg },
  filters: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  chipText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  chipTextOn: { color: colors.text },
  sectionHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  list: { gap: 10 },
  challengeCta: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    minHeight: 140,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.3)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    gap: 4,
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.92 },
  ctaKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  ctaTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
  },
  ctaMeta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
});
