import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { MembershipPlan, MembershipStatus } from '@/services/mock/data';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const PLAN_OPTIONS: MembershipPlan[] = ['monthly', 'quarterly', 'annual', 'drop-in'];
const STATUS_OPTIONS: MembershipStatus[] = ['unpaid', 'trial', 'paid'];

const PLAN_LABELS: Record<MembershipPlan, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  'drop-in': 'Drop-in',
};

type Props = {
  fullName: string;
  email: string;
  phone: string;
  plan: MembershipPlan;
  amount: string;
  status: MembershipStatus;
  notes: string;
  saving: boolean;
  formError: string | null;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPlanChange: (plan: MembershipPlan) => void;
  onAmountChange: (value: string) => void;
  onStatusChange: (status: MembershipStatus) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function AddBillingMemberSheet({
  fullName,
  email,
  phone,
  plan,
  amount,
  status,
  notes,
  saving,
  formError,
  onFullNameChange,
  onEmailChange,
  onPhoneChange,
  onPlanChange,
  onAmountChange,
  onStatusChange,
  onNotesChange,
  onSubmit,
  onClose,
}: Props) {
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <LinearGradient
            colors={['rgba(200,255,0,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGlow}
          />
          <Text style={styles.kicker}>BILLING</Text>
          <Text style={styles.title}>Add member</Text>
          <Text style={styles.subtitle}>
            Track a new REFORGE member for payments and invoices. Email or phone is required.
          </Text>
        </View>

        <View style={styles.formCard}>
          <AppInput label="Full name" value={fullName} onChangeText={onFullNameChange} placeholder="Marcel Papadopoulos" />
          <AppInput
            label="Email"
            value={email}
            onChangeText={onEmailChange}
            placeholder="member@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <AppInput
            label="Phone"
            value={phone}
            onChangeText={onPhoneChange}
            placeholder="+357 99 000000"
            keyboardType="phone-pad"
          />
        </View>

        <Text style={styles.sectionTitle}>Starting plan</Text>
        <View style={styles.planGrid}>
          {PLAN_OPTIONS.map((p) => {
            const active = plan === p;
            return (
              <Pressable
                key={p}
                onPress={() => onPlanChange(p)}
                style={[styles.planChip, active && styles.planChipOn]}>
                <Text style={[styles.planChipText, active && styles.planChipTextOn]}>
                  {PLAN_LABELS[p]}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
            <Text style={styles.fieldLabel}>Initial status</Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => onStatusChange(s)}
                  style={[styles.statusChip, status === s && styles.statusChipOn]}>
                  <Text style={[styles.statusChipText, status === s && styles.statusChipTextOn]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <AppInput
          label="Notes"
          value={notes}
          onChangeText={onNotesChange}
          placeholder="New member — awaiting first payment"
        />

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={saving ? 'Adding…' : 'Add to billing'}
          onPress={onSubmit}
          disabled={saving}
        />
        <PrimaryButton title="Cancel" variant="ghost" onPress={onClose} />
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
    gap: spacing.md,
  },
  header: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.12)',
  },
  headerGlow: { ...StyleSheet.absoluteFillObject },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 2.2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  planChip: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  planChipOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  planChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  planChipTextOn: { color: colors.accent, fontFamily: fonts.sansSemiBold },
  formRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  formHalf: { flex: 1, gap: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  statusChipOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  statusChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  statusChipTextOn: { color: colors.accent },
  formError: { ...typography.caption, color: colors.danger },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
