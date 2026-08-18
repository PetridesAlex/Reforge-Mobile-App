import { formatDistanceToNowStrict, format } from 'date-fns';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
          <LinearGradient colors={['rgba(200,255,0,0.12)', 'transparent']} style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{live.participant_count ?? 0} ATHLETES</Text>
            </View>
          </View>
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
          variant="panel"
          title="No live challenge"
          description="When coaches publish this week’s competition, it will appear here."
          steps={[
            { label: 'Coach publishes', desc: 'Challenge appears here immediately' },
            { label: 'Submit score', desc: 'Compete and wait for coach verification' },
            { label: 'Climb podium', desc: 'Top verified scores get premium rewards' },
          ]}
        />
      )}

      {podium.length ? (
        <>
          <SectionHeader title="Podium" kicker="Leaders" />
          <ChallengePodium places={podium} compact />
        </>
      ) : null}

      <View style={styles.pastSection}>
        <SectionHeader title="Past challenges" kicker="History" />
        <View style={styles.list}>
          {past.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => router.push(`/(member)/challenges/${row.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <LinearGradient colors={['rgba(200,255,0,0.08)', 'transparent']} style={styles.cardGlow} />
              <View style={styles.cardTop}>
                <View style={styles.closedPill}>
                  <Text style={styles.closedPillText}>CLOSED</Text>
                </View>
                <Text style={styles.cardAthletes}>{row.participant_count ?? 0} athletes</Text>
              </View>
              <Text style={styles.cardTitle}>{row.name}</Text>
              <Text style={styles.cardMeta}>
                Week of {format(new Date(row.starts_at), 'MMM d, yyyy')}
              </Text>
            </Pressable>
          ))}
          {!past.length ? (
            <EmptyState
              icon="time-outline"
              variant="panel"
              title="No past challenges yet"
              description="Completed weekly competitions will archive here with final standings and podium results."
              steps={[
                { label: 'Compete live', desc: 'Join the current weekly challenge' },
                { label: 'Get verified', desc: 'Coach confirms your submitted score' },
                { label: 'Review history', desc: 'Past weeks stay here for reference' },
              ]}
            />
          ) : null}
        </View>
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
  heroGlow: { ...StyleSheet.absoluteFillObject },
  heroTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,10,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  livePillText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,10,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  countPillText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  kicker: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.6, color: colors.accent },
  heroTitle: { fontFamily: fonts.display, fontSize: 36, color: colors.text, lineHeight: 38 },
  heroMeta: { fontFamily: fonts.sans, fontSize: 13, color: 'rgba(255,255,255,0.72)' },
  cta: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.4, color: colors.accent, marginTop: 8 },
  pastSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: spacing.sm,
  },
  list: { gap: spacing.md, marginTop: spacing.xs },
  card: {
    position: 'relative',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.16)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    gap: spacing.sm,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  cardGlow: { ...StyleSheet.absoluteFillObject },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  closedPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closedPillText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  cardAthletes: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.text, lineHeight: 20 },
  cardMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
});
