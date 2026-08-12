import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppBottomSheet, SheetFormError, sheetStyles } from '@/components/ui/AppBottomSheet';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import * as adminService from '@/services/admin';
import type { UserRole } from '@/types';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { inviteModalHint, inviteSuccessMessage } from '@/lib/admin/config';

type StaffRow = Awaited<ReturnType<typeof adminService.listStaff>>[number];

const ROLES: UserRole[] = ['coach', 'admin', 'member'];

export default function AdminStaffScreen() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await adminService.listStaff());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = rows.find((r) => r.person.id === roleUserId) ?? null;

  const onInvite = async () => {
    setFormError(null);
    setSaving(true);
    try {
      await adminService.inviteCoach({ email, fullName, phone: phone || undefined });
      setInviteOpen(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setInviteSuccess(inviteSuccessMessage('coach'));
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Invite failed');
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
      <PrimaryButton title="← Studio" variant="ghost" onPress={() => router.back()} style={styles.back} />
      <Text style={styles.title}>Staff</Text>
      <Text style={styles.subtitle}>Invite coaches and manage roles</Text>

      <PrimaryButton title="Invite coach" onPress={() => setInviteOpen(true)} style={styles.inviteBtn} />

      {inviteSuccess ? <Text style={styles.success}>{inviteSuccess}</Text> : null}

      {rows.length === 0 ? (
        <EmptyState title="No staff yet" />
      ) : (
        rows.map((row) => (
          <AppCard key={row.person.id} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.flex}>
                <Text style={styles.name}>{row.person.full_name}</Text>
                <Text style={styles.meta}>{row.person.email}</Text>
                <Text style={styles.meta}>
                  {row.person.role === 'coach' ? `${row.clientCount} clients` : 'Studio access'}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{row.person.role.toUpperCase()}</Text>
              </View>
            </View>
            <PrimaryButton
              title="Change role"
              variant="secondary"
              onPress={() => setRoleUserId(row.person.id)}
            />
          </AppCard>
        ))
      )}

      <AppBottomSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        kicker="Staff"
        title="Invite coach"
        hint={inviteModalHint() ?? 'Demo password for new coaches: password123'}
        icon="person-add-outline"
        footer={
          <>
            <PrimaryButton title={saving ? 'Inviting…' : 'Send invite'} onPress={onInvite} disabled={saving} />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setInviteOpen(false)} />
          </>
        }>
        <AppInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Coach name" />
        <AppInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="coach@email.com" />
        <AppInput label="Phone" value={phone} onChangeText={setPhone} placeholder="+357 ..." />
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <AppBottomSheet
        visible={Boolean(selected)}
        onClose={() => setRoleUserId(null)}
        title={selected?.person.full_name ?? 'Staff member'}
        hint={`Current role: ${selected?.person.role ?? '—'}`}
        icon="shield-outline"
        footer={<PrimaryButton title="Close" variant="ghost" onPress={() => setRoleUserId(null)} />}
      >
        <Text style={sheetStyles.pickerLabel}>Set role</Text>
        <View style={sheetStyles.chipRow}>
          {ROLES.map((role) => (
            <Pressable
              key={role}
              onPress={async () => {
                if (!selected) return;
                try {
                  setFormError(null);
                  await adminService.updateUserRole(selected.person.id, role);
                  setRoleUserId(null);
                  await load();
                } catch (e) {
                  setFormError(e instanceof Error ? e.message : 'Could not update role');
                }
              }}
              style={[sheetStyles.chip, selected?.person.role === role && sheetStyles.chipActive]}>
              <Text style={[sheetStyles.chipText, selected?.person.role === role && sheetStyles.chipTextActive]}>
                {role}
              </Text>
            </Pressable>
          ))}
        </View>
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.sm },
  title: { ...typography.hero, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  inviteBtn: { marginBottom: spacing.lg },
  success: { ...typography.caption, color: colors.accent, marginBottom: spacing.md },
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
  badgeText: { ...typography.label, color: colors.accent, fontSize: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { ...typography.title, color: colors.text },
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
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: colors.accent, fontWeight: '700' },
  formError: { ...typography.caption, color: colors.danger },
  hint: { ...typography.caption, color: colors.textMuted },
});
