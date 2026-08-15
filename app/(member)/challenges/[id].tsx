import { formatDistanceToNowStrict } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ChallengePodium } from '@/components/challenges/ChallengePodium';
import { LeaderboardList } from '@/components/challenges/LeaderboardList';
import { AppInput } from '@/components/ui/AppInput';
import { BackButton } from '@/components/ui/BackButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { parseChallengeScore } from '@/lib/challenges/score';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import * as challenges from '@/services/challenges';
import type { ChallengeResult, WeeklyChallenge } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function MemberChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [podium, setPodium] = useState<Awaited<ReturnType<typeof challenges.getChallengePodium>>>([]);
  const [mine, setMine] = useState<ChallengeResult | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    try {
      setError(null);
      const [chal, rows, pod] = await Promise.all([
        challenges.getWeeklyChallenge(id),
        challenges.listChallengeResults(id),
        challenges.getChallengePodium(id),
      ]);
      setChallenge(chal);
      setResults(rows);
      setPodium(pod);
      const my = rows.find((r) => r.member_id === profile.id) ?? null;
      setMine(my);
      if (my) setScoreInput(my.score_display);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load challenge');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id || !isSupabaseConfigured()) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`challenge-results-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'challenge_results', filter: `challenge_id=eq.${id}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  const improvement = useMemo(() => {
    if (!mine?.previous_score_display || !mine.previous_score_value) return null;
    if (!challenge) return null;
    const delta = mine.score_value - mine.previous_score_value;
    if (challenge.score_type === 'lowest_time') {
      const better = delta < 0;
      return {
        last: mine.previous_score_display,
        today: mine.score_display,
        label: better ? `${Math.abs(delta).toFixed(0)}s faster` : `${Math.abs(delta).toFixed(0)}s slower`,
        isPr: mine.is_pr,
      };
    }
    const better = delta > 0;
    return {
      last: mine.previous_score_display,
      today: mine.score_display,
      label: better ? `+${Math.abs(delta)}` : `${delta}`,
      isPr: mine.is_pr,
    };
  }, [mine, challenge]);

  const onSubmit = async () => {
    if (!challenge || !profile) return;
    const parsed = parseChallengeScore(challenge.score_type, scoreInput);
    if (!parsed) {
      setError(challenge.score_type === 'lowest_time' ? 'Use mm:ss (e.g. 08:42)' : 'Enter a valid score');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await challenges.submitChallengeResult({
        challengeId: challenge.id,
        scoreValue: parsed.value,
        scoreDisplay: parsed.display,
      });
      setNotice('Submitted — waiting for coach verification.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={200} />
      </Screen>
    );
  }

  if (!challenge) {
    return (
      <Screen>
        <BackButton />
        <ErrorState message={error ?? 'Challenge not found'} onRetry={() => router.back()} />
      </Screen>
    );
  }

  const live = challenge.status === 'live';

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
        <Text style={styles.title} numberOfLines={1}>
          {challenge.name}
        </Text>
      </View>

      <Text style={styles.status}>{challenge.status.toUpperCase()}</Text>
      <Text style={styles.deadline}>
        {live
          ? `Ends ${formatDistanceToNowStrict(new Date(challenge.ends_at), { addSuffix: true })}`
          : `Closed · ${challenge.participant_count ?? 0} athletes`}
      </Text>
      {challenge.description ? <Text style={styles.body}>{challenge.description}</Text> : null}
      {challenge.instructions ? <Text style={styles.rules}>{challenge.instructions}</Text> : null}

      <SectionHeader title="Movements" kicker="Workout" />
      <View style={styles.moves}>
        {challenge.movements.map((m, i) => (
          <Text key={`${m.name}-${i}`} style={styles.move}>
            {m.reps ? `${m.reps} ` : ''}
            {m.name}
          </Text>
        ))}
        {!challenge.movements.length ? <Text style={styles.body}>See coach instructions.</Text> : null}
      </View>

      {podium.length ? (
        <>
          <SectionHeader title="Podium" kicker="Top 3" />
          <ChallengePodium places={podium} />
        </>
      ) : null}

      {mine ? (
        <View style={styles.myBox}>
          <Text style={styles.myLabel}>YOUR RESULT</Text>
          <Text style={styles.myScore}>{mine.score_display}</Text>
          <Text style={styles.myMeta}>
            {mine.status.toUpperCase()}
            {mine.rank ? ` · #${mine.rank}` : ''}
            {mine.is_pr ? ' · PR' : ''}
          </Text>
          {improvement ? (
            <View style={styles.compare}>
              <Text style={styles.compareItem}>LAST {improvement.last}</Text>
              <Text style={styles.compareItem}>NOW {improvement.today}</Text>
              <Text style={[styles.compareItem, improvement.isPr && styles.pr]}>
                {improvement.isPr ? 'NEW PERSONAL RECORD' : improvement.label}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {live ? (
        <>
          <SectionHeader title="Submit result" kicker="Compete" />
          <AppInput
            label={challenge.score_type === 'lowest_time' ? 'Time (mm:ss)' : 'Score'}
            value={scoreInput}
            onChangeText={setScoreInput}
            placeholder={challenge.score_type === 'lowest_time' ? '08:42' : '100'}
          />
          <PrimaryButton
            title={submitting ? 'Submitting…' : mine ? 'Update submission' : 'Submit result'}
            onPress={() => void onSubmit()}
            disabled={submitting || !scoreInput.trim()}
          />
        </>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <SectionHeader title="Leaderboard" kicker="Verified" />
      <LeaderboardList rows={results} viewerId={profile?.id} />
      <View style={{ height: 48 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.sm, marginBottom: spacing.md },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 28, color: colors.text },
  status: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.6, color: colors.accent },
  deadline: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginBottom: 8 },
  rules: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moves: { gap: 6, marginBottom: spacing.xl },
  move: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  myBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.06)',
    marginBottom: spacing.lg,
    gap: 4,
  },
  myLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.4, color: colors.accent },
  myScore: { fontFamily: fonts.display, fontSize: 40, color: colors.text },
  myMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  compare: { marginTop: 8, gap: 4 },
  compareItem: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary },
  pr: { color: colors.accent },
  notice: { fontFamily: fonts.sans, color: colors.accent, marginVertical: 8 },
  err: { fontFamily: fonts.sans, color: colors.danger, marginVertical: 8 },
});
