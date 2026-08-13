import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors, fonts, spacing } from '@/constants/theme';

export type PostActionItem = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  hint?: string;
  actions: PostActionItem[];
  onClose: () => void;
};

export function CommunityPostActionsSheet({
  visible,
  title = 'Post options',
  hint,
  actions,
  onClose,
}: Props) {
  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      kicker="OPTIONS"
      hint={hint}
      icon="ellipsis-horizontal"
      scroll={false}>
      <View style={styles.list}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            onPress={() => {
              onClose();
              // Defer so the sheet can close before navigation / alerts
              requestAnimationFrame(() => action.onPress());
            }}
            style={({ pressed }) => [
              styles.row,
              action.destructive && styles.rowDanger,
              pressed && styles.rowPressed,
            ]}>
            <View style={[styles.iconWrap, action.destructive && styles.iconWrapDanger]}>
              <Ionicons
                name={action.icon}
                size={18}
                color={action.destructive ? '#FF6B6B' : colors.accent}
              />
            </View>
            <Text style={[styles.label, action.destructive && styles.labelDanger]}>
              {action.label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowDanger: {
    borderColor: 'rgba(255,107,107,0.28)',
    backgroundColor: 'rgba(255,107,107,0.06)',
  },
  rowPressed: { opacity: 0.85 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  iconWrapDanger: {
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  label: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  labelDanger: { color: '#FF6B6B' },
  cancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
});
