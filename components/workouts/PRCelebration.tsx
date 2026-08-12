import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { DetectedPr } from '@/lib/training/prDetection';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  prs: DetectedPr[];
  exerciseName?: string;
  onContinue: () => void;
};

export function PRCelebration({ visible, prs, exerciseName, onContinue }: Props) {
  const top = prs[0];

  useEffect(() => {
    if (visible && Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible]);

  if (!top) return null;

  const delta =
    top.previousValue != null ? Math.round((top.value - top.previousValue) * 10) / 10 : null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <LinearGradient
          colors={['rgba(200,255,0,0.18)', 'rgba(10,10,10,0.96)']}
          style={styles.card}>
          <Text style={styles.kicker}>NEW PERSONAL RECORD</Text>
          <Text style={styles.title}>{exerciseName ?? 'Exercise'}</Text>
          <Text style={styles.value}>{top.label}</Text>
          {top.previousValue != null ? (
            <Text style={styles.prev}>Previous best · {top.previousValue}</Text>
          ) : null}
          {delta != null && delta > 0 ? (
            <View style={styles.deltaPill}>
              <Text style={styles.deltaText}>+{delta}</Text>
            </View>
          ) : null}
          <PrimaryButton title="CONTINUE" onPress={onContinue} style={styles.btn} />
        </LinearGradient>
        <Pressable onPress={onContinue} style={styles.dismiss} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.accent,
    letterSpacing: 1,
  },
  prev: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  deltaPill: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.14)',
  },
  deltaText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accent,
  },
  btn: { marginTop: spacing.lg, alignSelf: 'stretch' },
  dismiss: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
});
