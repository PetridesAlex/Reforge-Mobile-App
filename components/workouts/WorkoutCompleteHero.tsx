import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  durationSeconds: number;
  calories: number | null;
  xpEarned: number;
  hasNewPr: boolean;
  workoutName?: string | null;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function WorkoutCompleteHero({
  durationSeconds,
  calories,
  xpEarned,
  hasNewPr,
  workoutName,
}: Props) {
  const parts = [
    formatDuration(durationSeconds),
    calories != null && calories > 0 ? `${calories} CAL` : null,
    xpEarned > 0 ? `+${xpEarned} XP` : null,
    hasNewPr ? 'NEW PR' : null,
  ].filter(Boolean) as string[];

  return (
    <Animated.View entering={FadeInDown.duration(480)} style={styles.wrap}>
      <LinearGradient
        colors={['rgba(200,255,0,0.24)', 'rgba(200,255,0,0.04)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
      />
      <Text style={styles.kicker}>WORKOUT COMPLETE</Text>
      {workoutName ? (
        <Text style={styles.name} numberOfLines={2}>
          {workoutName.toUpperCase()}
        </Text>
      ) : null}
      <Text style={styles.line}>{parts.join(' · ')}</Text>
      {hasNewPr ? (
        <View style={styles.prPill}>
          <Text style={styles.prPillText}>PERSONAL RECORD BROKEN</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.42)',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.xl,
    gap: spacing.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.accent,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    color: colors.text,
  },
  line: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.accent,
    letterSpacing: 0.4,
  },
  prPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  prPillText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.accent,
  },
});
