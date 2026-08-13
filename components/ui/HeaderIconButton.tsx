import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';

export const HEADER_ACTION_SIZE = 44;

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
  badge?: React.ReactNode;
};

/** Shared 44pt header action — consistent hit target across phones. */
export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = colors.accent,
  style,
  badge,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, style]}>
      <Ionicons name={icon} size={20} color={color} />
      {badge ? <View style={styles.badgeSlot}>{badge}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: HEADER_ACTION_SIZE,
    height: HEADER_ACTION_SIZE,
    minWidth: HEADER_ACTION_SIZE,
    minHeight: HEADER_ACTION_SIZE,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  btnPressed: {
    backgroundColor: 'rgba(200,255,0,0.22)',
    borderColor: 'rgba(200,255,0,0.5)',
    transform: [{ scale: 0.96 }],
    opacity: 0.95,
  },
  badgeSlot: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
