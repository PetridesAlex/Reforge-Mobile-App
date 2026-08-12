import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import type { Profile } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  members: Profile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  mode?: 'single' | 'multi';
  emptyMessage?: string;
};

export function MemberRosterPicker({
  members,
  selectedIds,
  onChange,
  mode = 'multi',
  emptyMessage = 'No athletes on your roster yet.',
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const phone = m.phone?.toLowerCase() ?? '';
      return (
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        phone.includes(q)
      );
    });
  }, [members, query]);

  const toggle = (id: string) => {
    if (mode === 'single') {
      onChange(selectedIds.includes(id) ? [] : [id]);
      return;
    }
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => onChange(filtered.map((m) => m.id));
  const clearAll = () => onChange([]);

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, email, or phone"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {mode === 'multi' ? (
        <View style={styles.toolbar}>
          <Text style={styles.selectedLabel}>
            {selectedIds.length} selected
          </Text>
          <View style={styles.toolbarActions}>
            <Pressable onPress={selectAll} hitSlop={6}>
              <Text style={styles.toolbarAction}>All</Text>
            </Pressable>
            <Text style={styles.toolbarDivider}>·</Text>
            <Pressable onPress={clearAll} hitSlop={6}>
              <Text style={styles.toolbarAction}>Clear</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((member) => {
            const selected = selectedIds.includes(member.id);
            return (
              <Pressable
                key={member.id}
                onPress={() => toggle(member.id)}
                style={({ pressed }) => [
                  styles.row,
                  selected && styles.rowSelected,
                  pressed && styles.pressed,
                ]}>
                <Avatar name={member.full_name} uri={member.avatar_url} size={44} />
                <View style={styles.copy}>
                  <Text style={styles.name}>{member.full_name}</Text>
                  <Text style={styles.email} numberOfLines={1}>
                    {member.email}
                  </Text>
                </View>
                <View style={[styles.check, selected && styles.checkSelected]}>
                  {selected ? (
                    <Ionicons name="checkmark" size={14} color={colors.background} />
                  ) : mode === 'single' ? (
                    <View style={styles.radioDot} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarAction: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  toolbarDivider: {
    color: colors.textMuted,
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: colors.accentMuted,
  },
  pressed: { opacity: 0.9 },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  email: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  checkSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
