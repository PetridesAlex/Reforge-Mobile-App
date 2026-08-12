import { router, useFocusEffect } from 'expo-router';
import { addDays, format, parseISO } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useAuth } from '@/hooks/useAuth';
import { ABSENCE_SCOPE_LABELS } from '@/services/absences';
import * as memberService from '@/services/member';
import type { AbsenceScope, MemberAbsence } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const SCOPES: AbsenceScope[] = ['all', 'wod', 'class', 'private'];

const SCOPE_HINTS: Record<AbsenceScope, string> = {
  all: 'Not coming to the studio at all',
  wod: 'Missing the group workout only',
  class: 'Missing a scheduled group class',
  private: 'Missing a 1-on-1 session',
};

export default function ReportAbsenceScreen() {
  const { profile } = useAuth();
  const dates = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(new Date(), i)), []);
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [scope, setScope] = useState<AbsenceScope>('all');
  const [reason, setReason] = useState('');
  const [absences, setAbsences] = useState<MemberAbsence[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const from = format(new Date(), 'yyyy-MM-dd');
  const to = format(addDays(new Date(), 60), 'yyyy-MM-dd');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      setAbsences(await memberService.getMemberAbsences(profile.id, from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [profile, from, to]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  const existingForDay = absences.find((a) => a.absence_date === selectedKey);

  const onSubmit = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await memberService.reportTrainingAbsence({
        memberId: profile.id,
        absenceDate: selectedKey,
        scope,
        reason: reason.trim() || null,
      });
      setToast(`Coach notified — absent ${format(selectedDate, 'EEE d MMM')}`);
      setReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not report absence');
    } finally {
      setSaving(false);
    }
  };

  const onCancel = async (absenceId: string) => {
    if (!profile) return;
    try {
      await memberService.cancelTrainingAbsence(profile.id, absenceId);
      setToast('Absence removed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel');
    }
  };

  return (
    <Screen scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroHeader}>
          <LinearGradient
            colors={['rgba(200,255,0,0.1)', 'transparent', 'rgba(200,255,0,0.04)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.heroHeaderGlow}
          />
          <View style={styles.heroHeaderTop}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.heroPill}>
              <Ionicons name="calendar-clear-outline" size={11} color={colors.accent} />
              <Text style={styles.heroPillText}>AVAILABILITY</Text>
            </View>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="hand-left-outline" size={24} color={colors.accent} />
          </View>
          <Text style={styles.heroKicker}>LET YOUR COACH KNOW</Text>
          <Text style={styles.heroTitle}>Report Absence</Text>
          <Text style={styles.heroSub}>
            Mark days you won&apos;t train so your coach can plan sessions and the roster stays
            accurate. WOD skips sync automatically when you report a full day or WOD absence.
          </Text>
        </View>

        <SectionHeader title="Pick a date" kicker="Step 1" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateScroll}>
          {dates.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            const active = key === selectedKey;
            const reported = absences.some((a) => a.absence_date === key);
            const isToday = key === format(new Date(), 'yyyy-MM-dd');
            return (
              <Pressable
                key={key}
                onPress={() => setSelectedDate(d)}
                style={({ pressed }) => [styles.dateChip, pressed && styles.pressed]}>
                {active ? (
                  <LinearGradient
                    colors={['rgba(200,255,0,0.22)', 'rgba(200,255,0,0.08)']}
                    style={styles.dateChipGlow}
                  />
                ) : null}
                {reported ? <View style={styles.reportedDot} /> : null}
                <Text style={[styles.dateDow, active && styles.dateActiveText]}>
                  {isToday ? 'Today' : format(d, 'EEE')}
                </Text>
                <Text style={[styles.dateDayNum, active && styles.dateActiveText]}>
                  {format(d, 'd')}
                </Text>
                <Text style={[styles.dateMonth, active && styles.dateActiveText]}>
                  {format(d, 'MMM')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {existingForDay ? (
          <View style={styles.existingBanner}>
            <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
            <View style={styles.existingCopy}>
              <Text style={styles.existingTitle}>Already reported</Text>
              <Text style={styles.existingBody}>
                {ABSENCE_SCOPE_LABELS[existingForDay.scope]}
                {existingForDay.reason ? ` · ${existingForDay.reason}` : ''}
              </Text>
            </View>
            <PrimaryButton
              title="Remove"
              variant="secondary"
              onPress={() => onCancel(existingForDay.id)}
              style={styles.removeBtn}
            />
          </View>
        ) : (
          <>
            <SectionHeader title="What are you missing?" kicker="Step 2" />
            <View style={styles.scopeGrid}>
              {SCOPES.map((s) => {
                const active = scope === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setScope(s)}
                    style={({ pressed }) => [
                      styles.scopeChip,
                      active && styles.scopeChipActive,
                      pressed && styles.pressed,
                    ]}>
                    {active ? (
                      <LinearGradient
                        colors={['rgba(200,255,0,0.18)', 'rgba(200,255,0,0.06)']}
                        style={styles.scopeGlow}
                      />
                    ) : null}
                    <Text style={[styles.scopeLabel, active && styles.scopeLabelActive]}>
                      {ABSENCE_SCOPE_LABELS[s]}
                    </Text>
                    <Text style={styles.scopeHint}>{SCOPE_HINTS[s]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <AppInput
              label="Note for coach (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="Travel, injury, work trip…"
              multiline
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton
              title={saving ? 'Sending…' : 'Notify coach'}
              onPress={onSubmit}
              disabled={saving}
              style={styles.submitBtn}
            />
          </>
        )}

        {toast ? (
          <Pressable onPress={() => setToast(null)} style={styles.toast}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={styles.toastText}>{toast}</Text>
          </Pressable>
        ) : null}

        <SectionHeader title="Upcoming reports" kicker={`${absences.length} scheduled`} />

        {loading ? (
          <Text style={styles.hint}>Loading…</Text>
        ) : absences.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-outline" size={28} color={colors.accent} />
            <Text style={styles.emptyTitle}>No absences reported</Text>
            <Text style={styles.emptyBody}>
              You&apos;re marked available for all upcoming days. Report here when plans change.
            </Text>
          </View>
        ) : (
          absences.map((a) => (
            <View key={a.id} style={styles.absenceRow}>
              <View style={styles.absenceIcon}>
                <Ionicons name="calendar-outline" size={16} color={colors.accent} />
              </View>
              <View style={styles.absenceCopy}>
                <Text style={styles.absenceDate}>
                  {format(parseISO(a.absence_date), 'EEE d MMM yyyy')}
                </Text>
                <Text style={styles.absenceMeta}>
                  {ABSENCE_SCOPE_LABELS[a.scope]}
                  {a.reason ? ` · ${a.reason}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => onCancel(a.id)} hitSlop={8} style={styles.cancelLink}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  heroHeader: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
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
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  dateScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  dateChip: {
    position: 'relative',
    overflow: 'hidden',
    width: 72,
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
  },
  dateChipGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
  },
  reportedDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4D4D',
  },
  dateDow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  dateDayNum: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
  },
  dateMonth: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textSecondary,
  },
  dateActiveText: {
    color: colors.accent,
  },
  existingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  existingCopy: {
    flex: 1,
    gap: 2,
  },
  existingTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  existingBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  removeBtn: {
    minWidth: 88,
  },
  scopeGrid: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  scopeChip: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: 4,
  },
  scopeChipActive: {
    borderColor: 'rgba(200,255,0,0.45)',
  },
  scopeGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  scopeLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    zIndex: 1,
  },
  scopeLabelActive: {
    color: colors.accent,
  },
  scopeHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    zIndex: 1,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  toastText: {
    ...typography.caption,
    color: colors.accent,
    flex: 1,
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  absenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  absenceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  absenceCopy: {
    flex: 1,
    gap: 2,
  },
  absenceDate: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  absenceMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cancelLink: {
    padding: spacing.xs,
  },
  cancelText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.danger,
  },
  pressed: {
    opacity: 0.88,
  },
});
