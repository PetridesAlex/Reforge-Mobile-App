import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { PendingCelebration } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  celebration: PendingCelebration | null;
  onClose: () => void;
  onViewLeaderboard?: () => void;
};

export function WinnerCelebrationModal({ celebration, onClose, onViewLeaderboard }: Props) {
  useEffect(() => {
    if (celebration) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [celebration]);

  if (!celebration) return null;

  const place =
    celebration.kind === 'weekly_champion'
      ? 1
      : celebration.kind === 'weekly_runner_up'
        ? 2
        : celebration.kind === 'weekly_bronze'
          ? 3
          : null;
  const score = String(celebration.meta.score_display ?? '');
  const xp = Number(celebration.meta.xp ?? 0);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(200,255,0,0.22)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.kicker}>YOU DID IT.</Text>
          {place ? <Text style={styles.place}>{place}</Text> : null}
          <Text style={styles.title}>{celebration.title}</Text>
          {celebration.body ? <Text style={styles.body}>{celebration.body}</Text> : null}
          {score ? (
            <Text style={styles.score}>{score}</Text>
          ) : null}
          {xp > 0 ? <Text style={styles.xp}>+{xp} XP</Text> : null}
          {onViewLeaderboard ? (
            <PrimaryButton title="View Leaderboard" onPress={onViewLeaderboard} />
          ) : null}
          <Pressable onPress={onClose} style={styles.dismiss}>
            <Text style={styles.dismissText}>CONTINUE</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.86)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: '#0E0E0E',
    padding: spacing.xl,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  kicker: {
    fontFamily: fonts.sansBold,
    letterSpacing: 2,
    fontSize: 12,
    color: colors.accent,
  },
  place: {
    fontFamily: fonts.display,
    fontSize: 72,
    lineHeight: 74,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  xp: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  dismiss: { alignItems: 'center', paddingVertical: spacing.md },
  dismissText: {
    fontFamily: fonts.sansBold,
    letterSpacing: 1.6,
    fontSize: 12,
    color: colors.textMuted,
  },
});
