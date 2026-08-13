import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** In-app confirm that works on web (unlike Alert.alert). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.row}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
              <Text style={styles.btnGhostText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.btn,
                destructive ? styles.btnDanger : styles.btnPrimary,
                pressed && styles.pressed,
              ]}>
              <Text style={destructive ? styles.btnDangerText : styles.btnPrimaryText}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#141414',
    padding: spacing.lg,
    gap: 10,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.text,
  },
  message: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 4,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  btnGhostText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnPrimaryText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.background,
  },
  btnDanger: {
    backgroundColor: 'rgba(255,107,107,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.45)',
  },
  btnDangerText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: '#FF6B6B',
  },
  pressed: { opacity: 0.88 },
});
