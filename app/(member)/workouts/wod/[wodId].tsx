import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { WodPrescriptionList } from '@/components/workouts/WodPrescriptionList';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { workoutImageForDay } from '@/constants/media';
import { normalizeMovements } from '@/lib/workouts/wod';
import * as memberService from '@/services/member';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function WodWorkoutScreen() {
  const { wodId } = useLocalSearchParams<{ wodId: string }>();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [wod, setWod] = useState<memberService.WorkoutOfTheDayView | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wodId || !profile) return;
    try {
      setError(null);
      const detail = await memberService.getWodWorkoutDetail(wodId, profile.id);
      if (!detail) {
        setError('Join today’s workout on Home to unlock this session');
        return;
      }
      setWod(detail.wod);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [profile, wodId]);

  useEffect(() => {
    load();
  }, [load]);

  const onStart = async () => {
    if (!profile || !wodId) return;
    setStarting(true);
    try {
      const session = await memberService.startWodWorkout(profile.id, wodId);
      router.push(`/(member)/workouts/session/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start workout');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={280} />
        <Skeleton height={80} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error || !wod) {
    return (
      <Screen>
        <ErrorState message={error ?? 'Workout not found'} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen scrollable>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
        <BackButton compact />

        <View style={styles.heroMedia}>
          <MediaImage uri={workoutImageForDay(wod.title)} style={styles.heroImage} overlay />
          <LinearGradient
            colors={['transparent', 'rgba(10,10,10,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroCopy}>
            <View style={styles.liveBadge}>
              <Ionicons name="flash" size={12} color={colors.accent} />
              <Text style={styles.liveText}>WORKOUT OF THE DAY</Text>
            </View>
            <Text style={styles.title}>{wod.title}</Text>
            <Text style={styles.focus}>{wod.focus}</Text>
            <Text style={styles.meta}>
              {wod.startTime} · {wod.durationMin} min · {wod.location}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.description}>{wod.description}</Text>

        <View style={styles.movesSection}>
          <Text style={styles.movesKicker}>Session plan</Text>
          <Text style={styles.movesTitle}>Today&apos;s prescription</Text>
          <WodPrescriptionList
            movements={normalizeMovements(wod.movements, wod.moves)}
            variant="member"
          />
        </View>

        <PrimaryButton
          title={starting ? 'Starting…' : 'Start WOD session'}
          onPress={onStart}
          disabled={starting}
          style={styles.startBtn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -spacing.md,
    marginBottom: spacing.lg,
  },
  backBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,10,0.55)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroMedia: {
    height: 320,
    justifyContent: 'flex-end',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCopy: {
    padding: spacing.lg,
    gap: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,10,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  liveText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 1.6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.text,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  focus: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.accent,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  body: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  description: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  movesSection: {
    gap: spacing.sm,
  },
  movesKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  movesTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 18,
    color: colors.text,
  },
  movesList: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  moveRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  moveIndex: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  moveIndexText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
  },
  moveCopy: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  moveName: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.text,
  },
  moveMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  startBtn: {
    marginTop: spacing.sm,
  },
});
