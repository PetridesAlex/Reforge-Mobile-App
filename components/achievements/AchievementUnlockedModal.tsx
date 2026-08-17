import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

import { CelebrationContinueButton } from '@/components/ui/CelebrationContinueButton';
import type { Achievement } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  achievement: Achievement | null;
  onClose: () => void;
};

export function AchievementUnlockedModal({ visible, achievement, onClose }: Props) {
  useEffect(() => {
    if (visible && achievement) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible, achievement]);

  if (!achievement) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(200,255,0,0.2)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.kicker}>ACHIEVEMENT UNLOCKED</Text>
          <Text style={styles.title}>{achievement.title}</Text>
          <Text style={styles.body}>{achievement.description}</Text>
          <Text style={styles.xp}>+{achievement.xp_reward ?? 50} XP</Text>
          <CelebrationContinueButton onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.xl,
    gap: spacing.md,
    overflow: 'hidden',
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
    lineHeight: 38,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  xp: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
});
