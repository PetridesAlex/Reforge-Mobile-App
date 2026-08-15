import { formatDistanceToNowStrict, format } from 'date-fns';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ChallengePodium } from '@/components/challenges/ChallengePodium';
import { AtmosphereBackdrop } from '@/components/ui/AtmosphereBackdrop';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { GYM_IMAGES } from '@/constants/media';
import * as challenges from '@/services/challenges';
import type { WeeklyChallenge } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function MemberChallengesIndex() {
  const [live, setLive] = useState<WeeklyChallenge | null>(null);
  const [past, setPast] = useState<WeeklyChallenge[]>([]);
  const [podium, setPodium] = useState<Awaited<ReturnType<typeof challenges.getChallengePodium>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [liveRow, closed] = await Promise.all([
        challenges.getLiveChallenge(),
        challenges.listWeeklyChallenges({ status: ['closed'] }),
      ]);
      setLive(liveRow);
      setPast(closed.slice(0, 12));
      if (liveRow) setPodium(await challenges.getChallengePodium(liveRow.id));
      else if (closed[0]) setPodium(await challenges.getChallengePodium(closed[0].id));
      else setPodium([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={160} />
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
        <Text style={styles.title}>CHALLENGES</Text>
      </View>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <SectionHeader title="This week" kicker="Compete" />
      {live ? (
        <Pressable
          onPress={() => router.push(`/(member)/challenges/${live.id}`)}
          style={styles.hero}>
          <AtmosphereBackdrop source={GYM_IMAGES.dumbbellsWod} intensity="strong" />
          <Text style={styles.kicker}>WEEKLY CHALLENGE</Text>
          <Text style={styles.heroTitle}>{live.name}</Text>
          <Text style={styles.heroMeta}>
            Ends {formatDistanceToNowStrict(new Date(live.ends_at), { addSuffix: true })} ·{' '}
            {live.participant_count ?? 0} competing
          </Text>
          <Text style={styles.cta}>VIEW CHALLENGE</Text>
        </Pressable>
      ) : (
        <EmptyState
          icon="trophy-outline"
          title="No live challenge"
          description="When coaches publish this week’s competition, it will appear here."
        />
      )}

      {podium.length ? (
        <>
          <SectionHeader title="Podium" kicker="Leaders" />
          <ChallengePodium places={podium} compact />
        </>
      ) : null}

      <SectionHeader title="Past challenges" kicker="History" />
      <View style={styles.list}>
        {past.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => router.push(`/(member)/challenges/${row.id}`)}
            style={styles.card}>
            <Text style={styles.cardTitle}>{row.name}</Text>
            <Text style={styles.cardMeta}>
              Week of {format(new Date(row.starts_at), 'MMM d')} · {row.participant_count ?? 0} athletes
            </Text>
          </Pressable>
        ))}
        {!past.length ? <Text style={styles.empty}>No past challenges yet.</Text> : null}
      </View>
      <View style={{ height: 40 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.sm, marginBottom: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  hero: {
    padding: spacing.lg,
    minHeight: 200,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: colors.surfaceElevated,
    gap: 8,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  kicker: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.6, color: colors.accent },
  heroTitle: { fontFamily: fonts.display, fontSize: 36, color: colors.text, lineHeight: 38 },
  heroMeta: { fontFamily: fonts.sans, fontSize: 13, color: 'rgba(255,255,255,0.72)' },
  cta: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.4, color: colors.accent, marginTop: 8 },
  list: { gap: 8 },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text },
  cardMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  empty: { fontFamily: fonts.sans, color: colors.textMuted },
});
