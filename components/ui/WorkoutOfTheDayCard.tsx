import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MediaImage } from '@/components/ui/MediaImage';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { WodPrescriptionList } from '@/components/workouts/WodPrescriptionList';
import { workoutImageForDay } from '@/constants/media';
import { normalizeMovements } from '@/lib/workouts/wod';
import * as memberService from '@/services/member';
import type { MemberDashboard } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Wod = NonNullable<MemberDashboard['workoutOfTheDay']>;

type Props = {
  memberId: string;
  wod: Wod;
  onUpdated: (next: Wod | null) => void;
};

function MetricPill({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.metricPill}>
      <Ionicons name={icon} size={13} color={colors.accent} />
      <Text style={styles.metricPillText}>{label}</Text>
    </View>
  );
}

export function WorkoutOfTheDayCard({ memberId, wod, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prescriptionMovements = normalizeMovements(wod.movements, wod.moves);

  const respond = async (status: 'joined' | 'skipped') => {
    setBusy(true);
    setError(null);
    try {
      const next = await memberService.setWorkoutOfTheDayRsvp(memberId, wod.id, status);
      onUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.accentRail} />

      <View style={styles.hero}>
        <MediaImage uri={workoutImageForDay(wod.title)} style={styles.heroImage} overlay />
        <LinearGradient
          colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.55)', 'rgba(10,10,10,0.98)']}
          locations={[0, 0.45, 1]}
          style={styles.heroFade}
        />
        <LinearGradient
          colors={['rgba(200,255,0,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGlow}
        />

        <View style={styles.heroTop}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>TODAY</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons name="flash" size={16} color={colors.accent} />
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>Workout of the day</Text>
          <Text style={styles.title}>{wod.title}</Text>
          <View style={styles.heroMetrics}>
            <MetricPill icon="time-outline" label={wod.startTime} />
            <MetricPill icon="timer-outline" label={`${wod.durationMin} min`} />
            <MetricPill icon="location-outline" label={wod.location} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.focusBlock}>
          <Text style={styles.focusKicker}>Focus</Text>
          <Text style={styles.focus}>{wod.focus}</Text>
          <Text style={styles.description}>{wod.description}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoTile}>
            <Text style={styles.infoValue}>{wod.level}</Text>
            <Text style={styles.infoLabel}>Level</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoTile}>
            <Text style={[styles.infoValue, styles.infoValueAccent]}>{wod.joinedCount}</Text>
            <Text style={styles.infoLabel}>Joined</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoTile}>
            <Text style={styles.infoValue}>{prescriptionMovements.length}</Text>
            <Text style={styles.infoLabel}>Movements</Text>
          </View>
        </View>

        <View style={styles.movesSection}>
          <View style={styles.movesHeader}>
            <Text style={styles.movesKicker}>Session plan</Text>
            <Text style={styles.movesTitle}>Today&apos;s moves</Text>
          </View>
          <WodPrescriptionList movements={prescriptionMovements} variant="member" />
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        {wod.myStatus === 'joined' ? (
          <View style={styles.statusBannerJoined}>
            <View style={styles.statusTopRow}>
              <View style={styles.statusIconJoined}>
                <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitleJoined}>You&apos;re in</Text>
                <Text style={styles.statusTextJoined}>See you on the floor — coach-led session</Text>
              </View>
            </View>
            <PrimaryButton
              title={busy ? 'Updating…' : 'Skip today'}
              variant="ghost"
              onPress={() => respond('skipped')}
              disabled={busy}
              style={styles.statusBtn}
            />
          </View>
        ) : wod.myStatus === 'skipped' ? (
          <View style={styles.statusBannerSkipped}>
            <View style={styles.statusTopRow}>
              <View style={styles.statusIconSkipped}>
                <Ionicons name="remove-circle-outline" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitleSkipped}>Skipped today</Text>
                <Text style={styles.statusTextSkipped}>Changed your mind? Join before class starts.</Text>
              </View>
            </View>
            <PrimaryButton
              title={busy ? 'Updating…' : 'Join WOD'}
              variant="secondary"
              onPress={() => respond('joined')}
              disabled={busy}
              style={styles.statusBtnFull}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <PrimaryButton
              title={busy ? 'Joining…' : 'Join workout'}
              onPress={() => respond('joined')}
              disabled={busy}
              style={styles.actionBtnPrimary}
            />
            <PrimaryButton
              title={busy ? '…' : 'Skip'}
              variant="secondary"
              onPress={() => respond('skipped')}
              disabled={busy}
              style={styles.actionBtnSecondary}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
  },
  accentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
    zIndex: 2,
  },
  hero: {
    height: 196,
    position: 'relative',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md + 4,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  liveText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1.8,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,10,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  heroCopy: {
    position: 'absolute',
    left: spacing.md + 4,
    right: spacing.md,
    bottom: spacing.md,
    gap: 6,
    zIndex: 1,
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,10,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricPillText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.2,
  },
  body: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.md + 4,
    gap: spacing.md,
  },
  focusBlock: {
    gap: 6,
  },
  focusKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  focus: {
    fontFamily: fonts.sansSemiBold,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  description: {
    fontFamily: fonts.sans,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  infoTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: 4,
  },
  infoDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  infoValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
    letterSpacing: 0.6,
  },
  infoValueAccent: {
    color: colors.accent,
  },
  infoLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  movesSection: {
    gap: spacing.sm,
  },
  movesHeader: {
    gap: 2,
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
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  movesList: {
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  moveIndexText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
  },
  moveCopy: {
    flex: 1,
    paddingTop: 4,
    gap: spacing.sm,
  },
  moveName: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  moveConnector: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,77,77,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.25)',
  },
  error: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtnPrimary: {
    flex: 1.4,
  },
  actionBtnSecondary: {
    flex: 1,
  },
  statusBannerJoined: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    gap: spacing.sm,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  statusIconJoined: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  statusCopy: {
    gap: 2,
  },
  statusTitleJoined: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.accent,
  },
  statusTextJoined: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  statusBannerSkipped: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  statusIconSkipped: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  statusTitleSkipped: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  statusTextSkipped: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  statusBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
  statusBtnFull: {
    alignSelf: 'stretch',
  },
});
