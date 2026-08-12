import { format, addDays } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppInput } from '@/components/ui/AppInput';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import * as engagement from '@/services/engagement.supabase';
import type { GymChallenge } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const METRICS: { id: GymChallenge['metric']; label: string; hint: string }[] = [
  { id: 'workouts', label: 'Workouts', hint: 'Completed training sessions' },
  { id: 'classes', label: 'Classes', hint: 'Group class attendance' },
  { id: 'adherence', label: 'Adherence', hint: 'Program days completed' },
];

type ChallengeRow = GymChallenge & { enrollments: number };

export default function AdminChallengesScreen() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [metric, setMetric] = useState<GymChallenge['metric']>('workouts');
  const [target, setTarget] = useState('12');
  const [startsOn, setStartsOn] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endsOn, setEndsOn] = useState(format(addDays(new Date(), 28), 'yyyy-MM-dd'));

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Connect Supabase to manage gym challenges.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      const list = await engagement.listAllChallenges();
      const withCounts = await Promise.all(
        list.map(async (c) => ({
          ...c,
          enrollments: await engagement.getChallengeEnrollmentCount(c.id),
        })),
      );
      setRows(withCounts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load challenges');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCompose = () => {
    setFormError(null);
    setTitle('');
    setDescription('');
    setMetric('workouts');
    setTarget('12');
    setStartsOn(format(new Date(), 'yyyy-MM-dd'));
    setEndsOn(format(addDays(new Date(), 28), 'yyyy-MM-dd'));
    setComposeOpen(true);
  };

  const publish = async () => {
    if (!profile) return;
    const targetN = Number(target);
    if (!title.trim()) {
      setFormError('Add a challenge title');
      return;
    }
    if (!targetN || targetN < 1) {
      setFormError('Target must be at least 1');
      return;
    }
    if (endsOn < startsOn) {
      setFormError('End date must be on or after start date');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await engagement.createChallenge({
        title: title.trim(),
        description,
        metric,
        target: targetN,
        startsOn,
        endsOn,
        createdBy: profile.id,
      });
      setComposeOpen(false);
      setToast('Challenge published');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create challenge');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: ChallengeRow) => {
    await engagement.setChallengeActive(row.id, !row.active);
    setToast(row.active ? 'Challenge paused' : 'Challenge activated');
    await load();
  };

  const remove = async (id: string) => {
    await engagement.deleteChallenge(id);
    setToast('Challenge deleted');
    await load();
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={120} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error && rows.length === 0) {
    return (
      <Screen>
        <BackButton label="Studio" style={styles.back} />
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
      <BackButton label="Studio" style={styles.back} />

      <View style={styles.hero}>
        <LinearGradient
          colors={['rgba(200,255,0,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.heroKicker}>ENGAGEMENT</Text>
        <Text style={styles.heroTitle}>Gym challenges</Text>
        <Text style={styles.heroSub}>
          Create studio-wide challenges. Members can join and track progress against the target.
        </Text>
      </View>

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      <PrimaryButton title="New challenge" onPress={openCompose} style={styles.cta} />

      <SectionHeader title="All challenges" kicker="Studio" />

      {rows.length === 0 ? (
        <EmptyState
          title="No challenges yet"
          description="Launch a workouts, classes, or adherence challenge for the gym."
        />
      ) : (
        rows.map((row) => (
          <View key={row.id} style={[styles.card, !row.active && styles.cardInactive]}>
            <View style={styles.cardTop}>
              <View style={[styles.statusPill, row.active ? styles.statusOn : styles.statusOff]}>
                <Text style={[styles.statusText, !row.active && styles.statusTextOff]}>
                  {row.active ? 'ACTIVE' : 'PAUSED'}
                </Text>
              </View>
              <Text style={styles.metricPill}>{row.metric.toUpperCase()}</Text>
            </View>
            <Text style={styles.cardTitle}>{row.title}</Text>
            {row.description ? (
              <Text style={styles.cardBody} numberOfLines={3}>
                {row.description}
              </Text>
            ) : null}
            <Text style={styles.cardMeta}>
              Target {row.target} · {row.starts_on} → {row.ends_on} · {row.enrollments} joined
            </Text>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => void toggleActive(row)}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.actionBtnText}>{row.active ? 'Pause' : 'Activate'}</Text>
              </Pressable>
              <Pressable
                onPress={() => void remove(row.id)}
                style={({ pressed }) => [styles.actionBtnGhost, pressed && { opacity: 0.85 }]}>
                <Text style={styles.actionBtnGhostText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Modal visible={composeOpen} animationType="slide" transparent onRequestClose={() => setComposeOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>CREATE</Text>
            <Text style={styles.modalTitle}>New challenge</Text>
            <AppInput label="Title" value={title} onChangeText={setTitle} placeholder="March consistency push" />
            <AppInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional details for members"
              multiline
            />
            <Text style={styles.fieldLabel}>Metric</Text>
            <View style={styles.metricRow}>
              {METRICS.map((m) => {
                const on = metric === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setMetric(m.id)}
                    style={[styles.metricChip, on && styles.metricChipOn]}>
                    <Text style={[styles.metricChipText, on && styles.metricChipTextOn]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>{METRICS.find((m) => m.id === metric)?.hint}</Text>
            <AppInput
              label="Target"
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
              placeholder="12"
            />
            <AppInput label="Starts on" value={startsOn} onChangeText={setStartsOn} placeholder="YYYY-MM-DD" />
            <AppInput label="Ends on" value={endsOn} onChangeText={setEndsOn} placeholder="YYYY-MM-DD" />
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <PrimaryButton title={saving ? 'Publishing…' : 'Publish challenge'} onPress={publish} disabled={saving} />
            <PrimaryButton title="Cancel" variant="secondary" onPress={() => setComposeOpen(false)} disabled={saving} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: spacing.md, marginBottom: spacing.sm },
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    gap: spacing.xs,
  },
  heroKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    color: colors.text,
    letterSpacing: 1,
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 4,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.3)',
    marginBottom: spacing.md,
  },
  toastText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    flex: 1,
  },
  cta: { marginBottom: spacing.lg },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardInactive: {
    opacity: 0.72,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusOn: { backgroundColor: 'rgba(74,222,128,0.14)' },
  statusOff: { backgroundColor: 'rgba(255,255,255,0.06)' },
  statusText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.success,
  },
  statusTextOff: { color: colors.textMuted },
  metricPill: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.accent,
  },
  cardTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    color: colors.text,
  },
  cardBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  cardMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  actionBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.background,
  },
  actionBtnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnGhostText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '92%',
  },
  modalKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  metricRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  metricChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  metricChipOn: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: colors.accentMuted,
  },
  metricChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  metricChipTextOn: { color: colors.accent },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  formError: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.danger,
  },
});
