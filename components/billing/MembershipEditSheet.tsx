import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { MembershipBillingPanel } from '@/components/billing/MembershipBillingPanel';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { MembershipRow } from '@/services/admin';
import type { MembershipPayment, MembershipPlan, MembershipStatus } from '@/services/mock/data';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const STATUS_OPTIONS: MembershipStatus[] = ['paid', 'unpaid', 'overdue', 'trial', 'paused'];
const PLAN_OPTIONS: MembershipPlan[] = ['monthly', 'quarterly', 'annual', 'drop-in'];

const STATUS_LABELS: Record<MembershipStatus, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
  trial: 'Trial',
  paused: 'Paused',
};

const PLAN_LABELS: Record<MembershipPlan, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  'drop-in': 'Drop-in',
};

function statusChipStyle(status: MembershipStatus, active: boolean) {
  const palettes: Record<
    MembershipStatus,
    { dot: string; border: string; bg: string; text: string; glow: string }
  > = {
    paid: {
      dot: colors.success,
      border: 'rgba(74,222,128,0.35)',
      bg: 'rgba(74,222,128,0.12)',
      text: colors.success,
      glow: 'rgba(74,222,128,0.2)',
    },
    unpaid: {
      dot: '#FACC15',
      border: 'rgba(250,204,21,0.35)',
      bg: 'rgba(250,204,21,0.1)',
      text: '#FACC15',
      glow: 'rgba(250,204,21,0.18)',
    },
    overdue: {
      dot: colors.danger,
      border: 'rgba(255,77,77,0.35)',
      bg: 'rgba(255,77,77,0.12)',
      text: colors.danger,
      glow: 'rgba(255,77,77,0.2)',
    },
    trial: {
      dot: colors.accent,
      border: 'rgba(200,255,0,0.3)',
      bg: 'rgba(200,255,0,0.08)',
      text: colors.accent,
      glow: 'rgba(200,255,0,0.15)',
    },
    paused: {
      dot: colors.textMuted,
      border: 'rgba(255,255,255,0.12)',
      bg: 'rgba(255,255,255,0.04)',
      text: colors.textSecondary,
      glow: 'rgba(255,255,255,0.06)',
    },
  };

  const palette = palettes[status];
  if (active) return palette;

  return {
    dot: palette.dot,
    border: palette.border,
    bg: colors.surfaceElevated,
    text: colors.textMuted,
    glow: 'transparent',
  };
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

type Props = {
  edit: MembershipRow;
  status: MembershipStatus;
  plan: MembershipPlan;
  planLabel: string;
  amount: string;
  periodEnd: string;
  notes: string;
  paymentHistory: MembershipPayment[];
  historyLoading: boolean;
  saving: boolean;
  formError: string | null;
  billingReady: boolean;
  onStatusChange: (status: MembershipStatus) => void;
  onPlanChange: (plan: MembershipPlan) => void;
  onPlanLabelChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSave: () => void;
  onMarkPaid: () => void;
  onViewProfile: () => void;
  onClose: () => void;
};

export function MembershipEditSheet({
  edit,
  status,
  plan,
  planLabel,
  amount,
  periodEnd,
  notes,
  paymentHistory,
  historyLoading,
  saving,
  formError,
  billingReady,
  onStatusChange,
  onPlanChange,
  onPlanLabelChange,
  onAmountChange,
  onPeriodEndChange,
  onNotesChange,
  onSave,
  onMarkPaid,
  onViewProfile,
  onClose,
}: Props) {
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <LinearGradient
            colors={['rgba(200,255,0,0.1)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGlow}
          />
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(edit.member.full_name)}</Text>
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.headerName}>{edit.member.full_name}</Text>
              <Text style={styles.headerEmail}>{edit.member.email}</Text>
              {edit.member.phone ? (
                <Text style={styles.headerPhone}>{edit.member.phone}</Text>
              ) : null}
            </View>
            <Pressable onPress={onViewProfile} style={styles.profileLink}>
              <Text style={styles.profileLinkText}>Profile</Text>
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>€{edit.membership.amount_eur}</Text>
              <Text style={styles.summaryLabel}>Amount</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{PLAN_LABELS[edit.membership.plan]}</Text>
              <Text style={styles.summaryLabel}>Plan</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.summaryStatus]}>{STATUS_LABELS[edit.membership.status]}</Text>
              <Text style={styles.summaryLabel}>Status</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusSection}>
          <LinearGradient
            colors={['rgba(200,255,0,0.04)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statusSectionGlow}
          />
          <Text style={styles.sectionKicker}>BILLING</Text>
          <Text style={styles.sectionTitleDisplay}>Payment status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScrollContent}>
            {STATUS_OPTIONS.map((s) => {
              const active = status === s;
              const tone = statusChipStyle(s, active);
              return (
                <Pressable
                  key={s}
                  onPress={() => onStatusChange(s)}
                  style={({ pressed }) => [
                    styles.statusChip,
                    {
                      backgroundColor: tone.bg,
                      borderColor: tone.border,
                    },
                    active && styles.statusChipActive,
                    pressed && styles.statusChipPressed,
                  ]}>
                  {active ? (
                    <LinearGradient
                      colors={[tone.glow, 'transparent']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.statusChipGlow}
                    />
                  ) : null}
                  <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: active ? tone.text : colors.textSecondary },
                      active && styles.statusChipTextActive,
                    ]}>
                    {STATUS_LABELS[s].toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleDisplay}>Plan type</Text>
          <View style={styles.planGrid}>
            {PLAN_OPTIONS.map((p) => {
              const active = plan === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => onPlanChange(p)}
                  style={[styles.planChip, active && styles.planChipOn]}>
                  {active ? (
                    <LinearGradient
                      colors={['rgba(200,255,0,0.12)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.planChipGlow}
                    />
                  ) : null}
                  <Text style={[styles.planChipText, active && styles.planChipTextOn]}>
                    {PLAN_LABELS[p].toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.formCard}>
          <AppInput label="Plan label" value={planLabel} onChangeText={onPlanLabelChange} />
          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <AppInput
                label="Amount (€)"
                value={amount}
                onChangeText={onAmountChange}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.formHalf}>
              <AppInput
                label="Period end"
                value={periodEnd}
                onChangeText={onPeriodEndChange}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
          <AppInput
            label="Notes"
            value={notes}
            onChangeText={onNotesChange}
            placeholder="Payment reminders, special terms…"
          />
        </View>

        <MembershipBillingPanel
          membership={edit}
          payments={paymentHistory}
          loading={historyLoading}
          historyOnly
        />

        {!billingReady ? (
          <Text style={styles.setupHint}>
            Run migration 007 to save billing changes to the database.
          </Text>
        ) : null}

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={saving ? 'Saving…' : 'Save membership'}
          onPress={onSave}
          disabled={saving || !billingReady}
          style={styles.footerBtn}
        />
        <View style={styles.footerRow}>
          <PrimaryButton
            title="Mark paid"
            variant="secondary"
            onPress={onMarkPaid}
            disabled={!billingReady}
            style={styles.footerBtnHalf}
          />
          <PrimaryButton title="Close" variant="ghost" onPress={onClose} style={styles.footerBtnHalf} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '94%',
    backgroundColor: '#0C0C0C',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  header: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.15)',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.md,
  },
  headerGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.3)',
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.accent,
    letterSpacing: 1,
  },
  headerCopy: { flex: 1, gap: 2, minWidth: 0 },
  headerName: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
    letterSpacing: 0.8,
  },
  headerEmail: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  headerPhone: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textMuted,
  },
  profileLink: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileLinkText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 0.6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.border },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 0.6,
  },
  summaryStatus: { color: colors.accent },
  summaryLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  section: { gap: spacing.sm },
  statusSection: {
    position: 'relative',
    overflow: 'hidden',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
  },
  statusSectionGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  sectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 2.4,
  },
  sectionTitleDisplay: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
    letterSpacing: 1,
  },
  chipScrollContent: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  statusChip: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  statusChipActive: {
    shadowColor: colors.accent,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusChipPressed: { opacity: 0.88 },
  statusChipGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  statusChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.8,
  },
  statusChipTextActive: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1.2,
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  planChip: {
    position: 'relative',
    overflow: 'hidden',
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  planChipGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  planChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  planChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1.6,
  },
  planChipTextOn: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.accent,
    letterSpacing: 1,
  },
  formCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formHalf: { flex: 1 },
  setupHint: {
    ...typography.caption,
    color: '#FACC15',
    lineHeight: 18,
  },
  formError: { ...typography.caption, color: colors.danger },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0C0C0C',
  },
  footerBtn: { width: '100%' },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  footerBtnHalf: { flex: 1 },
});
