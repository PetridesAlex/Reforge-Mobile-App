import { format, parseISO } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import type { MembershipStatus } from '@/services/mock/data';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  planLabel: string;
  status: MembershipStatus | null;
  amountEur?: number | null;
  periodEnd?: string | null;
  loading?: boolean;
};

function statusMeta(status: MembershipStatus | null) {
  switch (status) {
    case 'paid':
      return {
        label: 'Active',
        headline: 'Subscription active',
        body: 'Your membership is paid and up to date.',
        icon: 'checkmark-circle' as const,
        tone: 'ok' as const,
      };
    case 'trial':
      return {
        label: 'Trial',
        headline: 'Trial membership',
        body: 'Enjoy full access during your trial period.',
        icon: 'sparkles' as const,
        tone: 'trial' as const,
      };
    case 'paused':
      return {
        label: 'Paused',
        headline: 'Membership paused',
        body: 'Contact the studio if you want to resume training.',
        icon: 'pause-circle' as const,
        tone: 'muted' as const,
      };
    case 'overdue':
      return {
        label: 'Overdue',
        headline: 'Payment overdue',
        body: 'Please renew your subscription to keep full access.',
        icon: 'alert-circle' as const,
        tone: 'danger' as const,
      };
    case 'unpaid':
    default:
      return {
        label: 'Payment due',
        headline: 'Subscription needs payment',
        body: 'Contact your coach or the studio to complete payment.',
        icon: 'card-outline' as const,
        tone: 'warn' as const,
      };
  }
}

export function MemberSubscriptionCard({
  planLabel,
  status,
  amountEur,
  periodEnd,
  loading,
}: Props) {
  if (loading) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <Text style={styles.loadingText}>Loading membership…</Text>
      </View>
    );
  }

  const meta = statusMeta(status);
  const needsPayment = status === 'unpaid' || status === 'overdue';
  const periodLabel =
    periodEnd != null
      ? format(parseISO(periodEnd.length === 10 ? `${periodEnd}T12:00:00` : periodEnd), 'MMM d, yyyy')
      : null;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={
          meta.tone === 'ok'
            ? ['rgba(200,255,0,0.14)', 'rgba(20,24,16,0.98)']
            : meta.tone === 'danger'
              ? ['rgba(255,77,77,0.12)', 'rgba(20,24,16,0.98)']
              : meta.tone === 'warn'
                ? ['rgba(250,204,21,0.1)', 'rgba(20,24,16,0.98)']
                : ['rgba(255,255,255,0.04)', 'rgba(20,24,16,0.98)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.topRow}>
          <View style={[styles.statusPill, styles[`pill_${meta.tone}`]]}>
            <Ionicons name={meta.icon} size={12} color={styles[`pillText_${meta.tone}`].color} />
            <Text style={[styles.statusPillText, styles[`pillText_${meta.tone}`]]}>{meta.label}</Text>
          </View>
          {periodLabel ? (
            <Text style={styles.periodMeta}>
              {needsPayment ? 'Due by' : 'Renews'} · {periodLabel}
            </Text>
          ) : null}
        </View>

        <Text style={styles.kicker}>Membership</Text>
        <Text style={styles.plan}>{planLabel}</Text>
        <Text style={styles.headline}>{meta.headline}</Text>
        <Text style={styles.body}>{meta.body}</Text>

        {amountEur != null ? (
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{needsPayment ? 'Amount due' : 'Plan amount'}</Text>
            <AnimatedCount
              value={amountEur}
              decimals={0}
              formatter={(v) => `€${Math.round(v)}`}
              style={styles.amountValue}
              duration={900}
              delay={120}
            />
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  cardLoading: {
    backgroundColor: colors.surfaceElevated,
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
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
  periodMeta: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  plan: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  amountRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  amountLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  amountValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.accent,
  },
});
