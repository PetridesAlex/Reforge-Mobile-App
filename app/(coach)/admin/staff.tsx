import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppBottomSheet, SheetFormError, sheetStyles } from '@/components/ui/AppBottomSheet';
import { AppInput } from '@/components/ui/AppInput';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import * as adminService from '@/services/admin';
import type { UserRole } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';
import { inviteModalHint, inviteSuccessMessage } from '@/lib/admin/config';

type StaffRow = Awaited<ReturnType<typeof adminService.listStaff>>[number];

const ROLES: UserRole[] = ['coach', 'admin', 'member'];

function roleMeta(role: UserRole) {
  switch (role) {
    case 'admin':
      return {
        label: 'ADMIN',
        access: 'Full studio control',
        color: colors.accent,
        border: 'rgba(200,255,0,0.4)',
        fill: 'rgba(200,255,0,0.12)',
      };
    case 'coach':
      return {
        label: 'COACH',
        access: null as string | null,
        color: '#7DD3FC',
        border: 'rgba(125,211,252,0.4)',
        fill: 'rgba(125,211,252,0.12)',
      };
    default:
      return {
        label: 'MEMBER',
        access: 'Member access',
        color: colors.textSecondary,
        border: 'rgba(255,255,255,0.16)',
        fill: 'rgba(255,255,255,0.06)',
      };
  }
}

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
  const coaches = rows.filter((r) => r.person.role === 'coach').length;
  const admins = rows.filter((r) => r.person.role === 'admin').length;

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
      <BackButton label="Studio" style={styles.back} />

      <View style={styles.hero}>
        <View style={styles.kickerRow}>
          <View style={styles.kickerDot} />
          <Text style={styles.kicker}>STUDIO OPS</Text>
        </View>
        <Text style={styles.title}>STAFF</Text>
        <View style={styles.ruleRow}>
          <View style={styles.rule} />
          <Text style={styles.ruleMark}>RFG</Text>
          <View style={styles.rule} />
        </View>
        <Text style={styles.subtitle}>Invite coaches and manage studio roles.</Text>
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{admins}</Text>
            <Text style={styles.statLabel}>ADMIN</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{coaches}</Text>
            <Text style={styles.statLabel}>COACH</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{rows.length}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => setInviteOpen(true)}
        style={({ pressed }) => [styles.inviteCta, pressed && styles.pressed]}>
        <View style={styles.inviteIcon}>
          <Ionicons name="person-add" size={18} color={colors.background} />
        </View>
        <View style={styles.inviteCopy}>
          <Text style={styles.inviteTitle}>INVITE COACH</Text>
          <Text style={styles.inviteMeta}>Send studio access by email</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={colors.background} />
      </Pressable>

      {inviteSuccess ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.success}>{inviteSuccess}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionKicker}>DIRECTORY</Text>

      {rows.length === 0 ? (
        <EmptyState title="No staff yet" description="Invite your first coach to get started." />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const meta = roleMeta(row.person.role);
            const access =
              row.person.role === 'coach'
                ? `${row.clientCount} active client${row.clientCount === 1 ? '' : 's'}`
                : meta.access;
            return (
              <Pressable
                key={row.person.id}
                onPress={() => setRoleUserId(row.person.id)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                  Platform.OS === 'web'
                    ? ({
                        transitionProperty: 'border-color, transform',
                        transitionDuration: '180ms',
                      } as object)
                    : null,
                ]}>
                <View style={[styles.sideRail, { backgroundColor: meta.color }]} />
                <View style={styles.topHairline} />

                <View style={styles.cardTop}>
                  <View style={styles.avatarRing}>
                    <Avatar
                      name={row.person.full_name}
                      uri={row.person.avatar_url}
                      size={48}
                    />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.name} numberOfLines={1}>
                      {row.person.full_name}
                    </Text>
                    <Text style={styles.email} numberOfLines={1}>
                      {row.person.email}
                    </Text>
                    <View style={styles.accessRow}>
                      <Ionicons name="shield-checkmark-outline" size={12} color={meta.color} />
                      <Text style={styles.access}>{access}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { borderColor: meta.border, backgroundColor: meta.fill },
                    ]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.footerHint}>MANAGE ROLE</Text>
                  <View style={styles.footerArrow}>
                    <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
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
        <AppInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="coach@email.com"
        />
        <AppInput label="Phone" value={phone} onChangeText={setPhone} placeholder="+357 ..." />
        {formError ? <SheetFormError message={formError} /> : null}
      </AppBottomSheet>

      <AppBottomSheet
        visible={Boolean(selected)}
        onClose={() => setRoleUserId(null)}
        title={selected?.person.full_name ?? 'Staff member'}
        hint={`Current role: ${selected?.person.role ?? '—'}`}
        icon="shield-outline"
        footer={<PrimaryButton title="Close" variant="ghost" onPress={() => setRoleUserId(null)} />}>
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
              <Text
                style={[
                  sheetStyles.chipText,
                  selected?.person.role === role && sheetStyles.chipTextActive,
                ]}>
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
  hero: {
    marginBottom: spacing.md,
    gap: 8,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 46,
    letterSpacing: 1.4,
    color: colors.text,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  ruleMark: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.62)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 18,
    color: colors.accent,
  },
  statLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  inviteCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: spacing.lg,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  inviteIcon: {
    width: 36,
    height: 36,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  inviteCopy: { flex: 1, gap: 2 },
  inviteTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.background,
  },
  inviteMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: 'rgba(10,10,10,0.7)',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  success: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
  },
  sectionKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  list: { gap: 12, paddingBottom: spacing.xl },
  card: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.14)',
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 12,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.94 },
  sideRail: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 2,
    opacity: 0.9,
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(200,255,0,0.28)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingLeft: 4,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.04)',
  },
  cardCopy: { flex: 1, gap: 3, minWidth: 0 },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    letterSpacing: 0.2,
    color: colors.text,
  },
  email: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  access: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  cardFooter: {
    marginLeft: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerHint: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  footerArrow: {
    width: 28,
    height: 28,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
});
