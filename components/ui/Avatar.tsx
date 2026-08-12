import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, radius, typography } from '@/constants/theme';

type AvatarProps = {
  name?: string | null;
  uri?: string | null;
  size?: number;
  editable?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

function initialsFrom(name?: string | null) {
  if (!name?.trim()) return 'RF';
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({ name, uri, size = 80, editable = false, onPress, style }: AvatarProps) {
  const content = (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.32 }]}>{initialsFrom(name)}</Text>
      )}
      {editable ? (
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeText}>+</Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.accentMuted,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    ...typography.title,
    color: colors.accent,
    fontWeight: '700',
  },
  editBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  editBadgeText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
    marginTop: -1,
  },
  pressed: {
    opacity: 0.9,
  },
});
