import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { MemberMultiSelect } from '@/components/scheduling/MemberPlacementFields';
import { AppBottomSheet, SheetFormError } from '@/components/ui/AppBottomSheet';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatTime } from '@/lib/utils/dates';
import { STUDIO_LOCATIONS } from '@/lib/scheduling/placement';
import * as adminService from '@/services/admin';
import type { BookingStatus, Profile } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type Tab = 'group' | 'private';

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return format(d, 'yyyy-MM-dd');
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function isUpcoming(iso: string) {
  return parseISO(iso).getTime() >= Date.now() - 60 * 60 * 1000;
}

const CAPACITY_PRESETS = ['8', '12', '16', '20'] as const;
const LEVEL_PRESETS = ['All levels', 'Beginner', 'Intermediate', 'Advanced'] as const;

function durationLabel(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m session`;
  if (h) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${m} min session`;
}

function formatPreviewDate(date: string) {
  try {
    return format(parseISO(`${date}T12:00:00`), 'EEE · d MMM yyyy');
  } catch {
    return date || 'Set date';
  }
}

export default function AdminClassesHubScreen() {
  const [tab, setTab] = useState<Tab>('group');
  const [stats, setStats] = useState<adminService.ClassesHubStats | null>(null);
  const [groups, setGroups] = useState<adminService.StudioClassRow[]>([]);
  const [privates, setPrivates] = useState<adminService.PrivateSessionRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createPrivateOpen, setCreatePrivateOpen] = useState(false);
  const [manageGroup, setManageGroup] = useState<adminService.StudioClassRow | null>(null);
  const [managePrivate, setManagePrivate] = useState<adminService.PrivateSessionRow | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Group form
  const [gTitle, setGTitle] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [gDate, setGDate] = useState(tomorrowDate);
  const [gStart, setGStart] = useState('18:00');
  const [gEnd, setGEnd] = useState('19:00');
  const [gLocation, setGLocation] = useState('Studio Floor');
  const [gCapacity, setGCapacity] = useState('12');
  const [gLevel, setGLevel] = useState('All levels');
  const [gCoachId, setGCoachId] = useState<string | undefined>();
  const [gMemberIds, setGMemberIds] = useState<string[]>([]);

  // Private form
  const [pMemberId, setPMemberId] = useState<string | undefined>();
  const [pCoachId, setPCoachId] = useState<string | undefined>();
  const [pDate, setPDate] = useState(tomorrowDate);
  const [pStart, setPStart] = useState('09:00');
  const [pEnd, setPEnd] = useState('10:00');
  const [pLocation, setPLocation] = useState('Studio A');
  const [pNotes, setPNotes] = useState('Private training');
  const [pStatus, setPStatus] = useState<BookingStatus>('confirmed');

  const load = useCallback(async () => {
    try {
      setError(null);
      const [hubStats, classList, privateList, memberRows, staff] = await Promise.all([
        adminService.getClassesHubStats(),
        adminService.listStudioClasses(),
        adminService.listPrivateSessions(),
        adminService.listMembers(),
        adminService.listCoaches(),
      ]);
      setStats(hubStats);
      setGroups(classList);
      setPrivates(privateList);
      setMembers(memberRows.filter((r) => r.active).map((r) => r.member));
      setCoaches(staff);
      if (!gCoachId && staff[0]) setGCoachId(staff[0].id);
      if (!pCoachId && staff[0]) setPCoachId(staff[0].id);
      if (!pMemberId && memberRows[0]) setPMemberId(memberRows.find((r) => r.active)?.member.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gCoachId, pCoachId, pMemberId]);

  useEffect(() => {
    load();
  }, [load]);

  const upcomingGroups = useMemo(() => groups.filter((g) => isUpcoming(g.starts_at)), [groups]);
  const pastGroups = useMemo(() => groups.filter((g) => !isUpcoming(g.starts_at)), [groups]);
  const upcomingPrivates = useMemo(
    () => privates.filter((p) => isUpcoming(p.starts_at) && p.status !== 'cancelled'),
    [privates],
  );
  const pastPrivates = useMemo(
    () => privates.filter((p) => !isUpcoming(p.starts_at) || p.status === 'cancelled'),
    [privates],
  );

  const createGroup = async () => {
    setFormError(null);
    setSaving(true);
    try {
      await adminService.createStudioClass({
        title: gTitle,
        description: gDesc,
        date: gDate,
        startTime: gStart,
        endTime: gEnd,
        location: gLocation,
        capacity: Number(gCapacity) || 12,
        level: gLevel,
        coachId: gCoachId ?? coaches[0]?.id ?? '',
        memberIds: gMemberIds.length ? gMemberIds : undefined,
      });
      setCreateGroupOpen(false);
      setGTitle('');
      setGDesc('');
      setGMemberIds([]);
      setToast(
        gMemberIds.length
          ? `Group class created · ${gMemberIds.length} member${gMemberIds.length === 1 ? '' : 's'} placed`
          : 'Group class created',
      );
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create');
    } finally {
      setSaving(false);
    }
  };

  const toggleGroupMember = (id: string) => {
    setGMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const createPrivate = async () => {
    setFormError(null);
    setSaving(true);
    try {
      await adminService.createPrivateSession({
        memberId: pMemberId ?? '',
        coachId: pCoachId ?? '',
        date: pDate,
        startTime: pStart,
        endTime: pEnd,
        location: pLocation,
        notes: pNotes,
        status: pStatus,
      });
      setCreatePrivateOpen(false);
      setToast('Private session booked');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create');
    } finally {
      setSaving(false);
    }
  };

  const openManageGroup = (row: adminService.StudioClassRow) => {
    setManageGroup(row);
    setSelectedMembers(row.members.map((m) => m.id));
    setFormError(null);
  };

  const saveGroupRoster = async () => {
    if (!manageGroup) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await adminService.setClassMembers(manageGroup.id, selectedMembers);
      setManageGroup(updated);
      setToast(`${updated.enrolled_count}/${updated.capacity} booked`);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={160} style={{ marginTop: spacing.md }} />
        <Skeleton height={120} style={{ marginTop: spacing.md }} />
        <Skeleton height={200} style={{ marginTop: spacing.md }} />
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
      {/* Hero */}
      <View style={styles.heroHeader}>
        <LinearGradient
          colors={['rgba(200,255,0,0.1)', 'transparent', 'rgba(200,255,0,0.04)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.heroHeaderGlow}
        />
        <View style={styles.heroHeaderTop}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>SCHEDULING HUB</Text>
          </View>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="fitness-outline" size={24} color={colors.accent} />
        </View>
        <Text style={styles.heroKicker}>STUDIO SCHEDULE</Text>
        <Text style={styles.heroTitle}>Classes</Text>
        <Text style={styles.heroSub}>
          Create group classes and private sessions — track bookings and capacity in one place.
        </Text>
      </View>

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      {stats ? (
        <View style={styles.statsBlock}>
          <View style={styles.statsRow}>
            <View style={[styles.statTile, styles.statTileAccent]}>
              <Text style={styles.statValue}>{stats.groupUpcoming}</Text>
              <Text style={styles.statLabel}>Group upcoming</Text>
            </View>
            <View style={[styles.statTile, styles.statTileAccent]}>
              <Text style={styles.statValue}>{stats.privateUpcoming}</Text>
              <Text style={styles.statLabel}>Private upcoming</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statTile}>
              <Text style={[styles.statValue, styles.statValueMuted]}>{stats.groupTotal}</Text>
              <Text style={styles.statLabel}>Group total</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={[styles.statValue, styles.statValueMuted]}>{stats.privateTotal}</Text>
              <Text style={styles.statLabel}>Private total</Text>
            </View>
          </View>
          <View style={styles.capacityCard}>
            <LinearGradient
              colors={['rgba(200,255,0,0.08)', 'transparent']}
              style={styles.capacityGlow}
            />
            <View style={styles.capacityTop}>
              <Text style={styles.capacityKicker}>GROUP CAPACITY</Text>
              <Text style={styles.capacityValue}>
                {stats.groupSpotsFilled}
                <Text style={styles.capacityCap}> / {stats.groupSpotsCapacity || '—'}</Text>
              </Text>
            </View>
            <View style={styles.capacityBar}>
              <View
                style={[
                  styles.capacityFill,
                  {
                    width: `${Math.min(
                      100,
                      stats.groupSpotsCapacity
                        ? (stats.groupSpotsFilled / stats.groupSpotsCapacity) * 100
                        : 0,
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.capacityMeta}>
              Private · {stats.privateConfirmed} confirmed · {stats.privatePending} pending
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.tabs}>
        {(
          [
            { id: 'group' as const, label: 'Group classes', count: stats?.groupUpcoming ?? 0, icon: 'people-outline' as const },
            { id: 'private' as const, label: 'Private sessions', count: stats?.privateUpcoming ?? 0, icon: 'person-outline' as const },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={({ pressed }) => [styles.tab, active && styles.tabOn, pressed && styles.pressed]}>
              {active ? (
                <LinearGradient
                  colors={['rgba(200,255,0,0.18)', 'rgba(200,255,0,0.06)']}
                  style={styles.tabGlow}
                />
              ) : null}
              <Ionicons name={t.icon} size={16} color={active ? colors.accent : colors.textMuted} />
              <Text style={[styles.tabText, active && styles.tabTextOn]}>{t.label}</Text>
              <View style={[styles.tabCount, active && styles.tabCountOn]}>
                <Text style={[styles.tabCountText, active && styles.tabCountTextOn]}>{t.count}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {tab === 'group' ? (
        <>
          <Pressable
            onPress={() => {
              setFormError(null);
              setCreateGroupOpen(true);
            }}
            style={({ pressed }) => [styles.ctaOuter, pressed && styles.pressed]}>
            <LinearGradient
              colors={[colors.accent, '#A8E600']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}>
              <Ionicons name="add-circle-outline" size={18} color={colors.background} />
              <Text style={styles.ctaBtnText}>Create group class</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.sectionKicker}>UPCOMING GROUP CLASSES</Text>
          {upcomingGroups.length === 0 ? (
            <EmptyState title="No upcoming group classes" />
          ) : (
            upcomingGroups.map((row) => (
              <GroupCard key={row.id} row={row} onPress={() => openManageGroup(row)} />
            ))
          )}
          {pastGroups.length > 0 ? (
            <>
              <Text style={[styles.sectionKicker, { marginTop: spacing.lg }]}>PAST CLASSES</Text>
              {pastGroups.slice(0, 5).map((row) => (
                <GroupCard key={row.id} row={row} onPress={() => openManageGroup(row)} past />
              ))}
            </>
          ) : null}
        </>
      ) : (
        <>
          <Pressable
            onPress={() => {
              setFormError(null);
              setCreatePrivateOpen(true);
            }}
            style={({ pressed }) => [styles.ctaOuter, pressed && styles.pressed]}>
            <LinearGradient
              colors={[colors.accent, '#A8E600']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}>
              <Ionicons name="calendar-outline" size={18} color={colors.background} />
              <Text style={styles.ctaBtnText}>Book private session</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.sectionKicker}>UPCOMING PRIVATE SESSIONS</Text>
          {upcomingPrivates.length === 0 ? (
            <EmptyState title="No upcoming private sessions" />
          ) : (
            upcomingPrivates.map((row) => (
              <PrivateCard
                key={row.id}
                row={row}
                onPress={() => {
                  setManagePrivate(row);
                  setFormError(null);
                }}
              />
            ))
          )}
          {pastPrivates.length > 0 ? (
            <>
              <Text style={[styles.sectionKicker, { marginTop: spacing.lg }]}>PAST / CANCELLED</Text>
              {pastPrivates.slice(0, 6).map((row) => (
                <PrivateCard
                  key={row.id}
                  row={row}
                  past
                  onPress={() => {
                    setManagePrivate(row);
                    setFormError(null);
                  }}
                />
              ))}
            </>
          ) : null}
        </>
      )}

      <AppBottomSheet
        visible={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        kicker="Scheduling"
        title="New group class"
        hint="Open to multiple members · set capacity, coach & schedule"
        icon="people-outline"
        footer={
          <>
            <PrimaryButton
              title={saving ? 'Creating…' : 'Create group class'}
              onPress={createGroup}
              disabled={saving || !gTitle.trim()}
            />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setCreateGroupOpen(false)} />
          </>
        }>
        <GroupClassPreview
          title={gTitle}
          date={gDate}
          start={gStart}
          end={gEnd}
          location={gLocation}
          capacity={gCapacity}
          level={gLevel}
          coachName={coaches.find((c) => c.id === gCoachId)?.full_name}
        />
        <FormSection kicker="Step 1" title="Class details">
          <AppInput label="Class title" value={gTitle} onChangeText={setGTitle} placeholder="e.g. HIIT Burn · Strength 45" />
          <AppInput
            label="Description"
            value={gDesc}
            onChangeText={setGDesc}
            placeholder="What members should expect from this session"
            multiline
            style={styles.textArea}
          />
        </FormSection>
        <FormSection kicker="Step 2" title="Date & time">
          <AppInput label="Date" value={gDate} onChangeText={setGDate} placeholder="YYYY-MM-DD" />
          <Text style={styles.fieldHint}>Use format 2026-08-15 · shown as {formatPreviewDate(gDate)}</Text>
          <View style={styles.row}>
            <View style={styles.half}>
              <AppInput label="Starts" value={gStart} onChangeText={setGStart} placeholder="18:00" />
            </View>
            <View style={styles.half}>
              <AppInput label="Ends" value={gEnd} onChangeText={setGEnd} placeholder="19:00" />
            </View>
          </View>
          {durationLabel(gStart, gEnd) ? (
            <View style={styles.durationPill}>
              <Ionicons name="time-outline" size={14} color={colors.accent} />
              <Text style={styles.durationText}>{durationLabel(gStart, gEnd)}</Text>
            </View>
          ) : null}
        </FormSection>
        <FormSection kicker="Step 3" title="Location & capacity">
          <Text style={styles.pickerLabel}>Studio location</Text>
          <View style={styles.chipRow}>
            {STUDIO_LOCATIONS.map((loc) => (
              <OptionChip key={loc} label={loc} active={gLocation === loc} onPress={() => setGLocation(loc)} />
            ))}
          </View>
          <AppInput label="Location" value={gLocation} onChangeText={setGLocation} placeholder="Studio Floor · Room A" />
          <Text style={styles.pickerLabel}>Max spots</Text>
          <View style={styles.chipRow}>
            {CAPACITY_PRESETS.map((cap) => (
              <OptionChip key={cap} label={`${cap} spots`} active={gCapacity === cap} onPress={() => setGCapacity(cap)} />
            ))}
          </View>
          <AppInput label="Custom capacity" value={gCapacity} onChangeText={setGCapacity} keyboardType="number-pad" placeholder="12" />
          <Text style={styles.pickerLabel}>Difficulty level</Text>
          <View style={styles.chipRow}>
            {LEVEL_PRESETS.map((level) => (
              <OptionChip key={level} label={level} active={gLevel === level} onPress={() => setGLevel(level)} />
            ))}
          </View>
        </FormSection>
        <FormSection kicker="Step 4" title="Assign coach">
          <Text style={styles.fieldHint}>The coach leading this group session on the floor.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coachPickerRow}>
            {coaches.map((c) => {
              const active = gCoachId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setGCoachId(c.id)}
                  style={({ pressed }) => [styles.coachOption, active && styles.coachOptionActive, pressed && styles.pressed]}>
                  {active ? (
                    <LinearGradient colors={['rgba(200,255,0,0.16)', 'rgba(200,255,0,0.04)']} style={styles.coachOptionGlow} />
                  ) : null}
                  <Avatar name={c.full_name} uri={c.avatar_url} size={44} />
                  <Text style={[styles.coachOptionName, active && styles.coachOptionNameActive]} numberOfLines={2}>
                    {c.full_name}
                  </Text>
                  {active ? (
                    <View style={styles.coachOptionCheck}>
                      <Ionicons name="checkmark" size={12} color={colors.background} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </FormSection>
        <FormSection kicker="Step 5" title="Place members on roster">
          <MemberMultiSelect
            members={members}
            selectedIds={gMemberIds}
            onToggle={toggleGroupMember}
            capacity={Number(gCapacity) || 12}
            label="Initial roster"
          />
        </FormSection>
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <AppBottomSheet
        visible={createPrivateOpen}
        onClose={() => setCreatePrivateOpen(false)}
        kicker="Scheduling"
        title="Private session"
        hint="1:1 with a member · set coach, time & room"
        icon="person-outline"
        footer={
          <>
            <PrimaryButton title={saving ? 'Booking…' : 'Book private session'} onPress={createPrivate} disabled={saving} />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setCreatePrivateOpen(false)} />
          </>
        }>
        <Text style={styles.pickerLabel}>Member</Text>
        <View style={styles.chipRow}>
          {members.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setPMemberId(m.id)}
              style={[styles.chip, pMemberId === m.id && styles.chipOn]}>
              <Text style={[styles.chipText, pMemberId === m.id && styles.chipTextOn]}>{m.full_name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.pickerLabel}>Coach</Text>
        <View style={styles.chipRow}>
          {coaches.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setPCoachId(c.id)}
              style={[styles.chip, pCoachId === c.id && styles.chipOn]}>
              <Text style={[styles.chipText, pCoachId === c.id && styles.chipTextOn]}>{c.full_name}</Text>
            </Pressable>
          ))}
        </View>
        <AppInput label="Date (YYYY-MM-DD)" value={pDate} onChangeText={setPDate} />
        <View style={styles.row}>
          <View style={styles.half}>
            <AppInput label="Starts" value={pStart} onChangeText={setPStart} />
          </View>
          <View style={styles.half}>
            <AppInput label="Ends" value={pEnd} onChangeText={setPEnd} />
          </View>
        </View>
        <AppInput label="Location" value={pLocation} onChangeText={setPLocation} />
        <AppInput label="Notes / focus" value={pNotes} onChangeText={setPNotes} />
        <Text style={styles.pickerLabel}>Status</Text>
        <View style={styles.chipRow}>
          {(['confirmed', 'pending'] as BookingStatus[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => setPStatus(s)}
              style={[styles.chip, pStatus === s && styles.chipOn]}>
              <Text style={[styles.chipText, pStatus === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <AppBottomSheet
        visible={Boolean(manageGroup)}
        onClose={() => setManageGroup(null)}
        title={manageGroup?.title ?? 'Manage roster'}
        hint={
          manageGroup
            ? `${format(parseISO(manageGroup.starts_at), 'EEE d MMM')} · ${formatTime(manageGroup.starts_at)}–${formatTime(manageGroup.ends_at)} · ${manageGroup.enrolled_count}/${manageGroup.capacity} booked`
            : undefined
        }
        icon="people-outline"
        footer={
          <>
            <PrimaryButton title={saving ? 'Saving…' : `Save roster (${selectedMembers.length})`} onPress={saveGroupRoster} disabled={saving} />
            <PrimaryButton title="Delete class" variant="ghost" onPress={async () => { if (!manageGroup) return; await adminService.deleteStudioClass(manageGroup.id); setManageGroup(null); setToast('Group class deleted'); await load(); }} />
            <PrimaryButton title="Close" variant="secondary" onPress={() => setManageGroup(null)} />
          </>
        }>
        {members.map((m) => {
          const on = selectedMembers.includes(m.id);
          const full = !on && selectedMembers.length >= (manageGroup?.capacity ?? 0);
          return (
            <Pressable
              key={m.id}
              disabled={full}
              onPress={() =>
                setSelectedMembers((prev) =>
                  prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                )
              }
              style={[styles.pickRow, full && styles.pickDisabled]}>
              <View style={styles.pickAvatar}>
                <Text style={styles.pickAvatarText}>{initials(m.full_name)}</Text>
              </View>
              <Text style={styles.pickName}>{m.full_name}</Text>
              <View style={[styles.check, on && styles.checkOn]}>
                <Text style={[styles.checkText, on && styles.checkTextOn]}>{on ? '✓' : ''}</Text>
              </View>
            </Pressable>
          );
        })}
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <AppBottomSheet
        visible={Boolean(managePrivate)}
        onClose={() => setManagePrivate(null)}
        title="Private session"
        hint={managePrivate ? `${managePrivate.memberName} with ${managePrivate.coachName}` : undefined}
        icon="person-outline"
        scroll={false}
        footer={<PrimaryButton title="Close" variant="secondary" onPress={() => setManagePrivate(null)} />}
      >
        {managePrivate ? (
          <>
            <AppCard style={styles.detailCard}>
              <Text style={styles.detailLine}>
                {format(parseISO(managePrivate.starts_at), 'EEE d MMM yyyy')}
              </Text>
              <Text style={styles.detailLine}>
                {formatTime(managePrivate.starts_at)} – {formatTime(managePrivate.ends_at)}
              </Text>
              <Text style={styles.detailLine}>{managePrivate.location ?? 'Studio'}</Text>
              <Text style={styles.detailLine}>{managePrivate.notes ?? 'Private training'}</Text>
              <Text style={styles.detailStatus}>{managePrivate.status.toUpperCase()}</Text>
            </AppCard>
            <View style={styles.row}>
              <PrimaryButton
                title="Confirm"
                style={styles.halfBtn}
                onPress={async () => {
                  await adminService.updatePrivateSessionStatus(managePrivate.id, 'confirmed');
                  setManagePrivate(null);
                  setToast('Session confirmed');
                  await load();
                }}
              />
              <PrimaryButton
                title="Pending"
                variant="secondary"
                style={styles.halfBtn}
                onPress={async () => {
                  await adminService.updatePrivateSessionStatus(managePrivate.id, 'pending');
                  setManagePrivate(null);
                  setToast('Marked pending');
                  await load();
                }}
              />
            </View>
            <PrimaryButton
              title="Cancel session"
              variant="ghost"
              onPress={async () => {
                await adminService.updatePrivateSessionStatus(managePrivate.id, 'cancelled');
                setManagePrivate(null);
                setToast('Session cancelled');
                await load();
              }}
            />
            <PrimaryButton
              title="Delete"
              variant="ghost"
              onPress={async () => {
                await adminService.deletePrivateSession(managePrivate.id);
                setManagePrivate(null);
                setToast('Private session deleted');
                await load();
              }}
            />
          </>
        ) : null}
      </AppBottomSheet>
    </Screen>
  );
}

function FormSection({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.formSection}>
      <View style={styles.formSectionHead}>
        <Text style={styles.formSectionKicker}>{kicker}</Text>
        <Text style={styles.formSectionTitle}>{title}</Text>
      </View>
      <View style={styles.formSectionBody}>{children}</View>
    </View>
  );
}

function OptionChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipOn, pressed && styles.pressed]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function GroupClassPreview({
  title,
  date,
  start,
  end,
  location,
  capacity,
  level,
  coachName,
}: {
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  capacity: string;
  level: string;
  coachName?: string;
}) {
  return (
    <View style={styles.previewCard}>
      <LinearGradient
        colors={['rgba(200,255,0,0.1)', 'rgba(200,255,0,0.02)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.previewGlow}
      />
      <Text style={styles.previewKicker}>Live preview</Text>
      <Text style={styles.previewTitle}>{title.trim() || 'Untitled group class'}</Text>
      <View style={styles.previewRows}>
        <PreviewRow icon="calendar-outline" label="When" value={`${formatPreviewDate(date)} · ${start || '—'}–${end || '—'}`} />
        <PreviewRow icon="location-outline" label="Where" value={location.trim() || 'Set location'} />
        <PreviewRow icon="people-outline" label="Capacity" value={`${capacity || '—'} spots · ${level}`} />
        <PreviewRow icon="person-outline" label="Coach" value={coachName ?? 'Select coach'} />
      </View>
    </View>
  );
}

function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.previewRow}>
      <View style={styles.previewRowIcon}>
        <Ionicons name={icon} size={14} color={colors.accent} />
      </View>
      <View style={styles.previewRowCopy}>
        <Text style={styles.previewRowLabel}>{label}</Text>
        <Text style={styles.previewRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function GroupCard({
  row,
  onPress,
  past = false,
}: {
  row: adminService.StudioClassRow;
  onPress: () => void;
  past?: boolean;
}) {
  const pct = Math.min(100, (row.enrolled_count / Math.max(row.capacity, 1)) * 100);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, past && styles.cardPast, pressed && styles.pressed]}>
      <View style={styles.cardRail} />
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardBadge}>GROUP</Text>
          <Text style={styles.cardTitle}>{row.title}</Text>
          <Text style={styles.cardMeta}>
            {format(parseISO(row.starts_at), 'EEE d MMM')} · {formatTime(row.starts_at)}–
            {formatTime(row.ends_at)}
          </Text>
          <Text style={styles.cardMeta}>
            {row.location} · {row.coachName} · {row.level}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countValue}>
            {row.enrolled_count}
            <Text style={styles.countCap}>/{row.capacity}</Text>
          </Text>
          <Text style={styles.countLabel}>booked</Text>
        </View>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.link}>Manage roster →</Text>
    </Pressable>
  );
}

function PrivateCard({
  row,
  onPress,
  past = false,
}: {
  row: adminService.PrivateSessionRow;
  onPress: () => void;
  past?: boolean;
}) {
  const tone =
    row.status === 'confirmed' ? 'ok' : row.status === 'pending' ? 'warn' : 'muted';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, past && styles.cardPast, pressed && styles.pressed]}>
      <View style={[styles.cardRail, styles.cardRailPrivate]} />
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardBadgePrivate}>PRIVATE</Text>
          <Text style={styles.cardTitle}>{row.memberName}</Text>
          <Text style={styles.cardMeta}>
            with {row.coachName} · {format(parseISO(row.starts_at), 'EEE d MMM')} ·{' '}
            {formatTime(row.starts_at)}–{formatTime(row.ends_at)}
          </Text>
          <Text style={styles.cardMeta}>
            {row.location ?? 'Studio'} · {row.notes ?? 'Private training'}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            tone === 'ok' && styles.statusOk,
            tone === 'warn' && styles.statusWarn,
          ]}>
          <Text
            style={[
              styles.statusText,
              tone === 'ok' && styles.statusTextOk,
              tone === 'warn' && styles.statusTextWarn,
            ]}>
            {row.status}
          </Text>
        </View>
      </View>
      <Text style={styles.link}>Manage session →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  heroHeaderGlow: { ...StyleSheet.absoluteFillObject },
  heroHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textMuted,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  toastText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    flex: 1,
  },
  statsBlock: { gap: spacing.sm, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statTileAccent: {
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 0.8,
    color: colors.accent,
  },
  statValueMuted: { color: colors.text },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
  },
  capacityCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    gap: spacing.sm,
  },
  capacityGlow: { ...StyleSheet.absoluteFillObject },
  capacityTop: { gap: 4, zIndex: 1 },
  capacityKicker: {
    ...typography.sectionKicker,
    fontSize: 9,
  },
  capacityValue: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: 0.8,
    color: colors.text,
  },
  capacityCap: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textMuted,
  },
  capacityBar: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    zIndex: 1,
  },
  capacityFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  capacityMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    zIndex: 1,
  },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabOn: { borderColor: 'rgba(200,255,0,0.4)' },
  tabGlow: { ...StyleSheet.absoluteFillObject },
  tabText: {
    fontFamily: fonts.sansSemiBold,
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  tabTextOn: { color: colors.accent },
  tabCount: {
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  tabCountOn: { backgroundColor: 'rgba(10,10,10,0.35)' },
  tabCountText: {
    fontFamily: fonts.sansBold,
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  tabCountTextOn: { color: colors.accent },
  ctaOuter: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 15,
    paddingHorizontal: spacing.md,
  },
  ctaBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.background,
  },
  sectionKicker: {
    ...typography.sectionKicker,
    fontSize: 10,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.88 },
  card: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.sm,
    padding: spacing.md,
    paddingLeft: spacing.md + 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: spacing.sm,
  },
  cardPast: { opacity: 0.82 },
  cardRail: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  cardRailPrivate: { backgroundColor: '#FACC15' },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  cardCopy: { flex: 1, gap: 4 },
  cardBadge: {
    fontFamily: fonts.sansSemiBold,
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  cardBadgePrivate: {
    fontFamily: fonts.sansSemiBold,
    color: '#FACC15',
    fontSize: 9,
    letterSpacing: 1.4,
  },
  cardTitle: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: 0.6,
  },
  cardMeta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  countBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  countValue: {
    fontFamily: fonts.display,
    color: colors.accent,
    fontSize: 22,
    lineHeight: 24,
  },
  countCap: {
    fontFamily: fonts.sansMedium,
    color: colors.textMuted,
    fontSize: 12,
  },
  countLabel: {
    fontFamily: fonts.sansMedium,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bar: { height: 5, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.full },
  link: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  statusOk: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderColor: 'rgba(74,222,128,0.35)',
  },
  statusWarn: {
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderColor: 'rgba(250,204,21,0.35)',
  },
  statusText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  statusTextOk: { color: colors.success },
  statusTextWarn: { color: '#FACC15' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#121212',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.14)',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sheetHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  sheetHeaderCopy: { flex: 1, gap: 4 },
  sheetKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheetHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  sheetScroll: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  sheetFooter: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  formSection: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  formSectionHead: { gap: 2 },
  formSectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  formSectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  formSectionBody: { gap: spacing.sm },
  fieldHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: -4,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  durationText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accent,
  },
  previewCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: '#101410',
    gap: spacing.sm,
  },
  previewGlow: { ...StyleSheet.absoluteFillObject },
  previewKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  previewTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  previewRows: { gap: spacing.sm },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  previewRowIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
  },
  previewRowCopy: { flex: 1, gap: 2 },
  previewRowLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  previewRowValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  coachPickerRow: { gap: spacing.sm, paddingRight: spacing.sm },
  coachOption: {
    position: 'relative',
    overflow: 'hidden',
    width: 132,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: spacing.sm,
  },
  coachOptionActive: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: '#121812',
  },
  coachOptionGlow: { ...StyleSheet.absoluteFillObject },
  coachOptionName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
    textAlign: 'center',
  },
  coachOptionNameActive: { color: colors.accent },
  coachOptionCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,77,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.28)',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  halfBtn: { flex: 1 },
  pickerLabel: { ...typography.label, color: colors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextOn: { color: colors.accent, fontWeight: '700' },
  formError: { ...typography.caption, color: colors.danger, flex: 1 },
  pickList: { maxHeight: 280 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickDisabled: { opacity: 0.35 },
  pickAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  pickAvatarText: { ...typography.label, color: colors.textSecondary, fontSize: 10 },
  pickName: { ...typography.body, color: colors.text, flex: 1, fontSize: 15 },
  check: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { color: colors.textMuted },
  checkTextOn: { color: '#0A0A0A', fontWeight: '700' },
  detailCard: { gap: spacing.xs },
  detailLine: { ...typography.body, color: colors.text, fontSize: 15 },
  detailStatus: { ...typography.label, color: colors.accent, marginTop: spacing.xs },
});
