import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

type OnboardingLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  /** Soft lime vignette — default on for premium depth */
  atmosphere?: boolean;
};

export function OnboardingLayout({
  children,
  footer,
  scroll = true,
  atmosphere = true,
}: OnboardingLayoutProps) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, styles.pad]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      {atmosphere ? (
        <>
          <LinearGradient
            colors={['rgba(200,255,0,0.07)', 'transparent', 'transparent']}
            locations={[0, 0.28, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(10,10,10,0.55)', colors.background]}
            locations={[0.55, 0.82, 1]}
            style={styles.bottomVeil}
            pointerEvents="none"
          />
        </>
      ) : null}
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.fill}>{body}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  bottomVeil: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    backgroundColor: 'rgba(10,10,10,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200,255,0,0.12)',
    gap: spacing.sm,
  },
});
