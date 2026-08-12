import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';

export type AppBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  hint?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  sheetStyle?: StyleProp<ViewStyle>;
};

export function AppBottomSheet({
  visible,
  onClose,
  title,
  kicker,
  hint,
  icon,
  children,
  footer,
  scroll = true,
  sheetStyle,
}: AppBottomSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityLabel="Close sheet" />
        <View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            {icon ? (
              <View style={styles.headerIcon}>
                <Ionicons name={icon} size={20} color={colors.accent} />
              </View>
            ) : null}
            <View style={styles.headerCopy}>
              {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
              <Text style={styles.title}>{title}</Text>
              {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </View>
          </View>

          {scroll ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.body}>{children}</View>
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function SheetFormError({ message }: { message: string }) {
  return (
    <View style={sheetStyles.errorBox}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
      <Text style={sheetStyles.errorText}>{message}</Text>
    </View>
  );
}

export const sheetStyles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  pickerLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontFamily: fonts.sansSemiBold },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,77,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.28)',
  },
  errorText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#121212',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(200,255,0,0.16)',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  headerCopy: { flex: 1, gap: 4 },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  body: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
