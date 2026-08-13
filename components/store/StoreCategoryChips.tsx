import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import type { StoreCategory } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

type Props = {
  categories: StoreCategory[];
  selectedId: string | null;
  counts?: Record<string, number>;
  totalCount?: number;
  onSelect: (id: string | null) => void;
};

function categoryIcon(slug: string): keyof typeof Ionicons.glyphMap {
  switch (slug) {
    case 't-shirts':
      return 'shirt-outline';
    case 'hoodies':
      return 'layers-outline';
    case 'socks':
      return 'walk-outline';
    case 'headwear':
      return 'baseball-outline';
    default:
      return 'grid-outline';
  }
}

function CategoryChip({
  label,
  icon,
  count,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    glow.value = withTiming(active ? 1 : 0, { duration: 220 });
  }, [active, glow]);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: active ? 'rgba(200,255,0,0.85)' : 'rgba(255,255,255,0.1)',
    backgroundColor: active ? 'rgba(200,255,0,0.16)' : 'rgba(20,20,20,0.92)',
    shadowOpacity: 0.15 + glow.value * 0.35,
  }));

  const barStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scaleX: 0.35 + glow.value * 0.65 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 16, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
    >
      <Animated.View style={[styles.chip, shellStyle]}>
        <View style={styles.chipInner}>
          <Ionicons name={icon} size={13} color={active ? colors.accent : 'rgba(163,163,163,0.85)'} />
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
          {typeof count === 'number' ? (
            <View style={[styles.count, active && styles.countActive]}>
              <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
            </View>
          ) : null}
        </View>
        <Animated.View style={[styles.activeBar, barStyle]} />
      </Animated.View>
    </Pressable>
  );
}

export function StoreCategoryChips({
  categories,
  selectedId,
  counts,
  totalCount,
  onSelect,
}: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <CategoryChip
          label="ALL"
          icon="apps-outline"
          count={totalCount}
          active={selectedId == null}
          onPress={() => onSelect(null)}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c.id}
            label={c.name.toUpperCase()}
            icon={categoryIcon(c.slug)}
            count={counts?.[c.id]}
            active={selectedId === c.id}
            onPress={() => onSelect(c.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: spacing.md,
    paddingBottom: 4,
  },
  chip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 8,
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chipText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: 'rgba(163,163,163,0.92)',
  },
  chipTextActive: {
    color: colors.accent,
  },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  countActive: {
    backgroundColor: 'rgba(200,255,0,0.18)',
    borderColor: 'rgba(200,255,0,0.35)',
  },
  countText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: 'rgba(163,163,163,0.95)',
  },
  countTextActive: {
    color: colors.accent,
  },
  activeBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    height: 2,
    backgroundColor: colors.accent,
  },
});
