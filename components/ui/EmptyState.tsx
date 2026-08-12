import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type EmptyStateStep = {
  label: string;
  desc: string;
};

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'panel';
  steps?: EmptyStateStep[];
};

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  steps,
}: EmptyStateProps) {
  if (variant === 'panel') {
    return (
      <View style={styles.panel}>
        <LinearGradient
          colors={['rgba(200,255,0,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.panelGlow}
          pointerEvents="none"
        />
        <View style={styles.panelIconWrap}>
          <Ionicons name={icon} size={22} color={colors.accent} />
        </View>
        <Text style={styles.panelTitle}>{title}</Text>
        {description ? <Text style={styles.panelDescription}>{description}</Text> : null}
        {steps && steps.length > 0 ? (
          <View style={styles.steps}>
            {steps.map((step, index) => (
              <View key={step.label} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepLabel}>{step.label}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {actionLabel && onAction ? (
          <PrimaryButton title={actionLabel} onPress={onAction} style={styles.panelButton} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <PrimaryButton title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    minWidth: 160,
  },
  panel: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.14)',
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  panelGlow: { ...StyleSheet.absoluteFillObject },
  panelIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  panelTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.2,
  },
  panelDescription: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  steps: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.3)',
  },
  stepBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.accent,
  },
  stepCopy: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  stepDesc: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  panelButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
});
