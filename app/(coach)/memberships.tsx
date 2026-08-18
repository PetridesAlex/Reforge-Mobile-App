import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { canManageStudio } from '@/lib/permissions';
import * as adminService from '@/services/admin';
import type { MembershipStatus } from '@/services/mock/data';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Filter = 'all' | 'needs_payment' | MembershipStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'needs_payment', label: 'Needs payment' },
  { id: 'paid', label: 'Paid' },
  { id: 'all', label: 'All' },
];

function statusTone(status: MembershipStatus): 'ok' | 'warn' | 'danger' | 'muted' {
  if (status === 'paid') return 'ok';
  if (status === 'overdue') return 'danger';
  if (status === 'unpaid') return 'warn';
  return 'muted';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function CoachMembershipsScreen() {
  const { profile } = useAuth();
  const isAdmin = canManageStudio(profile?.role);
  const [filter, setFilter] = useState<Filter>('needs_payment');
  const [rows, setRows] = useState<adminService.MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const statusFilter =
        filter === 'needs_payment'
          ? 'needs_payment'
          : filter === 'all'
            ? 'all'
            : filter;
      const list = await adminService.listMemberships({
        status: statusFilter,
        coachId: isAdmin ? undefined : profile.id,
      });
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load memberships');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, isAdmin, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const markPaid = async (memberId: string, name: string) => {
    await adminService.markMembershipPaid(memberId);
    setToast(`${name} marked paid`);
    await load();
  };

  const markUnpaid = async (memberId: string, name: string) => {
    await adminService.markMembershipUnpaid(memberId);
    setToast(`${name} marked unpaid`);
    await load();
  };

  const sendReminder = async (memberId: string, name: string) => {
    try {
      await adminService.sendPaymentReminder(memberId);
      setToast(`Reminder sent to ${name}`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not send reminder');
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={120} style={{ marginTop: spacing.md }} />
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
            void load();
          }}
          tintColor={colors.accent}
        />
      }>
      <BackButton label="Back" style={styles.back} />
      <Text style={styles.kicker}>BILLING</Text>
      <Text style={styles.title}>Memberships</Text>
      <Text style={styles.subtitle}>
        {isAdmin
          ? 'Mark paid, track overdue members, and send payment reminders.'
          : 'Manage subscription status for your assigned athletes.'}
      </Text>

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.filterChip, filter === f.id && styles.filterChipOn]}>
            <Text style={[styles.filterText, filter === f.id && styles.filterTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {rows.length === 0 ? (
        <EmptyState
          title="No memberships here"
          description={
            filter === 'needs_payment'
              ? 'All assigned athletes are paid up.'
              : 'No membership records match this filter.'
          }
        />
      ) : (
        rows.map((row) => {
          const tone = statusTone(row.membership.status);
          const needsPayment =
            row.membership.status === 'unpaid' || row.membership.status === 'overdue';
          return (
            <View key={row.member.id} style={styles.card}>
              <LinearGradient
                colors={['rgba(200,255,0,0.06)', 'transparent']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(row.member.full_name)}</Text>
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{row.member.full_name}</Text>
                  <Text style={styles.meta}>
                    {row.membership.plan_label} · €{row.membership.amount_eur}
                  </Text>
                  <Text style={styles.meta}>Period ends {row.membership.period_end}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    tone === 'ok' && styles.statusOk,
                    tone === 'warn' && styles.statusWarn,
                    tone === 'danger' && styles.statusDanger,
                  ]}>
                  <Text
                    style={[
                      styles.statusText,
                      tone === 'ok' && styles.statusTextOk,
                      tone === 'warn' && styles.statusTextWarn,
                      tone === 'danger' && styles.statusTextDanger,
                    ]}>
                    {row.membership.status}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                {needsPayment ? (
                  <>
                    <PrimaryButton
                      title="Mark paid"
                      onPress={() => markPaid(row.member.id, row.member.full_name)}
                      style={styles.actionBtn}
                    />
                    <PrimaryButton
                      title="Remind"
                      variant="secondary"
                      onPress={() => sendReminder(row.member.id, row.member.full_name)}
                      style={styles.actionBtn}
                    />
                  </>
                ) : (
                  <PrimaryButton
                    title="Mark unpaid"
                    variant="secondary"
                    onPress={() => markUnpaid(row.member.id, row.member.full_name)}
                    style={styles.actionBtn}
                  />
                )}
                <PrimaryButton
                  title="Open profile"
                  variant="ghost"
                  onPress={() =>
                    router.push(`/(coach)/clients/${row.member.id}?tab=billing`)
                  }
                  style={styles.actionBtn}
                />
              </View>
            </View>
          );
        })
      )}
      <View style={{ height: 40 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: spacing.sm, marginBottom: spacing.md },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.text,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  toastText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  filterScroll: { marginBottom: spacing.md, maxHeight: 44 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },
  filterChipOn: {
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  filterText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterTextOn: { color: colors.accent },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    gap: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  avatarText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.accent,
  },
  copy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusOk: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderColor: 'rgba(74,222,128,0.35)',
  },
  statusWarn: {
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderColor: 'rgba(250,204,21,0.35)',
  },
  statusDanger: {
    backgroundColor: 'rgba(255,77,77,0.12)',
    borderColor: 'rgba(255,77,77,0.35)',
  },
  statusText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  statusTextOk: { color: colors.success },
  statusTextWarn: { color: '#FACC15' },
  statusTextDanger: { color: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: { flexGrow: 1, minWidth: 120 },
});
