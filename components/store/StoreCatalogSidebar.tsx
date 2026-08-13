import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { StoreCategory } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

type Props = {
  categories: StoreCategory[];
  selectedId: string | null;
  counts: Record<string, number>;
  totalCount: number;
  onSelect: (id: string | null) => void;
  width?: number;
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

export function StoreCatalogSidebar({
  categories,
  selectedId,
  counts,
  totalCount,
  onSelect,
  width = 132,
}: Props) {
  return (
    <View style={[styles.shell, { width }]}>
      <Text style={styles.kicker}>NAV</Text>
      <Text style={styles.title}>SHOP</Text>
      <View style={styles.rule} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        <Pressable
          onPress={() => onSelect(null)}
          style={({ pressed }) => [
            styles.item,
            selectedId == null && styles.itemActive,
            pressed && styles.itemPressed,
          ]}>
          <Ionicons
            name="apps-outline"
            size={15}
            color={selectedId == null ? colors.accent : 'rgba(163,163,163,0.9)'}
          />
          <View style={styles.itemCopy}>
            <Text style={[styles.itemLabel, selectedId == null && styles.itemLabelActive]}>
              ALL
            </Text>
            <Text style={[styles.itemCount, selectedId == null && styles.itemCountActive]}>
              {totalCount}
            </Text>
          </View>
          {selectedId == null ? <View style={styles.activeRail} /> : null}
        </Pressable>

        {categories.map((cat) => {
          const active = selectedId === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => onSelect(cat.id)}
              style={({ pressed }) => [
                styles.item,
                active && styles.itemActive,
                pressed && styles.itemPressed,
              ]}>
              <Ionicons
                name={categoryIcon(cat.slug)}
                size={15}
                color={active ? colors.accent : 'rgba(163,163,163,0.9)'}
              />
              <View style={styles.itemCopy}>
                <Text style={[styles.itemLabel, active && styles.itemLabelActive]} numberOfLines={2}>
                  {cat.name.toUpperCase()}
                </Text>
                <Text style={[styles.itemCount, active && styles.itemCountActive]}>
                  {counts[cat.id] ?? 0}
                </Text>
              </View>
              {active ? <View style={styles.activeRail} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(200,255,0,0.16)',
    backgroundColor: 'rgba(12,12,12,0.96)',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  kicker: {
    paddingHorizontal: spacing.sm + 2,
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    paddingHorizontal: spacing.sm + 2,
    marginTop: 2,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 28,
    color: colors.text,
    letterSpacing: 1,
  },
  rule: {
    width: 28,
    height: 2,
    backgroundColor: colors.accent,
    marginTop: 8,
    marginBottom: spacing.md,
    marginLeft: spacing.sm + 2,
  },
  list: {
    gap: 4,
    paddingHorizontal: 6,
    paddingBottom: spacing.xl,
  },
  item: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  itemActive: {
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderColor: 'rgba(200,255,0,0.28)',
  },
  itemPressed: {
    opacity: 0.9,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: 'rgba(163,163,163,0.95)',
  },
  itemLabelActive: {
    color: colors.accent,
  },
  itemCount: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textMuted,
  },
  itemCountActive: {
    color: 'rgba(200,255,0,0.8)',
  },
  activeRail: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: colors.accent,
  },
});
