import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { CelebrationContinueButton } from '@/components/ui/CelebrationContinueButton';
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
  const { height } = useWindowDimensions();

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
      <View style={[styles.backdrop, { minHeight: height }]}>
        <LinearGradient
          colors={['rgba(200,255,0,0.35)', 'rgba(10,10,10,0.97)', '#0A0A0A']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View entering={FadeIn.duration(400)} style={styles.stage}>
          <Animated.Text entering={FadeInDown.delay(80).duration(420)} style={styles.kicker}>
            NEW PERSONAL RECORD
          </Animated.Text>
          <Animated.Text
            entering={ZoomIn.delay(140).springify().damping(14)}
            style={styles.title}>
            {(exerciseName ?? 'Exercise').toUpperCase()}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(220).duration(450)} style={styles.value}>
            {top.label}
          </Animated.Text>
          {top.previousValue != null ? (
            <Text style={styles.prev}>Previous best · {top.previousValue}</Text>
          ) : (
            <Text style={styles.prev}>First recorded best</Text>
          )}
          {delta != null && delta > 0 ? (
            <View style={styles.deltaPill}>
              <Text style={styles.deltaText}>+{delta}</Text>
            </View>
          ) : null}
          {prs.length > 1 ? (
            <Text style={styles.more}>{prs.length - 1} more PR{prs.length > 2 ? 's' : ''} this set</Text>
          ) : null}
          <CelebrationContinueButton onPress={onContinue} style={styles.btn} />
        </Animated.View>
        <Pressable onPress={onContinue} style={styles.dismiss} accessibilityLabel="Dismiss" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  stage: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 2,
    paddingVertical: spacing.xxl,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 2.8,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 50,
    color: colors.text,
    textAlign: 'center',
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.accent,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  prev: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  deltaPill: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.4)',
  },
  deltaText: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.accent,
  },
  more: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  btn: { marginTop: spacing.xl, alignSelf: 'stretch' },
  dismiss: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
});
