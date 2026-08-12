import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppBottomSheet, SheetFormError, sheetStyles } from '@/components/ui/AppBottomSheet';
import { AppInput } from '@/components/ui/AppInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useStudioSync } from '@/hooks/useStudioSync';
import { canManageStudio } from '@/lib/permissions';
import { formatTime } from '@/lib/utils/dates';
import * as adminService from '@/services/admin';
import * as scheduleService from '@/services/schedule';
import type { BookingStatus, Profile } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type ScheduleEntry = scheduleService.ScheduleEntry;

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function sessionStatusStyle(status: string) {
  switch (status) {
    case 'confirmed':
      return {
        bg: 'rgba(74,222,128,0.12)',
        border: 'rgba(74,222,128,0.35)',
        text: colors.success,
      };
    case 'pending':
      return {
        bg: 'rgba(250,204,21,0.12)',
        border: 'rgba(250,204,21,0.4)',
        text: '#FACC15',
      };
    case 'completed':
      return {
        bg: 'rgba(255,255,255,0.06)',
        border: colors.border,
        text: colors.textMuted,
      };
    case 'cancelled':
      return {
        bg: 'rgba(255,77,77,0.12)',
        border: 'rgba(255,77,77,0.35)',
        text: colors.danger,
      };
    default:
      return {
        bg: colors.surface,
        border: colors.border,
        text: colors.textSecondary,
      };
  }
}

export default function CoachCalendarScreen() {
  const { profile } = useAuth();
  const isAdmin = canManageStudio(profile?.role);
  const studioWide = isAdmin;

  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const [selected, setSelected] = useState(new Date());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [wodWeek, setWodWeek] = useState<
    Array<{ id: string; date: string; title: string; start_time: string; joinedCount?: number }>
  >([]);
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});
  const [members, setMembers] = useState<Profile[]>([]);
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addPrivateOpen, setAddPrivateOpen] = useState(false);
  const [manageGroup, setManageGroup] = useState<adminService.StudioClassRow | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [gTitle, setGTitle] = useState('');
  const [gStart, setGStart] = useState('18:00');
  const [gEnd, setGEnd] = useState('19:00');
  const [gLocation, setGLocation] = useState('Studio Floor');
  const [gCapacity, setGCapacity] = useState('12');
  const [gCoachId, setGCoachId] = useState<string | undefined>();

  const [pMemberId, setPMemberId] = useState<string | undefined>();
  const [pCoachId, setPCoachId] = useState<string | undefined>();
  const [pStart, setPStart] = useState('09:00');
  const [pEnd, setPEnd] = useState('10:00');
  const [pLocation, setPLocation] = useState('Studio A');
  const [pNotes, setPNotes] = useState('Private training');

  const scheduleOptions = useMemo(
    () => ({
      coachId: profile?.id ?? '',
      studioWide,
    }),
    [profile?.id, studioWide],
  );

  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const start = startOfWeek(selected, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      const from = format(start, 'yyyy-MM-dd');
      const to = format(end, 'yyyy-MM-dd');

      const [all, memberRows, staff, wods] = await Promise.all([
        scheduleService.getStudioSchedule(scheduleOptions),
        isAdmin ? adminService.listMembers() : Promise.resolve([]),
        adminService.listCoaches(),
        isAdmin ? adminService.listStudioWorkoutsOfTheDay(from, to) : Promise.resolve([]),
      ]);

      setEntries(all);
      setWodWeek(wods);
      setMembers(memberRows.filter((r) => r.active).map((r) => r.member));
      setCoaches(staff);
      if (!gCoachId && staff[0]) setGCoachId(staff[0].id);
      if (!pCoachId && staff[0]) setPCoachId(staff[0].id);
      if (!pMemberId && memberRows[0]) setPMemberId(memberRows.find((r) => r.active)?.member.id);

      const counts: Record<string, number> = {};
      for (let i = 0; i < 7; i += 1) {
        const day = addDays(start, i);
        const key = format(day, 'yyyy-MM-dd');
        const sessionCount = all.filter((entry) => isSameDay(parseISO(entry.startsAt), day)).length;
        const wodCount = wods.some((w) => w.date === key) ? 1 : 0;
        counts[key] = sessionCount + wodCount;
      }
      setDayCounts(counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, scheduleOptions, isAdmin, selected, gCoachId, pCoachId, pMemberId]);

  useEffect(() => {
    load();
  }, [load]);

  useStudioSync(load);

  const dayEntries = useMemo(
    () => entries.filter((entry) => isSameDay(parseISO(entry.startsAt), selected)),
    [entries, selected],
  );

  const selectedDate = scheduleService.dateInputValue(selected);

  const selectedWod = useMemo(
    () => wodWeek.find((w) => w.date === selectedDate) ?? null,
    [wodWeek, selectedDate],
  );

  const groupCount = dayEntries.filter((e) => e.kind === 'group').length;
  const privateCount = dayEntries.filter((e) => e.kind === 'private').length;
  const wodCount = selectedWod ? 1 : 0;

  const openAddForDay = (kind: 'group' | 'private') => {
    setFormError(null);
    if (kind === 'group') {
      setGTitle('');
      setAddGroupOpen(true);
    } else {
      setAddPrivateOpen(true);
    }
  };

  const createGroup = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await adminService.createStudioClass({
        title: gTitle,
        date: selectedDate,
        startTime: gStart,
        endTime: gEnd,
        location: gLocation,
        capacity: Number(gCapacity) || 12,
        level: 'All levels',
        coachId: gCoachId ?? coaches[0]?.id ?? '',
      });
      setAddGroupOpen(false);
      setToast('Group class added');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create class');
    } finally {
      setSaving(false);
    }
  };

  const createPrivate = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await adminService.createPrivateSession({
        memberId: pMemberId ?? '',
        coachId: pCoachId ?? '',
        date: selectedDate,
        startTime: pStart,
        endTime: pEnd,
        location: pLocation,
        notes: pNotes,
        status: 'confirmed',
      });
      setAddPrivateOpen(false);
      setToast('Private session added');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create session');
    } finally {
      setSaving(false);
    }
  };

  const updatePrivateStatus = async (id: string, status: BookingStatus) => {
    await adminService.updatePrivateSessionStatus(id, status);
    setToast(`Session ${status}`);
    await load();
  };

  const openManageGroup = async (entry: ScheduleEntry) => {
    const classes = await adminService.listStudioClasses();
    const row = classes.find((c) => c.id === entry.id);
    if (!row) return;
    setManageGroup(row);
    setSelectedMembers(row.members.map((m) => m.id));
    setFormError(null);
  };

  const saveGroupRoster = async () => {
    if (!manageGroup) return;
    setSaving(true);
    setFormError(null);
    try {
      await adminService.setClassMembers(manageGroup.id, selectedMembers);
      setManageGroup(null);
      setToast('Class roster updated');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not update roster');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={140} style={{ marginTop: spacing.md }} />
        <Skeleton height={160} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.accent}
        />
      }>
      <View style={styles.hero}>
        <LinearGradient
          colors={['rgba(200,255,0,0.08)', 'transparent', 'rgba(200,255,0,0.03)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.heroGlow}
        />
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="calendar-outline" size={24} color={colors.accent} />
          </View>
          <View style={styles.heroDatePill}>
            <Text style={styles.heroDateText}>{format(selected, 'EEE · d MMM')}</Text>
          </View>
        </View>
        <Text style={styles.heroKicker}>STUDIO SCHEDULE</Text>
        <Text style={styles.heroTitle}>Calendar</Text>
        <Text style={styles.heroSub}>
          {isAdmin
            ? 'Manage classes and private sessions — plan the week at a glance.'
            : 'Your coaching sessions — daily and weekly views.'}
        </Text>
      </View>

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      <LinearGradient
        colors={['rgba(200,255,0,0.12)', 'rgba(200,255,0,0.02)', 'transparent']}
        style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{dayEntries.length}</Text>
          <Text style={styles.summaryLabel}>Today total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{wodCount}</Text>
          <Text style={styles.summaryLabel}>WOD</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{groupCount}</Text>
          <Text style={styles.summaryLabel}>Group</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{privateCount}</Text>
          <Text style={styles.summaryLabel}>Private</Text>
        </View>
      </LinearGradient>

      <View style={styles.switch}>
        {(['daily', 'weekly'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={[styles.switchBtn, view === v && styles.switchActive]}>
            <Text style={[styles.switchText, view === v && styles.switchTextActive]}>{v}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'weekly' ? (
        <View style={styles.week}>
          {weekDays.map((d) => {
            const active = isSameDay(d, selected);
            const count = dayCounts[format(d, 'yyyy-MM-dd')] ?? 0;
            return (
              <Pressable
                key={d.toISOString()}
                onPress={() => setSelected(d)}
                style={[styles.weekDay, active && styles.weekDayActive]}>
                <Text style={[styles.weekLabel, active && styles.activeText]}>{format(d, 'EEE')}</Text>
                <Text style={[styles.weekDate, active && styles.activeText]}>{format(d, 'd')}</Text>
                <Text style={[styles.weekCount, active && styles.activeText]}>{count}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.dayNav}>
          <PrimaryButton
            title="Prev"
            variant="secondary"
            onPress={() => setSelected(addDays(selected, -1))}
            style={styles.navBtn}
          />
          <Text style={styles.dayLabel}>{format(selected, 'EEEE d MMM')}</Text>
          <PrimaryButton
            title="Next"
            variant="secondary"
            onPress={() => setSelected(addDays(selected, 1))}
            style={styles.navBtn}
          />
        </View>
      )}

      {isAdmin ? (
        <View style={styles.addRow}>
          <PrimaryButton
            title="+ Publish WOD"
            onPress={() =>
              router.push(`/(coach)/admin/wod?date=${selectedDate}` as never)
            }
            style={styles.addBtn}
          />
          <PrimaryButton
            title="+ Group class"
            onPress={() => openAddForDay('group')}
            style={styles.addBtn}
          />
          <PrimaryButton
            title="+ Private"
            variant="secondary"
            onPress={() => openAddForDay('private')}
            style={styles.addBtn}
          />
        </View>
      ) : null}

      <SectionHeader title={format(selected, 'EEEE d MMM')} kicker="Schedule" />

      {selectedWod ? (
        <Pressable
          onPress={() => router.push(`/(coach)/admin/wod?date=${selectedDate}` as never)}
          style={({ pressed }) => [styles.wodCard, pressed && styles.entryPressed]}>
          <LinearGradient
            colors={['rgba(200,255,0,0.12)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.entryGlow}
          />
          <View style={styles.wodCardTop}>
            <View style={styles.wodPill}>
              <Text style={styles.wodPillText}>WORKOUT OF THE DAY</Text>
            </View>
            <Text style={styles.wodTime}>{selectedWod.start_time}</Text>
          </View>
          <Text style={styles.wodTitle}>{selectedWod.title}</Text>
          <Text style={styles.wodMeta}>
            {selectedWod.joinedCount ?? 0} athletes joined · Tap to edit
          </Text>
        </Pressable>
      ) : isAdmin ? (
        <Pressable
          onPress={() => router.push(`/(coach)/admin/wod?date=${selectedDate}` as never)}
          style={({ pressed }) => [styles.wodEmpty, pressed && styles.entryPressed]}>
          <Ionicons name="flash-outline" size={20} color={colors.accent} />
          <View style={styles.wodEmptyCopy}>
            <Text style={styles.wodEmptyTitle}>No WOD published for this day</Text>
            <Text style={styles.wodEmptyBody}>
              Athletes see coach workouts on Home and their training calendar.
            </Text>
          </View>
          <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
        </Pressable>
      ) : null}

      {dayEntries.length === 0 && !selectedWod ? (
        <EmptyState
          title="Nothing scheduled"
          description={
            isAdmin
              ? 'Add a group class or private session for this day.'
              : 'No sessions on this day yet.'
          }
        />
      ) : (
        dayEntries.map((entry) => {
          const statusTone = sessionStatusStyle(entry.status);
          const clientLabel =
            entry.kind === 'group' ? entry.subtitle : (entry.memberName ?? 'Client');

          return (
            <Pressable
              key={`${entry.kind}-${entry.id}`}
              onPress={() => {
                if (entry.kind === 'group' && isAdmin) void openManageGroup(entry);
              }}
              style={({ pressed }) => [styles.entryCard, pressed && styles.entryPressed]}>
              <LinearGradient
                colors={
                  entry.kind === 'private'
                    ? ['rgba(200,255,0,0.06)', 'transparent']
                    : ['rgba(96,165,250,0.06)', 'transparent']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.entryGlow}
              />
              <View
                style={[
                  styles.entryRail,
                  entry.kind === 'group' ? styles.entryRailGroup : styles.entryRailPrivate,
                ]}
              />

              <View style={styles.entryTime}>
                <Text style={styles.entryTimeStart}>{formatTime(entry.startsAt)}</Text>
                <View style={styles.entryTimeLine} />
                <Text style={styles.entryTimeEnd}>{formatTime(entry.endsAt)}</Text>
                <View style={styles.entryLocationRow}>
                  <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                  <Text style={styles.entryLocation}>{entry.location.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.entryBody}>
                <View style={styles.entryTop}>
                  <View
                    style={[
                      styles.kindPill,
                      entry.kind === 'group' ? styles.kindGroup : styles.kindPrivate,
                    ]}>
                    <Text
                      style={[
                        styles.kindText,
                        entry.kind === 'private' && styles.kindTextPrivate,
                      ]}>
                      {entry.kind === 'group' ? 'GROUP CLASS' : 'PRIVATE SESSION'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusTone.bg, borderColor: statusTone.border },
                    ]}>
                    <Text style={[styles.statusText, { color: statusTone.text }]}>
                      {entry.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.entryTitle}>{entry.title}</Text>

                <View style={styles.entryMetaRow}>
                  <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.entryMeta}>{clientLabel}</Text>
                </View>
                <View style={styles.entryMetaRow}>
                  <Ionicons name="fitness-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.entryMeta}>Coach {entry.coachName}</Text>
                </View>

                {entry.kind === 'group' && isAdmin ? (
                  <Text style={styles.entryAction}>Tap to manage roster →</Text>
                ) : null}

                {entry.kind === 'private' && isAdmin && entry.status !== 'cancelled' ? (
                  <View style={styles.entryActions}>
                    {entry.status === 'pending' ? (
                      <PrimaryButton
                        title="Confirm"
                        onPress={() => updatePrivateStatus(entry.id, 'confirmed')}
                        style={styles.actionBtn}
                      />
                    ) : null}
                    <PrimaryButton
                      title="Complete"
                      variant="secondary"
                      onPress={() => updatePrivateStatus(entry.id, 'completed')}
                      style={styles.actionBtn}
                    />
                    <PrimaryButton
                      title="Cancel"
                      variant="ghost"
                      onPress={() => updatePrivateStatus(entry.id, 'cancelled')}
                      style={styles.actionBtnGhost}
                    />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}

      {isAdmin ? (
        <PrimaryButton
          title="Open full classes hub"
          variant="ghost"
          onPress={() => router.push('/(coach)/admin/classes')}
          style={styles.hubBtn}
        />
      ) : null}

      <AppBottomSheet
        visible={addGroupOpen}
        onClose={() => setAddGroupOpen(false)}
        kicker="Schedule"
        title="Add group class"
        hint={format(selected, 'EEEE d MMM yyyy')}
        icon="people-outline"
        footer={
          <>
            <PrimaryButton title={saving ? 'Saving…' : 'Add class'} onPress={createGroup} disabled={saving} />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setAddGroupOpen(false)} />
          </>
        }>
        <AppInput label="Title" value={gTitle} onChangeText={setGTitle} placeholder="530 Strength" />
        <View style={sheetStyles.row}>
          <View style={sheetStyles.half}>
            <AppInput label="Start" value={gStart} onChangeText={setGStart} placeholder="18:00" />
          </View>
          <View style={sheetStyles.half}>
            <AppInput label="End" value={gEnd} onChangeText={setGEnd} placeholder="19:00" />
          </View>
        </View>
        <AppInput label="Location" value={gLocation} onChangeText={setGLocation} />
        <AppInput label="Capacity" value={gCapacity} onChangeText={setGCapacity} keyboardType="number-pad" />
        <Text style={sheetStyles.pickerLabel}>Coach</Text>
        <View style={sheetStyles.chipRow}>
          {coaches.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setGCoachId(c.id)}
              style={[sheetStyles.chip, gCoachId === c.id && sheetStyles.chipActive]}>
              <Text style={[sheetStyles.chipText, gCoachId === c.id && sheetStyles.chipTextActive]}>
                {c.full_name}
              </Text>
            </Pressable>
          ))}
        </View>
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <AppBottomSheet
        visible={addPrivateOpen}
        onClose={() => setAddPrivateOpen(false)}
        kicker="Schedule"
        title="Add private session"
        hint={format(selected, 'EEEE d MMM yyyy')}
        icon="person-outline"
        footer={
          <>
            <PrimaryButton title={saving ? 'Saving…' : 'Add session'} onPress={createPrivate} disabled={saving} />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setAddPrivateOpen(false)} />
          </>
        }>
        <Text style={sheetStyles.pickerLabel}>Member</Text>
        <View style={sheetStyles.chipRow}>
          {members.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setPMemberId(m.id)}
              style={[sheetStyles.chip, pMemberId === m.id && sheetStyles.chipActive]}>
              <Text style={[sheetStyles.chipText, pMemberId === m.id && sheetStyles.chipTextActive]}>
                {m.full_name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={sheetStyles.pickerLabel}>Coach</Text>
        <View style={sheetStyles.chipRow}>
          {coaches.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setPCoachId(c.id)}
              style={[sheetStyles.chip, pCoachId === c.id && sheetStyles.chipActive]}>
              <Text style={[sheetStyles.chipText, pCoachId === c.id && sheetStyles.chipTextActive]}>
                {c.full_name}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={sheetStyles.row}>
          <View style={sheetStyles.half}>
            <AppInput label="Start" value={pStart} onChangeText={setPStart} placeholder="09:00" />
          </View>
          <View style={sheetStyles.half}>
            <AppInput label="End" value={pEnd} onChangeText={setPEnd} placeholder="10:00" />
          </View>
        </View>
        <AppInput label="Location" value={pLocation} onChangeText={setPLocation} />
        <AppInput label="Notes" value={pNotes} onChangeText={setPNotes} />
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <AppBottomSheet
        visible={Boolean(manageGroup)}
        onClose={() => setManageGroup(null)}
        title={manageGroup?.title ?? 'Manage roster'}
        hint={manageGroup ? `${manageGroup.enrolled_count}/${manageGroup.capacity} booked` : undefined}
        icon="people-outline"
        footer={
          <>
            <PrimaryButton title={saving ? 'Saving…' : 'Save roster'} onPress={saveGroupRoster} disabled={saving} />
            <PrimaryButton title="Close" variant="ghost" onPress={() => setManageGroup(null)} />
          </>
        }>
        {members.map((m) => {
          const on = selectedMembers.includes(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() =>
                setSelectedMembers((prev) =>
                  on ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                )
              }
              style={[styles.memberRow, on && styles.memberRowOn]}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitials}>{initials(m.full_name)}</Text>
              </View>
              <Text style={styles.memberName}>{m.full_name}</Text>
              <Ionicons
                name={on ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={on ? colors.accent : colors.textMuted}
              />
            </Pressable>
          );
        })}
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  heroGlow: { ...StyleSheet.absoluteFillObject },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  heroDatePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroDateText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  heroKicker: {
    ...typography.sectionKicker,
    fontSize: 10,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    maxWidth: 360,
  },
  toast: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  toastText: { ...typography.caption, color: colors.accent, textAlign: 'center' },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: colors.border },
  summaryValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.accent, letterSpacing: 0.8 },
  summaryLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  switch: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  switchBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  switchActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  switchText: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  switchTextActive: { color: colors.accent },
  week: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  weekDayActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  weekLabel: { ...typography.label, color: colors.textMuted, fontSize: 10 },
  weekDate: { ...typography.subtitle, color: colors.text, fontSize: 16 },
  weekCount: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
  activeText: { color: colors.accent },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dayLabel: { ...typography.subtitle, color: colors.text, flex: 1, textAlign: 'center' },
  navBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  addBtn: { flex: 1 },
  entryCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    paddingLeft: spacing.md + 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  entryPressed: { opacity: 0.92 },
  entryGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  entryRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  entryRailGroup: { backgroundColor: '#60A5FA' },
  entryRailPrivate: { backgroundColor: colors.accent },
  entryTime: {
    width: 92,
    gap: 4,
    paddingTop: 2,
  },
  entryTimeStart: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: 0.8,
  },
  entryTimeLine: {
    width: 18,
    height: 1,
    backgroundColor: 'rgba(200,255,0,0.35)',
    marginVertical: 1,
  },
  entryTimeEnd: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 18,
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  entryLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  entryLocation: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.2,
    flex: 1,
  },
  entryBody: { flex: 1, gap: 6, minWidth: 0 },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  kindPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  kindGroup: {
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderColor: 'rgba(96,165,250,0.28)',
  },
  kindPrivate: {
    backgroundColor: colors.accentMuted,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  kindText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    color: '#93C5FD',
    letterSpacing: 1.4,
  },
  kindTextPrivate: {
    color: colors.accent,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  entryTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
    letterSpacing: 0.8,
  },
  entryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryMeta: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    flex: 1,
  },
  entryAction: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  entryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionBtn: {
    flex: 1,
    minWidth: 96,
    paddingVertical: spacing.sm,
  },
  actionBtnGhost: {
    flex: 1,
    minWidth: 96,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  hubBtn: { marginTop: spacing.md, marginBottom: spacing.lg },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  modalScroll: { maxHeight: '88%' },
  modalCard: {
    backgroundColor: '#0C0C0C',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  modalTitle: { ...typography.title, color: colors.text },
  modalHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  pickerLabel: { ...typography.label, color: colors.textSecondary, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontWeight: '700' },
  formError: { ...typography.caption, color: colors.danger },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  memberRowOn: { borderColor: 'rgba(200,255,0,0.35)', backgroundColor: colors.accentMuted },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.accent },
  memberName: { ...typography.body, color: colors.text, flex: 1 },
  wodCard: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  wodCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wodPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  wodPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  wodTime: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  wodTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  wodMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  wodEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
  },
  wodEmptyCopy: { flex: 1, gap: 2 },
  wodEmptyTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  wodEmptyBody: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
