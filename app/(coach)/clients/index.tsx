import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format, parseISO, addDays } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AddBillingMemberSheet } from '@/components/billing/AddBillingMemberSheet';
import {
  MemberMultiSelect,
  MemberPlacementFields,
} from '@/components/scheduling/MemberPlacementFields';
import { AppBottomSheet, SheetFormError, sheetStyles } from '@/components/ui/AppBottomSheet';
import { AppInput } from '@/components/ui/AppInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { canManageAllClients, canManageStudio } from '@/lib/permissions';
import { inviteSuccessMessage, manualMemberModalHint, manualMemberSuccessMessage } from '@/lib/admin/config';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type { TrainingPlacementType } from '@/lib/scheduling/placement';
import { STUDIO_LOCATIONS } from '@/lib/scheduling/placement';
import { formatTime } from '@/lib/utils/dates';
import { genderIcon, genderLabel, genderTone } from '@/lib/utils/gender';
import * as adminService from '@/services/admin';
import * as coachService from '@/services/coach';
import { ABSENCE_SCOPE_LABELS, listStudioAbsences } from '@/services/absences';
import type { ClientCard, MemberGender, Profile, MemberAbsence } from '@/types';
import type { MembershipStatus } from '@/services/mock/data';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type Tab = 'roster' | 'classes';
type GenderFilter = 'all' | 'male' | 'female';

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

export default function ClientsScreen() {
  const { profile } = useAuth();
  const studioWide = canManageAllClients(profile?.role);
  const admin = canManageStudio(profile?.role);

  const [tab, setTab] = useState<Tab>('roster');
  const [clients, setClients] = useState<ClientCard[]>([]);
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<adminService.StudioClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberAddMode, setMemberAddMode] = useState<'invite' | 'manual'>('invite');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [coachId, setCoachId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [manageClass, setManageClass] = useState<adminService.StudioClassRow | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [classTitle, setClassTitle] = useState('');
  const [classDesc, setClassDesc] = useState('');
  const [classDate, setClassDate] = useState(tomorrowDate);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [location, setLocation] = useState('Studio Floor');
  const [capacity, setCapacity] = useState('12');
  const [level, setLevel] = useState('All levels');
  const [classCoachId, setClassCoachId] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const [billingByMember, setBillingByMember] = useState<
    Record<string, adminService.MembershipRow['membership']>
  >({});
  const [absencesByMember, setAbsencesByMember] = useState<Record<string, MemberAbsence[]>>({});
  const [addingBillingId, setAddingBillingId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [billingAddOpen, setBillingAddOpen] = useState(false);
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [billingPlan, setBillingPlan] = useState<'monthly' | 'quarterly' | 'annual' | 'drop-in'>('monthly');
  const [billingAmount, setBillingAmount] = useState('180');
  const [billingStatus, setBillingStatus] = useState<MembershipStatus>('unpaid');
  const [billingNotes, setBillingNotes] = useState('Started with REFORGE');
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingFormError, setBillingFormError] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [inviteGender, setInviteGender] = useState<MemberGender | undefined>();
  const [invitePlacementType, setInvitePlacementType] = useState<TrainingPlacementType>('none');
  const [inviteClassId, setInviteClassId] = useState<string | undefined>();
  const [invitePrivateDate, setInvitePrivateDate] = useState(tomorrowDate);
  const [invitePrivateStart, setInvitePrivateStart] = useState('09:00');
  const [invitePrivateEnd, setInvitePrivateEnd] = useState('10:00');
  const [invitePrivateLocation, setInvitePrivateLocation] = useState('Studio A');
  const [invitePrivateNotes, setInvitePrivateNotes] = useState('Private training');
  const [createMemberIds, setCreateMemberIds] = useState<string[]>([]);

  const loadBilling = useCallback(async () => {
    if (!admin) return;
    try {
      const rows = await adminService.listMemberships({ status: 'all' });
      setBillingByMember(Object.fromEntries(rows.map((r) => [r.member.id, r.membership])));
    } catch {
      // Billing is optional — roster works without membership rows.
    }
  }, [admin]);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const list = await coachService.getClients(profile.id, { studioWide });
      setClients(list);

      if (admin) {
        const [coachesResult, classesResult] = await Promise.allSettled([
          adminService.listCoaches(),
          adminService.listStudioClasses(),
        ]);

        if (coachesResult.status === 'fulfilled') {
          setCoaches(coachesResult.value);
        }

        if (classesResult.status === 'fulfilled') {
          setClasses(classesResult.value);
        }

        await loadBilling();
      }

      try {
        const from = format(new Date(), 'yyyy-MM-dd');
        const to = format(addDays(new Date(), 21), 'yyyy-MM-dd');
        const studioAbsences = await listStudioAbsences(from, to);
        const byMember: Record<string, MemberAbsence[]> = {};
        for (const row of studioAbsences) {
          (byMember[row.member_id] ??= []).push(row);
        }
        setAbsencesByMember(byMember);
      } catch {
        // Absences are optional until migration 009 is applied.
      }
    } catch (e) {
      setError(formatSupabaseError(e, 'Failed to load roster'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, studioWide, admin, loadBilling]);

  useEffect(() => {
    if (coaches.length > 0) {
      setCoachId((current) => current ?? coaches[0]?.id);
      setClassCoachId((current) => current ?? coaches[0]?.id);
    }
  }, [coaches]);

  useEffect(() => {
    load();
  }, [load]);

  const upcomingClasses = useMemo(
    () => classes.filter((c) => parseISO(c.starts_at) >= new Date(Date.now() - 60 * 60 * 1000)),
    [classes],
  );
  const pastClasses = useMemo(
    () => classes.filter((c) => parseISO(c.starts_at) < new Date(Date.now() - 60 * 60 * 1000)),
    [classes],
  );

  const rosterStats = useMemo(() => {
    const men = clients.filter((c) => c.member.gender === 'male').length;
    const women = clients.filter((c) => c.member.gender === 'female').length;
    const upcoming = clients.filter((c) => c.upcomingSession).length;
    const onBilling = clients.filter((c) => {
      const billing = billingByMember[c.member.id];
      return Boolean(
        billing &&
          (billing.notes?.includes('Started with REFORGE') ||
            billing.status === 'paid' ||
            billing.last_paid_at),
      );
    }).length;
    return { men, women, upcoming, onBilling, total: clients.length };
  }, [clients, billingByMember]);

  const filteredClients = useMemo(() => {
    if (genderFilter === 'all') return clients;
    return clients.filter((c) => c.member.gender === genderFilter);
  }, [clients, genderFilter]);

  const openMemberSheet = (mode: 'invite' | 'manual') => {
    setMemberAddMode(mode);
    setFormError(null);
    setInviteOpen(true);
  };

  const resetMemberForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setInviteGender(undefined);
    setInvitePlacementType('none');
    setInviteClassId(undefined);
  };

  const buildPlacement = () => {
    if (invitePlacementType === 'group' && inviteClassId) {
      return { type: 'group' as const, classId: inviteClassId };
    }
    if (invitePlacementType === 'private') {
      return {
        type: 'private' as const,
        date: invitePrivateDate,
        startTime: invitePrivateStart,
        endTime: invitePrivateEnd,
        location: invitePrivateLocation,
        notes: invitePrivateNotes,
        coachId,
      };
    }
    return { type: 'none' as const };
  };

  const onInvite = async () => {
    setFormError(null);
    setSaving(true);
    try {
      const placement = buildPlacement();

      if (invitePlacementType === 'group' && !inviteClassId) {
        throw new Error('Select a group class or choose another placement');
      }

      await adminService.inviteMember({
        email,
        fullName,
        phone: phone || undefined,
        coachId,
        gender: inviteGender,
        placement,
      });
      setInviteOpen(false);
      resetMemberForm();
      setToast(inviteSuccessMessage('member'));
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setSaving(false);
    }
  };

  const onAddManually = async () => {
    setFormError(null);
    setSaving(true);
    try {
      const placement = buildPlacement();

      if (invitePlacementType === 'group' && !inviteClassId) {
        throw new Error('Select a group class or choose another placement');
      }

      if (!fullName.trim()) {
        throw new Error('Full name is required');
      }
      if (!email.trim() && !phone.trim()) {
        throw new Error('Enter an email or contact number');
      }

      await adminService.addMemberManually({
        fullName,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        coachId,
        gender: inviteGender,
        placement,
      });
      setInviteOpen(false);
      resetMemberForm();
      setToast(manualMemberSuccessMessage());
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setSaving(false);
    }
  };

  const onCreateClass = async () => {
    setFormError(null);
    setSaving(true);
    try {
      await adminService.createStudioClass({
        title: classTitle,
        description: classDesc,
        date: classDate,
        startTime,
        endTime,
        location,
        capacity: Number(capacity) || 12,
        level,
        coachId: classCoachId ?? coaches[0]?.id ?? '',
        memberIds: createMemberIds.length ? createMemberIds : undefined,
      });
      setCreateOpen(false);
      setClassTitle('');
      setClassDesc('');
      setCreateMemberIds([]);
      setToast(
        createMemberIds.length
          ? `Class created · ${createMemberIds.length} members placed`
          : 'Class created — add members from Manage roster',
      );
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create class');
    } finally {
      setSaving(false);
    }
  };

  const toggleCreateMember = (id: string) => {
    setCreateMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openManage = (row: adminService.StudioClassRow) => {
    setManageClass(row);
    setSelectedMembers(row.members.map((m) => m.id));
    setFormError(null);
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const addClientToBilling = async (client: ClientCard) => {
    setAddingBillingId(client.member.id);
    try {
      await adminService.addExistingMemberToBilling(client.member.id);
      await loadBilling();
      router.push({
        pathname: '/(coach)/clients/[id]',
        params: { id: client.member.id, tab: 'billing' },
      });
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not add to billing');
    } finally {
      setAddingBillingId(null);
    }
  };

  const submitBillingMember = async () => {
    setBillingSaving(true);
    setBillingFormError(null);
    try {
      await adminService.createBillingMember({
        fullName: billingName,
        email: billingEmail.trim() || undefined,
        phone: billingPhone.trim() || undefined,
        plan: billingPlan,
        amountEur: Number(billingAmount) || 180,
        status: billingStatus,
        notes: billingNotes.trim() || 'Started with REFORGE',
      });
      setBillingAddOpen(false);
      setBillingName('');
      setBillingEmail('');
      setBillingPhone('');
      setToast('Member added to billing');
      await load();
    } catch (e) {
      setBillingFormError(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setBillingSaving(false);
    }
  };

  const saveMembers = async () => {
    if (!manageClass) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await adminService.setClassMembers(manageClass.id, selectedMembers);
      setManageClass(updated);
      setToast(`${updated.enrolled_count}/${updated.capacity} booked on ${updated.title}`);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not update roster');
    } finally {
      setSaving(false);
    }
  };

  const removeClass = async (classId: string) => {
    await adminService.deleteStudioClass(classId);
    setManageClass(null);
    setToast('Class removed');
    await load();
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={120} style={{ marginTop: spacing.lg }} />
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
          colors={['rgba(200,255,0,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGlow}
        />
        <Text style={styles.heroKicker}>{admin ? 'Studio roster' : 'Your athletes'}</Text>
        <Text style={styles.heroTitle}>{admin ? 'Roster' : 'Clients'}</Text>
        <Text style={styles.heroSub}>
          {admin
            ? 'Members, group classes, and who is booked on each session'
            : 'Athletes assigned to you'}
        </Text>
      </View>

      {admin ? (
        <View style={styles.tabBar}>
          {(
            [
              { id: 'roster' as const, label: 'Members', count: clients.length, icon: 'people-outline' as const },
              { id: 'classes' as const, label: 'Classes', count: upcomingClasses.length, icon: 'fitness-outline' as const },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[styles.tab, active && styles.tabOn]}>
                {active ? (
                  <LinearGradient
                    colors={['rgba(200,255,0,0.14)', 'rgba(200,255,0,0.04)']}
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
      ) : null}

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      {admin ? (
        <>
          <View style={styles.toolbar}>
            <Pressable
              onPress={() => openMemberSheet('invite')}
              style={({ pressed }) => [styles.toolPrimary, pressed && styles.pressed]}>
              <Ionicons name="mail-outline" size={16} color={colors.background} />
              <Text style={styles.toolPrimaryText}>Invite member</Text>
            </Pressable>
            <Pressable
              onPress={() => openMemberSheet('manual')}
              style={({ pressed }) => [styles.toolSecondary, pressed && styles.pressed]}>
              <Ionicons name="person-add-outline" size={16} color={colors.accent} />
              <Text style={styles.toolSecondaryText}>Add manually</Text>
            </Pressable>
          </View>
          <View style={styles.toolbar}>
            <Pressable
              onPress={() => {
                setBillingFormError(null);
                setBillingAddOpen(true);
              }}
              style={({ pressed }) => [styles.toolSecondary, pressed && styles.pressed, styles.toolFlex]}>
              <Ionicons name="card-outline" size={16} color={colors.accent} />
              <Text style={styles.toolSecondaryText}>Add to billing</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(coach)/admin/memberships')}
              style={({ pressed }) => [styles.toolSecondary, pressed && styles.pressed, styles.toolFlex]}>
              <Ionicons name="wallet-outline" size={16} color={colors.accent} />
              <Text style={styles.toolSecondaryText}>Memberships</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {admin && tab === 'classes' ? (
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => router.push('/(coach)/admin/classes')}
            style={({ pressed }) => [styles.toolSecondary, pressed && styles.pressed, styles.toolFlex]}>
            <Ionicons name="grid-outline" size={16} color={colors.accent} />
            <Text style={styles.toolSecondaryText}>Classes hub</Text>
          </Pressable>
          <Pressable
            onPress={() => setCreateOpen(true)}
            style={({ pressed }) => [styles.toolPrimary, pressed && styles.pressed, styles.toolFlex]}>
            <Ionicons name="add-circle-outline" size={16} color={colors.background} />
            <Text style={styles.toolPrimaryText}>Create class</Text>
          </Pressable>
        </View>
      ) : null}

      {(!admin || tab === 'roster') && clients.length > 0 ? (
        <>
          <SectionHeader title="Members" kicker="Active roster" />
          <View style={styles.rosterSummary}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{rosterStats.total}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={[styles.summaryTile, styles.summaryTileMale]}>
              <Ionicons name="male-outline" size={14} color="#93C5FD" />
              <Text style={[styles.summaryValue, styles.summaryValueMale]}>{rosterStats.men}</Text>
              <Text style={styles.summaryLabel}>Men</Text>
            </View>
            <View style={[styles.summaryTile, styles.summaryTileFemale]}>
              <Ionicons name="female-outline" size={14} color="#F472B6" />
              <Text style={[styles.summaryValue, styles.summaryValueFemale]}>{rosterStats.women}</Text>
              <Text style={styles.summaryLabel}>Women</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={[styles.summaryValue, styles.summaryValueAccent]}>{rosterStats.upcoming}</Text>
              <Text style={styles.summaryLabel}>Booked</Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            {(
              [
                { id: 'all' as const, label: 'All', count: rosterStats.total },
                { id: 'male' as const, label: 'Men', count: rosterStats.men, icon: 'male-outline' as const },
                { id: 'female' as const, label: 'Women', count: rosterStats.women, icon: 'female-outline' as const },
              ] as const
            ).map((f) => {
              const active = genderFilter === f.id;
              const tone =
                f.id === 'male'
                  ? genderTone('male')
                  : f.id === 'female'
                    ? genderTone('female')
                    : null;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setGenderFilter(f.id)}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipOn,
                    active && tone ? { borderColor: tone.border, backgroundColor: tone.pillBg } : null,
                  ]}>
                  {'icon' in f && f.icon ? (
                    <Ionicons
                      name={f.icon}
                      size={14}
                      color={active && tone ? tone.text : colors.textMuted}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextOn,
                      active && tone ? { color: tone.text } : null,
                    ]}>
                    {f.label}
                  </Text>
                  <View
                    style={[
                      styles.filterCount,
                      active && tone ? { backgroundColor: tone.bg } : null,
                    ]}>
                    <Text
                      style={[
                        styles.filterCountText,
                        active && tone ? { color: tone.text } : null,
                      ]}>
                      {f.count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Members list */}
      {(!admin || tab === 'roster') &&
        (clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            description="Invite by email or add manually with name and contact — both save to your roster."
          />
        ) : filteredClients.length === 0 ? (
          <EmptyState
            title={genderFilter === 'male' ? 'No men on roster' : 'No women on roster'}
            description="Try another filter or invite a new member."
          />
        ) : (
          <View style={styles.memberList}>
            {filteredClients.map((c) => {
              const billing = billingByMember[c.member.id];
              const memberAbsences = absencesByMember[c.member.id] ?? [];
              const nextAbsence = memberAbsences.find((a) => a.absence_date >= format(new Date(), 'yyyy-MM-dd'));
              const onBilling = Boolean(
                billing &&
                  (billing.notes?.includes('Started with REFORGE') ||
                    billing.status === 'paid' ||
                    billing.last_paid_at),
              );
              const tone = genderTone(c.member.gender);
              return (
                <Pressable
                  key={c.member.id}
                  onPress={() => router.push(`/(coach)/clients/${c.member.id}`)}
                  style={({ pressed }) => [
                    styles.memberCard,
                    { borderColor: tone.border },
                    c.upcomingSession && styles.memberCardActive,
                    pressed && styles.pressed,
                  ]}>
                  <LinearGradient
                    colors={[tone.bg, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.memberGlow}
                  />
                  {c.upcomingSession ? <View style={styles.memberRail} /> : null}
                  <View style={[styles.avatar, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                    <Text style={[styles.avatarText, { color: tone.text }]}>
                      {initials(c.member.full_name)}
                    </Text>
                    <View style={[styles.genderBadge, { backgroundColor: tone.pillBg, borderColor: tone.border }]}>
                      <Ionicons name={genderIcon(c.member.gender)} size={10} color={tone.text} />
                    </View>
                  </View>
                  <View style={styles.info}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {c.member.full_name}
                      </Text>
                      <View style={[styles.genderPill, { backgroundColor: tone.pillBg, borderColor: tone.border }]}>
                        <Ionicons name={genderIcon(c.member.gender)} size={11} color={tone.text} />
                        <Text style={[styles.genderPillText, { color: tone.text }]}>
                          {genderLabel(c.member.gender)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.program} numberOfLines={1}>
                      {c.currentProgram ?? 'No program assigned'}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={styles.metaChip}>
                        <Ionicons name="barbell-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaChipText}>Last · {c.lastWorkout}</Text>
                      </View>
                      {nextAbsence ? (
                        <View style={[styles.metaChip, styles.metaChipWarn]}>
                          <Ionicons name="calendar-clear-outline" size={12} color={colors.danger} />
                          <Text style={styles.metaChipWarnText} numberOfLines={1}>
                            Absent · {format(parseISO(nextAbsence.absence_date), 'EEE d MMM')} ·{' '}
                            {ABSENCE_SCOPE_LABELS[nextAbsence.scope]}
                          </Text>
                        </View>
                      ) : c.trainingPlacement ? (
                        <View style={[styles.metaChip, styles.metaChipAccent]}>
                          <Ionicons
                            name={c.trainingPlacement.type === 'group' ? 'people-outline' : 'person-outline'}
                            size={12}
                            color={colors.accent}
                          />
                          <Text style={styles.metaChipAccentText} numberOfLines={1}>
                            {c.trainingPlacement.type === 'group' ? 'Group' : 'Private'} · {c.trainingPlacement.label}
                          </Text>
                        </View>
                      ) : c.upcomingSession ? (
                        <View style={[styles.metaChip, styles.metaChipAccent]}>
                          <Ionicons name="calendar-outline" size={12} color={colors.accent} />
                          <Text style={styles.metaChipAccentText}>Next · {c.upcomingSession}</Text>
                        </View>
                      ) : (
                        <View style={styles.metaChip}>
                          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                          <Text style={styles.metaChipText}>Not placed</Text>
                        </View>
                      )}
                    </View>
                    {c.trainingPlacement ? (
                      <Text style={styles.placementDetail} numberOfLines={1}>
                        {c.trainingPlacement.detail} · {c.trainingPlacement.location}
                      </Text>
                    ) : null}
                    {admin ? (
                      <View style={styles.billingRow}>
                        {onBilling ? (
                          <Pressable
                            onPress={() => router.push('/(coach)/admin/memberships')}
                            style={styles.billingPill}>
                            <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                            <Text style={styles.billingPillText}>Billing · {billing.status}</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() => addClientToBilling(c)}
                            disabled={addingBillingId === c.member.id}
                            style={[
                              styles.billingAddBtn,
                              addingBillingId === c.member.id && styles.billingAddBtnDisabled,
                            ]}>
                            <Ionicons name="add-circle-outline" size={14} color={colors.background} />
                            <Text style={styles.billingAddText}>
                              {addingBillingId === c.member.id ? 'Adding…' : 'Add to billing'}
                            </Text>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={(e) => {
                            // @ts-expect-error RN web event
                            e?.stopPropagation?.();
                            setConfirmRemoveId(c.member.id);
                          }}
                          hitSlop={8}
                          style={styles.removeMemberBtn}>
                          <Ionicons name="person-remove-outline" size={14} color={colors.danger} />
                          <Text style={styles.removeMemberText}>Remove</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        ))}

      {/* Classes list */}
      {admin && tab === 'classes' ? (
        <>
          <SectionHeader title="Upcoming" kicker="Schedule" />
          {upcomingClasses.length === 0 ? (
            <EmptyState title="No upcoming classes" description="Create a class with a date and time." />
          ) : (
            upcomingClasses.map((row) => (
              <ClassCard key={row.id} row={row} onManage={() => openManage(row)} />
            ))
          )}

          {pastClasses.length > 0 ? (
            <>
              <SectionHeader title="Past" kicker="Archive" />
              {pastClasses.slice(0, 4).map((row) => (
                <ClassCard key={row.id} row={row} onManage={() => openManage(row)} past />
              ))}
            </>
          ) : null}
        </>
      ) : null}

      <AppBottomSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        kicker="Roster"
        title={memberAddMode === 'invite' ? 'Invite member' : 'Add manually'}
        hint={
          memberAddMode === 'invite'
            ? 'Send a sign-in invite by email. Assign coach and schedule placement when they join.'
            : manualMemberModalHint()
        }
        icon={memberAddMode === 'invite' ? 'mail-outline' : 'create-outline'}
        footer={
          <>
            <PrimaryButton
              title={
                saving
                  ? memberAddMode === 'invite'
                    ? 'Inviting…'
                    : 'Saving…'
                  : memberAddMode === 'invite'
                    ? 'Send invite'
                    : 'Save to roster'
              }
              onPress={memberAddMode === 'invite' ? onInvite : onAddManually}
              disabled={saving}
            />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setInviteOpen(false)} />
          </>
        }>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => {
              setMemberAddMode('invite');
              setFormError(null);
            }}
            style={[styles.modeChip, memberAddMode === 'invite' && styles.modeChipOn]}>
            <Ionicons
              name="mail-outline"
              size={14}
              color={memberAddMode === 'invite' ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.modeChipText, memberAddMode === 'invite' && styles.modeChipTextOn]}>
              Email invite
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMemberAddMode('manual');
              setFormError(null);
            }}
            style={[styles.modeChip, memberAddMode === 'manual' && styles.modeChipOn]}>
            <Ionicons
              name="create-outline"
              size={14}
              color={memberAddMode === 'manual' ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.modeChipText, memberAddMode === 'manual' && styles.modeChipTextOn]}>
              Add manually
            </Text>
          </Pressable>
        </View>

        <AppInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Alex Petrides" />
        <AppInput
          label={memberAddMode === 'invite' ? 'Email' : 'Email (optional if phone set)'}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="member@email.com"
        />
        <AppInput
          label={memberAddMode === 'invite' ? 'Phone' : 'Contact number'}
          value={phone}
          onChangeText={setPhone}
          placeholder="+357 99 000000"
          keyboardType="phone-pad"
        />
        <Text style={sheetStyles.pickerLabel}>Gender</Text>
        <View style={sheetStyles.chipRow}>
          {(
            [
              { id: undefined, label: 'Skip' },
              { id: 'male' as const, label: 'Man', icon: 'male-outline' as const },
              { id: 'female' as const, label: 'Woman', icon: 'female-outline' as const },
            ] as const
          ).map((g) => {
            const active = inviteGender === g.id;
            const tone = g.id ? genderTone(g.id) : null;
            return (
              <Pressable
                key={g.label}
                onPress={() => setInviteGender(g.id)}
                style={[
                  sheetStyles.chip,
                  active && sheetStyles.chipActive,
                  active && tone ? { borderColor: tone.border, backgroundColor: tone.pillBg } : null,
                ]}>
                {'icon' in g && g.icon ? (
                  <Ionicons name={g.icon} size={14} color={active && tone ? tone.text : colors.textSecondary} />
                ) : null}
                <Text
                  style={[
                    sheetStyles.chipText,
                    active && sheetStyles.chipTextActive,
                    active && tone ? { color: tone.text } : null,
                  ]}>
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={sheetStyles.pickerLabel}>Assign coach</Text>
        <View style={sheetStyles.chipRow}>
          {coaches.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCoachId(c.id)}
              style={[sheetStyles.chip, coachId === c.id && sheetStyles.chipActive]}>
              <Text style={[sheetStyles.chipText, coachId === c.id && sheetStyles.chipTextActive]}>
                {c.full_name}
              </Text>
            </Pressable>
          ))}
        </View>
        <MemberPlacementFields
          placementType={invitePlacementType}
          onPlacementTypeChange={setInvitePlacementType}
          classes={classes}
          classId={inviteClassId}
          onClassIdChange={setInviteClassId}
          privateDate={invitePrivateDate}
          privateStart={invitePrivateStart}
          privateEnd={invitePrivateEnd}
          privateLocation={invitePrivateLocation}
          privateNotes={invitePrivateNotes}
          onPrivateDateChange={setInvitePrivateDate}
          onPrivateStartChange={setInvitePrivateStart}
          onPrivateEndChange={setInvitePrivateEnd}
          onPrivateLocationChange={setInvitePrivateLocation}
          onPrivateNotesChange={setInvitePrivateNotes}
        />
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <Modal visible={billingAddOpen} animationType="slide" transparent onRequestClose={() => setBillingAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTap} onPress={() => setBillingAddOpen(false)} />
          <AddBillingMemberSheet
            fullName={billingName}
            email={billingEmail}
            phone={billingPhone}
            plan={billingPlan}
            amount={billingAmount}
            status={billingStatus}
            notes={billingNotes}
            saving={billingSaving}
            formError={billingFormError}
            onFullNameChange={setBillingName}
            onEmailChange={setBillingEmail}
            onPhoneChange={setBillingPhone}
            onPlanChange={setBillingPlan}
            onAmountChange={setBillingAmount}
            onStatusChange={setBillingStatus}
            onNotesChange={setBillingNotes}
            onSubmit={submitBillingMember}
            onClose={() => setBillingAddOpen(false)}
          />
        </View>
      </Modal>

      <AppBottomSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        kicker="Classes"
        title="Create class"
        hint="Set the schedule, then add members to the roster"
        icon="fitness-outline"
        footer={
          <>
            <PrimaryButton title={saving ? 'Creating…' : 'Create class'} onPress={onCreateClass} disabled={saving} />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setCreateOpen(false)} />
          </>
        }>
        <AppInput label="Title" value={classTitle} onChangeText={setClassTitle} placeholder="Strength Circuit" />
        <AppInput label="Description" value={classDesc} onChangeText={setClassDesc} placeholder="Optional" />
        <AppInput label="Date (YYYY-MM-DD)" value={classDate} onChangeText={setClassDate} placeholder="2026-08-12" />
        <View style={sheetStyles.row}>
          <View style={sheetStyles.half}>
            <AppInput label="Starts" value={startTime} onChangeText={setStartTime} placeholder="18:00" />
          </View>
          <View style={sheetStyles.half}>
            <AppInput label="Ends" value={endTime} onChangeText={setEndTime} placeholder="19:00" />
          </View>
        </View>
        <AppInput label="Location" value={location} onChangeText={setLocation} />
        <Text style={sheetStyles.pickerLabel}>Studio location</Text>
        <View style={sheetStyles.chipRow}>
          {STUDIO_LOCATIONS.map((loc) => (
            <Pressable
              key={loc}
              onPress={() => setLocation(loc)}
              style={[sheetStyles.chip, location === loc && sheetStyles.chipActive]}>
              <Text style={[sheetStyles.chipText, location === loc && sheetStyles.chipTextActive]}>{loc}</Text>
            </Pressable>
          ))}
        </View>
        <View style={sheetStyles.row}>
          <View style={sheetStyles.half}>
            <AppInput label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
          </View>
          <View style={sheetStyles.half}>
            <AppInput label="Level" value={level} onChangeText={setLevel} />
          </View>
        </View>
        <Text style={sheetStyles.pickerLabel}>Coach</Text>
        <View style={sheetStyles.chipRow}>
          {coaches.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setClassCoachId(c.id)}
              style={[sheetStyles.chip, classCoachId === c.id && sheetStyles.chipActive]}>
              <Text style={[sheetStyles.chipText, classCoachId === c.id && sheetStyles.chipTextActive]}>
                {c.full_name}
              </Text>
            </Pressable>
          ))}
        </View>
        <MemberMultiSelect
          members={clients.map((c) => c.member)}
          selectedIds={createMemberIds}
          onToggle={toggleCreateMember}
          capacity={Number(capacity) || 12}
        />
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <AppBottomSheet
        visible={Boolean(manageClass)}
        onClose={() => setManageClass(null)}
        title={manageClass?.title ?? 'Manage roster'}
        hint={
          manageClass
            ? `${format(parseISO(manageClass.starts_at), 'EEE d MMM')} · ${formatTime(manageClass.starts_at)}–${formatTime(manageClass.ends_at)} · ${manageClass.enrolled_count}/${manageClass.capacity} booked`
            : undefined
        }
        icon="people-outline"
        footer={
          <>
            <PrimaryButton
              title={saving ? 'Saving…' : `Save roster (${selectedMembers.length})`}
              onPress={saveMembers}
              disabled={saving}
            />
            <PrimaryButton
              title="Delete class"
              variant="ghost"
              onPress={() => manageClass && removeClass(manageClass.id)}
            />
            <PrimaryButton title="Close" variant="secondary" onPress={() => setManageClass(null)} />
          </>
        }>
        <View style={styles.capacityBar}>
          <View
            style={[
              styles.capacityFill,
              {
                width: `${Math.min(
                  100,
                  ((manageClass?.enrolled_count ?? 0) / Math.max(manageClass?.capacity ?? 1, 1)) * 100,
                )}%`,
              },
            ]}
          />
        </View>
        <Text style={sheetStyles.pickerLabel}>Add / remove members</Text>
        {clients.map((c) => {
          const on = selectedMembers.includes(c.member.id);
          const full = !on && selectedMembers.length >= (manageClass?.capacity ?? 0);
          return (
            <Pressable
              key={c.member.id}
              disabled={full}
              onPress={() => toggleMember(c.member.id)}
              style={[styles.pickRow, on && styles.pickRowOn, full && styles.pickDisabled]}>
              <View style={styles.pickAvatar}>
                <Text style={styles.pickAvatarText}>{initials(c.member.full_name)}</Text>
              </View>
              <Text style={styles.pickName}>{c.member.full_name}</Text>
              <View style={[styles.check, on && styles.checkOn]}>
                <Text style={[styles.checkText, on && styles.checkTextOn]}>{on ? '✓' : ''}</Text>
              </View>
            </Pressable>
          );
        })}
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <AppBottomSheet
        visible={Boolean(confirmRemoveId)}
        onClose={() => setConfirmRemoveId(null)}
        kicker="Roster"
        title="Remove member"
        hint="Soft-remove from the active roster. Their account stays — you can restore later from member detail."
        icon="person-remove-outline"
        footer={
          <>
            <PrimaryButton
              title={removingMemberId ? 'Removing…' : 'Remove from roster'}
              onPress={async () => {
                if (!confirmRemoveId) return;
                setRemovingMemberId(confirmRemoveId);
                try {
                  await adminService.removeMemberFromRoster(confirmRemoveId);
                  setConfirmRemoveId(null);
                  setToast('Member removed from roster');
                  await load();
                } catch (e) {
                  setToast(e instanceof Error ? e.message : 'Could not remove member');
                } finally {
                  setRemovingMemberId(null);
                }
              }}
              disabled={Boolean(removingMemberId)}
            />
            <PrimaryButton
              title="Cancel"
              variant="ghost"
              onPress={() => setConfirmRemoveId(null)}
              disabled={Boolean(removingMemberId)}
            />
          </>
        }>
        <Text style={styles.removeConfirmName}>
          {clients.find((c) => c.member.id === confirmRemoveId)?.member.full_name ?? 'This member'}
        </Text>
        <Text style={styles.removeConfirmBody}>
          They will disappear from the active roster. Coach and program links are cleared.
        </Text>
      </AppBottomSheet>
    </Screen>
  );
}

function ClassCard({
  row,
  onManage,
  past = false,
}: {
  row: adminService.StudioClassRow;
  onManage: () => void;
  past?: boolean;
}) {
  const pct = Math.min(100, (row.enrolled_count / Math.max(row.capacity, 1)) * 100);
  return (
    <Pressable
      onPress={onManage}
      style={({ pressed }) => [styles.classCard, past && styles.classCardPast, pressed && styles.pressed]}>
      <View style={styles.classTop}>
        <View style={styles.classCopy}>
          <Text style={styles.classTitle}>{row.title}</Text>
          <Text style={styles.classMeta}>
            {format(parseISO(row.starts_at), 'EEE d MMM')} · {formatTime(row.starts_at)}–
            {formatTime(row.ends_at)}
          </Text>
          <Text style={styles.classMeta}>
            {row.location} · {row.level} · {row.coachName}
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
      <View style={styles.capacityBar}>
        <View style={[styles.capacityFill, { width: `${pct}%` }]} />
      </View>
      {row.members.length > 0 ? (
        <View style={styles.memberChips}>
          {row.members.slice(0, 4).map((m) => (
            <View key={m.id} style={styles.miniChip}>
              <Text style={styles.miniChipText}>{initials(m.full_name)}</Text>
            </View>
          ))}
          {row.members.length > 4 ? (
            <Text style={styles.moreMembers}>+{row.members.length - 4}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyRoster}>No members yet — tap to assign</Text>
      )}
      <Text style={styles.manageLink}>Manage roster →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
  },
  heroKicker: {
    ...typography.sectionKicker,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: 1.5,
    color: colors.text,
    textTransform: 'uppercase',
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    maxWidth: 360,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  tab: {
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  tabOn: {
    backgroundColor: '#121812',
  },
  tabGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  tabText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabTextOn: {
    color: colors.accent,
  },
  tabCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabCountOn: {
    backgroundColor: 'rgba(200,255,0,0.15)',
  },
  tabCountText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  tabCountTextOn: {
    color: colors.accent,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
  },
  toastText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  toolFlex: { flex: 1 },
  toolPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  toolPrimaryText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.background,
  },
  toolSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  toolSecondaryText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accent,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  modeChipOn: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: colors.accentMuted,
  },
  modeChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  modeChipTextOn: {
    color: colors.accent,
  },
  rosterSummary: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTileMale: {
    borderColor: 'rgba(96,165,250,0.25)',
    backgroundColor: 'rgba(96,165,250,0.06)',
  },
  summaryTileFemale: {
    borderColor: 'rgba(244,114,182,0.25)',
    backgroundColor: 'rgba(244,114,182,0.06)',
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
    letterSpacing: 0.5,
  },
  summaryValueMale: { color: '#93C5FD' },
  summaryValueFemale: { color: '#F472B6' },
  summaryValueAccent: { color: colors.accent },
  summaryLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  filterChipOn: {
    borderColor: colors.accent,
  },
  filterChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  filterChipTextOn: {
    color: colors.accent,
  },
  filterCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterCountText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  memberList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pressed: { opacity: 0.92 },
  memberCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberCardActive: {
    backgroundColor: '#101410',
  },
  memberGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  memberRail: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 3,
    borderTopRightRadius: radius.full,
    borderBottomRightRadius: radius.full,
    backgroundColor: colors.accent,
  },
  avatar: {
    position: 'relative',
    width: 54,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  avatarText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
  },
  genderBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  genderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  genderPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  program: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metaChipAccent: {
    backgroundColor: colors.accentMuted,
  },
  metaChipWarn: {
    backgroundColor: 'rgba(255,77,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.28)',
  },
  metaChipText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textSecondary,
  },
  metaChipAccentText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.accent,
  },
  metaChipWarnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.danger,
  },
  billingRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  billingAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  billingAddBtnDisabled: {
    opacity: 0.6,
  },
  billingAddText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.background,
    letterSpacing: 0.4,
  },
  removeMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.4)',
    backgroundColor: 'rgba(255,77,77,0.1)',
  },
  removeMemberText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.danger,
    letterSpacing: 0.3,
  },
  removeConfirmName: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  removeConfirmBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  billingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  billingPillText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.success,
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  classCard: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  classCardPast: {
    opacity: 0.78,
  },
  classTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  classCopy: { flex: 1, gap: 4 },
  classTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  classMeta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  countBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
  },
  countValue: {
    fontFamily: fonts.display,
    color: colors.accent,
    fontSize: 28,
    lineHeight: 30,
  },
  countCap: {
    fontFamily: fonts.sans,
    color: colors.textMuted,
    fontSize: 12,
  },
  countLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  capacityBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  memberChips: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniChip: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  miniChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    color: colors.textSecondary,
  },
  moreMembers: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyRoster: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  manageLink: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  modalBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  placementDetail: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCard: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { ...typography.title, color: colors.text, fontSize: 22 },
  modalHint: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.sm },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeField: { flex: 1 },
  pickerLabel: { ...typography.label, color: colors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
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
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontWeight: '700' },
  formError: { ...typography.caption, color: colors.danger },
  memberPickList: { maxHeight: 280 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickRowOn: { opacity: 1 },
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
});
