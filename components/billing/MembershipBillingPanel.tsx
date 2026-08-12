import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatDateTime } from '@/lib/utils/dates';
import type { MembershipRow } from '@/services/admin';
import type { MembershipPayment } from '@/services/mock/data';
import { colors, radius, spacing, typography } from '@/constants/theme';

type Props = {
  membership: MembershipRow | null;
  payments: MembershipPayment[];
  onMarkPaid?: () => void;
  onViewProfile?: () => void;
  loading?: boolean;
  historyOnly?: boolean;
};

function paymentTone(p: MembershipPayment): 'ok' | 'warn' | 'muted' {
  if (p.status === 'paid') return 'ok';
  if (p.status === 'pending') return 'warn';
  return 'muted';
}

export function MembershipBillingPanel({
  membership,
  payments,
  onMarkPaid,
  onViewProfile,
  loading,
  historyOnly,
}: Props) {
  if (!membership) {
    return <Text style={styles.empty}>No membership on file</Text>;
  }

  const { membership: m } = membership;

  return (
    <View style={styles.wrap}>
      {!historyOnly ? (
        <AppCard accent style={styles.card}>
          <Text style={styles.label}>Plan</Text>
          <Text style={styles.value}>
            {m.plan_label} · €{m.amount_eur} · {m.plan}
          </Text>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{m.status}</Text>
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
            {onMarkPaid && m.status !== 'paid' ? (
              <PrimaryButton title="Mark paid" onPress={onMarkPaid} style={styles.actionBtn} />
            ) : null}
            {onViewProfile ? (
              <PrimaryButton
                title="Open client profile"
                variant="secondary"
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
  label: { ...typography.label, color: colors.textMuted, marginTop: spacing.sm },
  value: { ...typography.subtitle, color: colors.text, fontSize: 16 },
  notes: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
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
