import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { AppInput } from '@/components/ui/AppInput';
import { STUDIO_LOCATIONS, placementTypeLabel, type TrainingPlacementType } from '@/lib/scheduling/placement';
import { formatTime } from '@/lib/utils/dates';
import type { StudioClassRow } from '@/services/admin';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type MemberPlacementFieldsProps = {
  placementType: TrainingPlacementType;
  onPlacementTypeChange: (type: TrainingPlacementType) => void;
  classes: StudioClassRow[];
  classId?: string;
  onClassIdChange: (classId?: string) => void;
  privateDate: string;
  privateStart: string;
  privateEnd: string;
  privateLocation: string;
  privateNotes: string;
  onPrivateDateChange: (value: string) => void;
  onPrivateStartChange: (value: string) => void;
  onPrivateEndChange: (value: string) => void;
  onPrivateLocationChange: (value: string) => void;
  onPrivateNotesChange: (value: string) => void;
};

export function MemberPlacementFields({
  placementType,
  onPlacementTypeChange,
  classes,
  classId,
  onClassIdChange,
  privateDate,
  privateStart,
  privateEnd,
  privateLocation,
  privateNotes,
  onPrivateDateChange,
  onPrivateStartChange,
  onPrivateEndChange,
  onPrivateLocationChange,
  onPrivateNotesChange,
}: MemberPlacementFieldsProps) {
  const upcoming = classes.filter((c) => parseISO(c.starts_at) >= new Date(Date.now() - 60 * 60 * 1000));

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionKicker}>Training placement</Text>
      <Text style={styles.sectionHint}>Where this member trains — group class or private session.</Text>

      <View style={styles.typeRow}>
        {(['none', 'group', 'private'] as const).map((type) => {
          const active = placementType === type;
          return (
            <Pressable
              key={type}
              onPress={() => onPlacementTypeChange(type)}
              style={[styles.typeChip, active && styles.typeChipActive]}>
              <Ionicons
                name={type === 'group' ? 'people-outline' : type === 'private' ? 'person-outline' : 'remove-outline'}
                size={14}
                color={active ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {placementTypeLabel(type)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {placementType === 'group' ? (
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Select group class</Text>
          {upcoming.length === 0 ? (
            <Text style={styles.emptyHint}>No upcoming classes — create one first or choose private.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classRow}>
              {upcoming.map((c) => {
                const active = classId === c.id;
                const full = c.enrolled_count >= c.capacity;
                return (
                  <Pressable
                    key={c.id}
                    disabled={full && !active}
                    onPress={() => onClassIdChange(c.id)}
                    style={[styles.classCard, active && styles.classCardActive, full && !active && styles.classCardFull]}>
                    <Text style={[styles.classTitle, active && styles.classTitleActive]} numberOfLines={2}>
                      {c.title}
                    </Text>
                    <Text style={styles.classMeta}>
                      {format(parseISO(c.starts_at), 'EEE d MMM')} · {formatTime(c.starts_at)}
                    </Text>
                    <Text style={styles.classMeta}>{c.location}</Text>
                    <Text style={styles.classSpots}>
                      {c.enrolled_count}/{c.capacity} booked{full && !active ? ' · Full' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}

      {placementType === 'private' ? (
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Private session details</Text>
          <AppInput label="Date" value={privateDate} onChangeText={onPrivateDateChange} placeholder="YYYY-MM-DD" />
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <AppInput label="Starts" value={privateStart} onChangeText={onPrivateStartChange} placeholder="09:00" />
            </View>
            <View style={styles.timeField}>
              <AppInput label="Ends" value={privateEnd} onChangeText={onPrivateEndChange} placeholder="10:00" />
            </View>
          </View>
          <Text style={styles.panelLabel}>Location</Text>
          <View style={styles.chipRow}>
            {STUDIO_LOCATIONS.map((loc) => (
              <Pressable
                key={loc}
                onPress={() => onPrivateLocationChange(loc)}
                style={[styles.locChip, privateLocation === loc && styles.locChipActive]}>
                <Text style={[styles.locChipText, privateLocation === loc && styles.locChipTextActive]}>{loc}</Text>
              </Pressable>
            ))}
          </View>
          <AppInput
            label="Room / location"
            value={privateLocation}
            onChangeText={onPrivateLocationChange}
            placeholder="Studio A"
          />
          <AppInput
            label="Focus / notes"
            value={privateNotes}
            onChangeText={onPrivateNotesChange}
            placeholder="Private training"
          />
        </View>
      ) : null}
    </View>
  );
}

type MemberMultiSelectProps = {
  members: { id: string; full_name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  capacity: number;
  label?: string;
};

export function MemberMultiSelect({
  members,
  selectedIds,
  onToggle,
  capacity,
  label = 'Initial roster',
}: MemberMultiSelectProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.selectHead}>
        <Text style={styles.sectionKicker}>{label}</Text>
        <Text style={styles.selectCount}>
          {selectedIds.length}/{capacity}
        </Text>
      </View>
      <Text style={styles.sectionHint}>Add members now — you can adjust the roster later.</Text>
      <ScrollView style={styles.memberList} nestedScrollEnabled>
        {members.map((m) => {
          const on = selectedIds.includes(m.id);
          const full = !on && selectedIds.length >= capacity;
          return (
            <Pressable
              key={m.id}
              disabled={full}
              onPress={() => onToggle(m.id)}
              style={[styles.memberRow, on && styles.memberRowOn, full && styles.memberRowFull]}>
              <Text style={[styles.memberName, on && styles.memberNameOn]}>{m.full_name}</Text>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Ionicons name="checkmark" size={14} color={colors.background} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  sectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  sectionHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  typeChipActive: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: colors.accentMuted,
  },
  typeChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  typeChipTextActive: { color: colors.accent },
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  panelLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  emptyHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  classRow: { gap: spacing.sm, paddingRight: spacing.sm },
  classCard: {
    width: 168,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
  },
  classCardActive: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: '#121812',
  },
  classCardFull: { opacity: 0.45 },
  classTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
    minHeight: 34,
  },
  classTitleActive: { color: colors.accent },
  classMeta: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textSecondary,
  },
  classSpots: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeField: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  locChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  locChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  locChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  locChipTextActive: { color: colors.accent },
  selectHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectCount: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  memberList: { maxHeight: 220 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberRowOn: { backgroundColor: 'rgba(200,255,0,0.04)' },
  memberRowFull: { opacity: 0.4 },
  memberName: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  memberNameOn: {
    fontFamily: fonts.sansSemiBold,
    color: colors.accent,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
