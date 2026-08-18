import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppCard } from '@/components/ui/AppCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatDateTime } from '@/lib/utils/dates';
import type { MembershipRow } from '@/services/admin';
import type { MembershipPayment, MembershipStatus } from '@/services/mock/data';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type Props = {
  membership: MembershipRow | null;
  payments: MembershipPayment[];
  onMarkPaid?: () => void;
  onMarkUnpaid?: () => void;
  onSendReminder?: () => void;
  onViewProfile?: () => void;
  loading?: boolean;
  historyOnly?: boolean;
  reminderBusy?: boolean;
};

function paymentTone(p: MembershipPayment): 'ok' | 'warn' | 'muted' {
  if (p.status === 'paid') return 'ok';
  if (p.status === 'pending') return 'warn';
  return 'muted';
}

function statusMeta(status: MembershipStatus) {
  switch (status) {
    case 'paid':
      return { label: 'Active', icon: 'checkmark-circle' as const, tone: 'ok' as const };
    case 'overdue':
      return { label: 'Overdue', icon: 'alert-circle' as const, tone: 'danger' as const };
    case 'trial':
      return { label: 'Trial', icon: 'sparkles' as const, tone: 'trial' as const };
    case 'paused':
      return { label: 'Paused', icon: 'pause-circle' as const, tone: 'muted' as const };
    default:
      return { label: 'Unpaid', icon: 'card-outline' as const, tone: 'warn' as const };
  }
}

export function MembershipBillingPanel({
  membership,
  payments,
  onMarkPaid,
  onMarkUnpaid,
  onSendReminder,
  onViewProfile,
  loading,
  historyOnly,
  reminderBusy,
}: Props) {
  if (!membership) {
    return <Text style={styles.empty}>No membership on file</Text>;
  }

  const { membership: m } = membership;
  const meta = statusMeta(m.status);
  const needsPayment = m.status === 'unpaid' || m.status === 'overdue';

  return (
    <View style={styles.wrap}>
      {!historyOnly ? (
        <AppCard accent style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, styles[`pill_${meta.tone}`]]}>
              <Ionicons
                name={meta.icon}
                size={13}
                color={styles[`pillText_${meta.tone}`].color}
              />
              <Text style={[styles.statusPillText, styles[`pillText_${meta.tone}`]]}>
                {meta.label}
              </Text>
            </View>
            <Text style={styles.amount}>€{m.amount_eur}</Text>
          </View>

          <Text style={styles.label}>Plan</Text>
          <Text style={styles.value}>
            {m.plan_label} · {m.plan}
          </Text>
          <Text style={styles.label}>Current period</Text>
          <Text style={styles.value}>
            {m.period_start} → {m.period_end}
          </Text>
          {m.last_paid_at ? (
            <>
              <Text style={styles.label}>Last paid</Text>
              <Text style={styles.value}>{m.last_paid_at}</Text>
            </>
          ) : null}
          {m.notes ? <Text style={styles.notes}>{m.notes}</Text> : null}

          <View style={styles.actions}>
            {needsPayment && onMarkPaid ? (
              <PrimaryButton title="Mark paid" onPress={onMarkPaid} style={styles.actionBtn} />
            ) : null}
            {m.status === 'paid' && onMarkUnpaid ? (
              <PrimaryButton
                title="Mark unpaid"
                variant="secondary"
                onPress={onMarkUnpaid}
                style={styles.actionBtn}
              />
            ) : null}
            {needsPayment && onSendReminder ? (
              <PrimaryButton
                title={reminderBusy ? 'Sending…' : 'Send payment reminder'}
                variant="secondary"
                onPress={onSendReminder}
                disabled={reminderBusy}
                style={styles.actionBtn}
              />
            ) : null}
            {onViewProfile ? (
              <PrimaryButton
                title="Open client profile"
                variant="ghost"
                onPress={onViewProfile}
                style={styles.actionBtn}
              />
            ) : null}
          </View>
        </AppCard>
      ) : null}

      <Text style={styles.sectionTitle}>Payment history</Text>
      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : payments.length === 0 ? (
        <Text style={styles.empty}>No payments or invoices yet</Text>
      ) : (
        payments.map((p) => {
          const tone = paymentTone(p);
          return (
            <AppCard key={p.id} style={styles.historyCard}>
              <View style={styles.historyTop}>
                <Text style={styles.historyPeriod}>{p.period_label}</Text>
                <View
                  style={[
                    styles.pill,
                    tone === 'ok' && styles.pillOk,
                    tone === 'warn' && styles.pillWarn,
                  ]}>
                  <Text
                    style={[
                      styles.pillText,
                      tone === 'ok' && styles.pillTextOk,
                      tone === 'warn' && styles.pillTextWarn,
                    ]}>
                    {p.kind} · {p.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.historyAmount}>€{p.amount_eur}</Text>
              <Text style={styles.historyMeta}>{formatDateTime(p.created_at)}</Text>
              {p.notes ? <Text style={styles.historyNotes}>{p.notes}</Text> : null}
            </AppCard>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: { gap: spacing.xs },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  pill_ok: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderColor: 'rgba(74,222,128,0.35)',
  },
  pill_warn: {
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderColor: 'rgba(250,204,21,0.35)',
  },
  pill_danger: {
    backgroundColor: 'rgba(255,77,77,0.12)',
    borderColor: 'rgba(255,77,77,0.35)',
  },
  pill_trial: {
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderColor: 'rgba(200,255,0,0.28)',
  },
  pill_muted: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
  },
  statusPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  pillText_ok: { color: colors.success },
  pillText_warn: { color: '#FACC15' },
  pillText_danger: { color: colors.danger },
  pillText_trial: { color: colors.accent },
  pillText_muted: { color: colors.textMuted },
  amount: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.accent,
  },
  label: { ...typography.label, color: colors.textMuted, marginTop: spacing.sm },
  value: { ...typography.subtitle, color: colors.text, fontSize: 16 },
  notes: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flexGrow: 1, minWidth: 140 },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  empty: { ...typography.body, color: colors.textSecondary },
  historyCard: { marginBottom: spacing.sm, gap: 4 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyPeriod: { ...typography.subtitle, color: colors.text, fontSize: 15 },
  historyAmount: { ...typography.title, color: colors.accent, fontSize: 20 },
  historyMeta: { ...typography.caption, color: colors.textSecondary },
  historyNotes: { ...typography.caption, color: colors.textMuted },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  pillOk: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderColor: 'rgba(74,222,128,0.35)',
  },
  pillWarn: {
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderColor: 'rgba(250,204,21,0.4)',
  },
  pillText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  pillTextOk: { color: colors.success },
  pillTextWarn: { color: '#FACC15' },
});
