import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { MemberPlacementFields } from '@/components/scheduling/MemberPlacementFields';
import { AppBottomSheet, SheetFormError, sheetStyles } from '@/components/ui/AppBottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import * as adminService from '@/services/admin';
import type { Profile, Program } from '@/types';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { inviteModalHint, inviteSuccessMessage, manualMemberModalHint, manualMemberSuccessMessage } from '@/lib/admin/config';
import type { TrainingPlacementType } from '@/lib/scheduling/placement';

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

type MemberRow = Awaited<ReturnType<typeof adminService.listMembers>>[number];

export default function AdminMembersScreen() {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [classes, setClasses] = useState<adminService.StudioClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberAddMode, setMemberAddMode] = useState<'invite' | 'manual'>('invite');
  const [manageId, setManageId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [coachId, setCoachId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invitePlacementType, setInvitePlacementType] = useState<TrainingPlacementType>('none');
  const [inviteClassId, setInviteClassId] = useState<string | undefined>();
  const [invitePrivateDate, setInvitePrivateDate] = useState(tomorrowDate);
  const [invitePrivateStart, setInvitePrivateStart] = useState('09:00');
  const [invitePrivateEnd, setInvitePrivateEnd] = useState('10:00');
  const [invitePrivateLocation, setInvitePrivateLocation] = useState('Studio A');
  const [invitePrivateNotes, setInvitePrivateNotes] = useState('Private training');

  const load = useCallback(async () => {
    try {
      setError(null);
      const [members, staff, programList, classList] = await Promise.all([
        adminService.listMembers(),
        adminService.listCoaches(),
        adminService.listPrograms(),
        adminService.listStudioClasses(),
      ]);
      setRows(members);
      setCoaches(staff);
      setPrograms(programList);
      setClasses(classList);
      if (!coachId && staff[0]) setCoachId(staff[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coachId]);

  useEffect(() => {
    load();
  }, [load]);

  const managed = rows.find((r) => r.member.id === manageId) ?? null;

  const openMemberSheet = (mode: 'invite' | 'manual') => {
    setMemberAddMode(mode);
    setFormError(null);
    setInviteOpen(true);
  };

  const resetMemberForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
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
        placement,
      });
      setInviteOpen(false);
      resetMemberForm();
      setInviteSuccess(inviteSuccessMessage('member'));
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
      if (!fullName.trim()) throw new Error('Full name is required');
      if (!email.trim() && !phone.trim()) throw new Error('Enter an email or contact number');

      await adminService.addMemberManually({
        fullName,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        coachId,
        placement,
      });
      setInviteOpen(false);
      resetMemberForm();
      setInviteSuccess(manualMemberSuccessMessage());
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={100} style={{ marginTop: spacing.lg }} />
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
      <BackButton label="Studio" style={styles.back} />
      <Text style={styles.kicker}>STUDIO ROSTER</Text>
      <Text style={styles.title}>Members</Text>
      <Text style={styles.subtitle}>
        Invite people, assign coaches & programs, activate or pause access
      </Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{rows.filter((r) => r.active).length}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{rows.filter((r) => !r.active).length}</Text>
          <Text style={styles.summaryLabel}>Inactive</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{rows.filter((r) => !r.coach).length}</Text>
          <Text style={styles.summaryLabel}>Unassigned</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <PrimaryButton title="Invite member" onPress={() => openMemberSheet('invite')} style={styles.actionBtn} />
        <PrimaryButton
          title="Add manually"
          variant="secondary"
          onPress={() => openMemberSheet('manual')}
          style={styles.actionBtn}
        />
      </View>

      {inviteSuccess ? <Text style={styles.success}>{inviteSuccess}</Text> : null}

      {rows.length === 0 ? (
        <EmptyState title="No members yet" />
      ) : (
        rows.map((row) => (
          <AppCard key={row.member.id} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.flex}>
                <Text style={styles.name}>{row.member.full_name}</Text>
                <Text style={styles.meta}>{row.member.email}</Text>
                <Text style={styles.meta}>
                  Coach: {row.coach?.full_name ?? 'Unassigned'} · {row.programName ?? 'No program'}
                </Text>
              </View>
              <View style={[styles.badge, !row.active && styles.badgeInactive]}>
                <Text style={[styles.badgeText, !row.active && styles.badgeTextInactive]}>
                  {row.active ? 'ACTIVE' : 'INACTIVE'}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              <PrimaryButton
                title="Manage"
                variant="secondary"
                onPress={() => setManageId(row.member.id)}
                style={styles.actionBtn}
              />
              <PrimaryButton
                title="Profile"
                variant="ghost"
                onPress={() => router.push(`/(coach)/clients/${row.member.id}`)}
                style={styles.actionBtn}
              />
            </View>
          </AppCard>
        ))
      )}

      <AppBottomSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        kicker="Roster"
        title={memberAddMode === 'invite' ? 'Invite member' : 'Add manually'}
        hint={
          memberAddMode === 'invite'
            ? inviteModalHint()
              ? `${inviteModalHint()} Place them on a group class or private session when they join.`
              : 'Place them on a group class or private session when they join.'
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
          placeholder="+357 ..."
          keyboardType="phone-pad"
        />
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

      <AppBottomSheet
        visible={Boolean(managed)}
        onClose={() => setManageId(null)}
        title={managed?.member.full_name ?? 'Manage member'}
        hint={managed?.member.email}
        icon="person-outline"
        footer={
          <>
            <PrimaryButton
              title={managed?.active ? 'Remove from roster' : 'Restore to roster'}
              variant="secondary"
              onPress={async () => {
                if (!managed) return;
                await adminService.setMemberActive(managed.member.id, !managed.active);
                setInviteSuccess(managed.active ? 'Removed from roster' : 'Restored to roster');
                await load();
              }}
            />
            <PrimaryButton title="Close" variant="ghost" onPress={() => setManageId(null)} />
          </>
        }>
        <Text style={sheetStyles.pickerLabel}>Coach</Text>
        <View style={sheetStyles.chipRow}>
          {coaches.map((c) => (
            <Pressable
              key={c.id}
              onPress={async () => {
                if (!managed) return;
                await adminService.assignCoach(managed.member.id, c.id);
                await load();
              }}
              style={[sheetStyles.chip, managed?.coach?.id === c.id && sheetStyles.chipActive]}>
              <Text
                style={[
                  sheetStyles.chipText,
                  managed?.coach?.id === c.id && sheetStyles.chipTextActive,
                ]}>
                {c.full_name}
              </Text>
            </Pressable>
          ))}
        </View>
        <AppInput
          label="Program start date"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
        />
        <Text style={sheetStyles.pickerLabel}>Program</Text>
        <View style={sheetStyles.chipRow}>
          {programs.map((p) => (
            <Pressable
              key={p.id}
              onPress={async () => {
                if (!managed) return;
                await adminService.assignMemberProgram(managed.member.id, p.id, { startDate });
                await load();
              }}
              style={[sheetStyles.chip, managed?.programName === p.name && sheetStyles.chipActive]}>
              <Text
                style={[
                  sheetStyles.chipText,
                  managed?.programName === p.name && sheetStyles.chipTextActive,
                ]}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.sm },
  kicker: { ...typography.label, color: colors.accent },
  title: { ...typography.hero, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  summaryValue: { ...typography.title, color: colors.accent, fontSize: 22 },
  summaryLabel: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  actionBtn: { flex: 1 },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  modeChipOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  modeChipText: { ...typography.caption, color: colors.textSecondary },
  modeChipTextOn: { color: colors.accent, fontWeight: '700' },
  success: { ...typography.caption, color: colors.accent, marginBottom: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  rowTop: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  name: { ...typography.subtitle, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeInactive: { backgroundColor: 'rgba(255,77,77,0.15)' },
  badgeText: { ...typography.label, color: colors.accent, fontSize: 10 },
  badgeTextInactive: { color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '88%',
  },
  modalTitle: { ...typography.title, color: colors.text },
  pickerLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
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
});
