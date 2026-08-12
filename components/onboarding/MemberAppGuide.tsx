import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MEMBER_APP_GUIDE_STEPS } from '@/lib/onboarding/memberGuide';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type Props = {
  visible: boolean;
  memberName?: string | null;
  onComplete: () => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
};

export function MemberAppGuide({ visible, memberName, onComplete, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (visible) setDismissed(false);
  }, [visible]);

  const steps = MEMBER_APP_GUIDE_STEPS;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const progress = (stepIndex + 1) / steps.length;
  const firstName = useMemo(
    () => memberName?.trim().split(/\s+/)[0] ?? null,
    [memberName],
  );

  const finish = async (skipped = false) => {
    setFinishing(true);
    setDismissed(true);
    try {
      if (skipped && onSkip) {
        await onSkip();
      } else {
        await onComplete();
      }
      setStepIndex(0);
    } catch {
      // Keep dismissed — do not block the member if save fails.
    } finally {
      setFinishing(false);
    }
  };

  const onPrimary = async () => {
    if (isLast) {
      await finish(false);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  const onBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  return (
    <Modal visible={visible && !dismissed} animationType="fade" transparent statusBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LinearGradient
          colors={['rgba(200,255,0,0.12)', 'rgba(10,10,10,0.98)', '#0A0A0A']}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={[styles.sheet, { maxWidth: Math.min(width - 24, 520) }]}>
          <View style={styles.topRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Pressable
              onPress={() => void finish(true)}
              hitSlop={12}
              disabled={finishing}
              style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          <Text style={styles.stepCounter}>
            {stepIndex + 1} / {steps.length}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <View style={[styles.iconWrap, { borderColor: `${step.accent}55`, backgroundColor: `${step.accent}18` }]}>
              <Ionicons name={step.icon} size={28} color={step.accent} />
            </View>

            <Text style={styles.kicker}>{step.kicker}</Text>
            <Text style={styles.title}>
              {step.id === 'welcome' && firstName ? `Hey ${firstName},` : step.title}
            </Text>
            {step.id === 'welcome' && firstName ? (
              <Text style={styles.titleSub}>{step.title}</Text>
            ) : null}
            <Text style={styles.body}>{step.body}</Text>

            {step.bullets?.length ? (
              <View style={styles.bulletList}>
                {step.bullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: step.accent }]} />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.dots}>
              {steps.map((s, i) => (
                <View
                  key={s.id}
                  style={[styles.dot, i === stepIndex && styles.dotActive, i <= stepIndex && styles.dotDone]}
                />
              ))}
            </View>

            <View style={styles.actions}>
              {stepIndex > 0 ? (
                <PrimaryButton title="Back" variant="ghost" onPress={onBack} disabled={finishing} />
              ) : (
                <View style={styles.actionSpacer} />
              )}
              <PrimaryButton
                title={
                  finishing
                    ? 'Saving…'
                    : isLast
                      ? 'Start training'
                      : step.ctaLabel ?? 'Continue'
                }
                onPress={() => void onPrimary()}
                disabled={finishing}
                style={styles.primaryAction}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sheet: {
    width: '100%',
    maxHeight: '92%',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  skipBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  stepCounter: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  titleSub: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
    marginTop: -4,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  bulletList: {
    marginTop: spacing.md,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.accent,
  },
  dotDone: {
    backgroundColor: 'rgba(200,255,0,0.35)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionSpacer: {
    width: 88,
  },
  primaryAction: {
    flex: 1,
  },
  pressed: { opacity: 0.88 },
});
