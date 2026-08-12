import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AddBillingMemberSheet } from '@/components/billing/AddBillingMemberSheet';
import { MembershipEditSheet } from '@/components/billing/MembershipEditSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import * as adminService from '@/services/admin';
import type { MembershipPayment, MembershipPlan, MembershipStatus } from '@/services/mock/data';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type Filter = 'all' | 'paid' | 'needs_payment' | 'trial' | 'paused';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'needs_payment', label: 'Due' },
  { id: 'trial', label: 'Trial' },
  { id: 'paused', label: 'Paused' },
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function statusTone(status: MembershipStatus): 'ok' | 'warn' | 'danger' | 'muted' {
  if (status === 'paid') return 'ok';
  if (status === 'overdue') return 'danger';
  if (status === 'unpaid') return 'warn';
  return 'muted';
}

export default function AdminMembershipsScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<adminService.MembershipRow[]>([]);
  const [stats, setStats] = useState<adminService.MembershipStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [edit, setEdit] = useState<adminService.MembershipRow | null>(null);
  const [status, setStatus] = useState<MembershipStatus>('paid');
  const [plan, setPlan] = useState<MembershipPlan>('monthly');
  const [planLabel, setPlanLabel] = useState('');
  const [amount, setAmount] = useState('180');
  const [periodEnd, setPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentHistory, setPaymentHistory] = useState<MembershipPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sendingInvoices, setSendingInvoices] = useState(false);
  const [billingReady, setBillingReady] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPlan, setAddPlan] = useState<MembershipPlan>('monthly');
  const [addAmount, setAddAmount] = useState('180');
  const [addStatus, setAddStatus] = useState<MembershipStatus>('unpaid');
  const [addNotes, setAddNotes] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const ready = await adminService.isMembershipBillingReady();
      setBillingReady(ready);
      const statusFilter =
        filter === 'needs_payment'
          ? 'needs_payment'
          : filter === 'all'
            ? 'all'
            : (filter as MembershipStatus);
      const [list, hubStats] = await Promise.all([
        adminService.listMemberships({ status: statusFilter }),
        adminService.getMembershipStats(),
      ]);
      setRows(list);
      setStats(hubStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = async (row: adminService.MembershipRow) => {
    setEdit(row);
    setStatus(row.membership.status);
    setPlan(row.membership.plan);
    setPlanLabel(row.membership.plan_label);
    setAmount(String(row.membership.amount_eur));
    setPeriodEnd(row.membership.period_end);
    setNotes(row.membership.notes ?? '');
    setFormError(null);
    setHistoryLoading(true);
    try {
      const history = await adminService.getMembershipPaymentHistory(row.member.id);
      setPaymentHistory(history);
    } catch {
      setPaymentHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const sendInvoices = async () => {
    setSendingInvoices(true);
    try {
      const result = await adminService.sendMonthlyInvoices();
      setToast(
        `${result.sent} invoice${result.sent === 1 ? '' : 's'} sent for ${result.periodLabel}${result.skipped ? ` · ${result.skipped} skipped` : ''}`,
      );
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not send invoices');
    } finally {
      setSendingInvoices(false);
    }
  };

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    setFormError(null);
    try {
      await adminService.updateMembership(edit.member.id, {
        status,
        plan,
        planLabel,
        amountEur: Number(amount) || 0,
        periodEnd,
        notes: notes.trim() || null,
      });
      setEdit(null);
      setToast('Membership updated');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const quickPaid = async (memberId: string, name: string) => {
    await adminService.markMembershipPaid(memberId);
    setToast(`${name} marked paid`);
    await load();
  };

  const quickUnpaid = async (memberId: string, name: string) => {
    await adminService.markMembershipUnpaid(memberId);
    setToast(`${name} marked unpaid`);
    await load();
  };

  const resetAddForm = () => {
    setAddName('');
    setAddEmail('');
    setAddPhone('');
    setAddPlan('monthly');
    setAddAmount('180');
    setAddStatus('unpaid');
    setAddNotes('');
    setAddError(null);
  };

  const submitAddMember = async () => {
    setAddSaving(true);
    setAddError(null);
    try {
      const row = await adminService.createBillingMember({
        fullName: addName,
        email: addEmail.trim() || undefined,
        phone: addPhone.trim() || undefined,
        plan: addPlan,
        amountEur: Number(addAmount) || 180,
        status: addStatus,
        notes: addNotes.trim() || null,
      });
      setAddOpen(false);
      resetAddForm();
      setToast(`${row.member.full_name} added to billing`);
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setAddSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={100} style={{ marginTop: spacing.md }} />
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
      <View style={styles.heroHeader}>
        <LinearGradient
          colors={['rgba(200,255,0,0.1)', 'transparent', 'rgba(200,255,0,0.04)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.heroHeaderGlow}
        />
        <View style={styles.heroHeaderTop}>
          <BackButton compact />
          <View style={styles.heroPill}>
            <Ionicons name="card-outline" size={11} color={colors.accent} />
            <Text style={styles.heroPillText}>BILLING HUB</Text>
          </View>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="wallet-outline" size={24} color={colors.accent} />
        </View>
        <Text style={styles.heroKicker}>STUDIO BILLING</Text>
        <Text style={styles.heroTitle}>Memberships</Text>
        <Text style={styles.heroSub}>
          Track who paid, who is due, and manage plans — invoices and payment history in one place.
        </Text>
      </View>

      <View style={styles.actionRow}>
        <PrimaryButton
          title="+ Add member"
          onPress={() => {
            resetAddForm();
            setAddOpen(true);
          }}
          style={styles.actionBtnMain}
        />
        <PrimaryButton
          title={sendingInvoices ? 'Sending…' : 'Send invoices'}
          variant="secondary"
          onPress={sendInvoices}
          disabled={sendingInvoices || !billingReady}
          style={styles.actionBtnSecondary}
        />
      </View>

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      {!billingReady ? (
        <View style={styles.setupBanner}>
          <Text style={styles.setupTitle}>Billing database not set up yet</Text>
          <Text style={styles.setupBody}>
            Members are shown from your roster with default plans. Run{' '}
            <Text style={styles.setupCode}>007_memberships.sql</Text> in the Supabase SQL Editor to
            save payments, invoices, and history.
          </Text>
        </View>
      ) : null}

      {stats ? (
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statOk]}>
            <Text style={styles.statValue}>{stats.paid}</Text>
            <Text style={styles.statLabel}>Paid</Text>
          </View>
          <View style={[styles.statCard, styles.statWarn]}>
            <Text style={styles.statValueWarn}>{stats.unpaid + stats.overdue}</Text>
            <Text style={styles.statLabel}>Need payment</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValueMuted}>{stats.trial}</Text>
            <Text style={styles.statLabel}>Trial</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValueMuted}>{stats.paused}</Text>
            <Text style={styles.statLabel}>Paused</Text>
          </View>
          <View style={styles.statWide}>
            <Text style={styles.statWideLabel}>Outstanding (unpaid + overdue)</Text>
            <Text style={styles.statWideValue}>€{stats.revenueDueEur}</Text>
            <Text style={styles.statWideMeta}>{stats.total} active members tracked</Text>
          </View>
        </View>
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
        <EmptyState title="No memberships in this filter" />
      ) : (
        rows.map((row) => {
          const tone = statusTone(row.membership.status);
          return (
            <Pressable
              key={row.member.id}
              onPress={() => openEdit(row)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(row.member.full_name)}</Text>
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{row.member.full_name}</Text>
                  <Text style={styles.meta}>
                    {row.membership.plan_label} · €{row.membership.amount_eur} ·{' '}
                    {row.membership.plan}
                  </Text>
                  <Text style={styles.meta}>
                    Period ends {row.membership.period_end}
                    {row.coachName ? ` · ${row.coachName}` : ''}
                  </Text>
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
              {row.membership.notes ? (
                <Text style={styles.notes}>{row.membership.notes}</Text>
              ) : null}
              <View style={styles.quickRow}>
                {row.membership.status !== 'paid' ? (
                  <PrimaryButton
                    title="Mark paid"
                    onPress={() => quickPaid(row.member.id, row.member.full_name)}
                    style={styles.quickBtn}
                  />
                ) : (
                  <PrimaryButton
                    title="Mark unpaid"
                    variant="secondary"
                    onPress={() => quickUnpaid(row.member.id, row.member.full_name)}
                    style={styles.quickBtn}
                  />
                )}
                <PrimaryButton
                  title="Edit"
                  variant="ghost"
                  onPress={() => openEdit(row)}
                  style={styles.quickBtn}
                />
                <PrimaryButton
                  title="Profile"
                  variant="ghost"
                  onPress={() => router.push(`/(coach)/clients/${row.member.id}`)}
                  style={styles.quickBtn}
                />
              </View>
            </Pressable>
          );
        })
      )}

      <Modal visible={Boolean(edit)} animationType="slide" transparent onRequestClose={() => setEdit(null)}>
        <View style={styles.backdrop}>
          {edit ? (
            <MembershipEditSheet
              edit={edit}
              status={status}
              plan={plan}
              planLabel={planLabel}
              amount={amount}
              periodEnd={periodEnd}
              notes={notes}
              paymentHistory={paymentHistory}
              historyLoading={historyLoading}
              saving={saving}
              formError={formError}
              billingReady={billingReady}
              onStatusChange={setStatus}
              onPlanChange={setPlan}
              onPlanLabelChange={setPlanLabel}
              onAmountChange={setAmount}
              onPeriodEndChange={setPeriodEnd}
              onNotesChange={setNotes}
              onSave={save}
              onMarkPaid={async () => {
                await adminService.markMembershipPaid(edit.member.id);
                setEdit(null);
                setToast('Marked paid & renewed');
                await load();
              }}
              onViewProfile={() => {
                setEdit(null);
                router.push(`/(coach)/clients/${edit.member.id}`);
              }}
              onClose={() => setEdit(null)}
            />
          ) : null}
        </View>
      </Modal>

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.backdrop}>
          <AddBillingMemberSheet
            fullName={addName}
            email={addEmail}
            phone={addPhone}
            plan={addPlan}
            amount={addAmount}
            status={addStatus}
            notes={addNotes}
            saving={addSaving}
            formError={addError}
            onFullNameChange={setAddName}
            onEmailChange={setAddEmail}
            onPhoneChange={setAddPhone}
            onPlanChange={setAddPlan}
            onAmountChange={setAddAmount}
            onStatusChange={setAddStatus}
            onNotesChange={setAddNotes}
            onSubmit={submitAddMember}
            onClose={() => setAddOpen(false)}
          />
        </View>
      </Modal>
    </Screen>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtnMain: { flex: 1.2 },
  actionBtnSecondary: { flex: 1 },
  setupBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(250,204,21,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    gap: spacing.xs,
  },
  setupTitle: { ...typography.subtitle, color: '#FACC15', fontSize: 15 },
  setupBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  setupCode: { fontFamily: 'monospace', color: colors.text },
  toast: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  toastText: { ...typography.caption, color: colors.accent },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statOk: {
    borderColor: 'rgba(74,222,128,0.35)',
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  statWarn: {
    borderColor: 'rgba(250,204,21,0.4)',
    backgroundColor: 'rgba(250,204,21,0.08)',
  },
  statValue: { ...typography.title, color: colors.success, fontSize: 26 },
  statValueWarn: { ...typography.title, color: '#FACC15', fontSize: 26 },
  statValueMuted: { ...typography.title, color: colors.textSecondary, fontSize: 26 },
  statLabel: { ...typography.label, color: colors.textMuted, fontSize: 10 },
  statWide: {
    width: '100%',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  statWideLabel: { ...typography.label, color: colors.textMuted },
  statWideValue: { ...typography.title, color: colors.accent, fontSize: 24 },
  statWideMeta: { ...typography.caption, color: colors.textSecondary },
  filterScroll: { marginBottom: spacing.md },
  filterChip: {
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  filterText: { ...typography.caption, color: colors.textSecondary },
  filterTextOn: { color: colors.accent, fontWeight: '700' },
  pressed: { opacity: 0.9 },
  card: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  avatarText: { ...typography.label, color: colors.accent },
  copy: { flex: 1, gap: 2 },
  name: { ...typography.subtitle, color: colors.text, fontSize: 16 },
  meta: { ...typography.caption, color: colors.textSecondary },
  notes: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  statusPill: {
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
    borderColor: 'rgba(250,204,21,0.4)',
  },
  statusDanger: {
    backgroundColor: 'rgba(255,77,77,0.12)',
    borderColor: 'rgba(255,77,77,0.35)',
  },
  statusText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  statusTextOk: { color: colors.success },
  statusTextWarn: { color: '#FACC15' },
  statusTextDanger: { color: colors.danger },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickBtn: { flex: 1, paddingVertical: spacing.sm },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
});
