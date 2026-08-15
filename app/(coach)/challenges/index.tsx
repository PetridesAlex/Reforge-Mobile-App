import { format, addDays } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ChallengePodium } from '@/components/challenges/ChallengePodium';
import { LeaderboardList } from '@/components/challenges/LeaderboardList';
import { AppInput } from '@/components/ui/AppInput';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { canManageChallenges } from '@/lib/permissions';
import * as challenges from '@/services/challenges';
import type {
  ChallengeResult,
  ChallengeScoreType,
  WeeklyChallenge,
  WeeklyChallengeStatus,
} from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const SCORE_TYPES: { id: ChallengeScoreType; label: string }[] = [
  { id: 'lowest_time', label: 'Lowest time' },
  { id: 'highest_reps', label: 'Highest reps' },
  { id: 'highest_weight', label: 'Highest weight' },
  { id: 'highest_points', label: 'Highest points' },
  { id: 'coach_score', label: 'Coach score' },
];

function parseTimeToSeconds(input: string): number | null {
  const t = input.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = t.match(/^(\d+):(\d{2})(?:\.(\d+))?$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0);
}

export default function StaffChallengesScreen() {
  const { profile, role } = useAuth();
  const allowed = canManageChallenges(role);

  const [rows, setRows] = useState<WeeklyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WeeklyChallenge | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [podium, setPodium] = useState<Awaited<ReturnType<typeof challenges.getChallengePodium>>>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [movementsText, setMovementsText] = useState('10 Burpees\n15 Wall Balls\n200m Run');
  const [scoreType, setScoreType] = useState<ChallengeScoreType>('lowest_time');
  const [startsAt, setStartsAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endsAt, setEndsAt] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"));
  const [xpParticipate, setXpParticipate] = useState('75');
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      setError(null);
      const list = await challenges.listWeeklyChallenges({ staff: true });
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load challenges');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditId(null);
    setName('');
    setDescription('');
    setInstructions('For time. Best possible time wins.');
    setMovementsText('10 Burpees\n15 Wall Balls\n200m Run');
    setScoreType('lowest_time');
    setStartsAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setEndsAt(format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"));
    setXpParticipate('75');
    setEditorOpen(true);
  };

  const openEdit = (row: WeeklyChallenge) => {
    setEditId(row.id);
    setName(row.name);
    setDescription(row.description ?? '');
    setInstructions(row.instructions ?? '');
    setMovementsText(row.movements.map((m) => (m.reps ? `${m.reps} ${m.name}` : m.name)).join('\n'));
    setScoreType(row.score_type);
    setStartsAt(row.starts_at.slice(0, 16));
    setEndsAt(row.ends_at.slice(0, 16));
    setXpParticipate(String(row.xp_participate));
    setEditorOpen(true);
  };

  const onSave = async (publish?: WeeklyChallengeStatus) => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const movements = movementsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const m = line.match(/^(\d+)\s+(.+)$/);
          if (m) return { name: m[2], reps: m[1] };
          return { name: line, reps: null };
        });
      const status = publish ?? (editId ? undefined : 'draft');
      await challenges.upsertWeeklyChallenge({
        id: editId ?? undefined,
        name,
        description,
        instructions,
        movements,
        score_type: scoreType,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        status: status as WeeklyChallengeStatus | undefined,
        xp_participate: Number(xpParticipate) || 75,
        created_by: profile.id,
      });
      setEditorOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (row: WeeklyChallenge) => {
    setSelected(row);
    try {
      const [res, pod] = await Promise.all([
        challenges.listChallengeResults(row.id),
        challenges.getChallengePodium(row.id),
      ]);
      setResults(res);
      setPodium(pod);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load results');
    }
  };

  const pending = useMemo(() => results.filter((r) => r.status === 'pending'), [results]);

  if (!allowed) {
    return (
      <Screen>
        <BackButton />
        <EmptyState icon="lock-closed-outline" title="Staff only" description="Coaches and admins manage challenges." />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <Skeleton height={40} />
        <Skeleton height={120} style={{ marginTop: 16 }} />
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
      <View style={styles.top}>
        <BackButton />
        <Text style={styles.title}>CHALLENGES</Text>
        <Pressable onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={20} color={colors.background} />
        </Pressable>
      </View>
      <Text style={styles.sub}>Weekly competition · verify results · podium</Text>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!rows.length && !error ? (
        <EmptyState
          icon="trophy-outline"
          title="No weekly challenges"
          description="Create the first REFORGE weekly challenge."
        />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable key={row.id} onPress={() => void openDetail(row)} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.status}>{row.status.toUpperCase()}</Text>
                <Text style={styles.meta}>
                  {row.verified_count ?? 0}/{row.participant_count ?? 0} verified
                </Text>
              </View>
              <Text style={styles.cardTitle}>{row.name}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {row.description || row.instructions || 'Weekly challenge'}
              </Text>
              <Text style={styles.dates}>
                {format(new Date(row.starts_at), 'MMM d')} → {format(new Date(row.ends_at), 'MMM d · HH:mm')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <Screen>
          <View style={styles.top}>
            <BackButton onPress={() => setSelected(null)} />
            <Text style={styles.title} numberOfLines={1}>
              {selected?.name ?? 'Challenge'}
            </Text>
          </View>
          {selected ? (
            <>
              <View style={styles.actions}>
                <PrimaryButton title="Edit" variant="ghost" onPress={() => openEdit(selected)} />
                {selected.status !== 'live' && selected.status !== 'closed' ? (
                  <PrimaryButton
                    title="Go live"
                    onPress={() =>
                      void challenges.setChallengeStatus(selected.id, 'live').then(async (r) => {
                        setSelected(r);
                        await load();
                      })
                    }
                  />
                ) : null}
                {selected.status === 'live' ? (
                  <PrimaryButton
                    title="Close & award podium"
                    onPress={() =>
                      void challenges.setChallengeStatus(selected.id, 'closed').then(async (r) => {
                        setSelected(r);
                        await openDetail(r);
                        await load();
                      })
                    }
                  />
                ) : null}
                {selected.status === 'closed' ? (
                  <PrimaryButton
                    title="Archive"
                    variant="ghost"
                    onPress={() =>
                      void challenges.setChallengeStatus(selected.id, 'archived').then(async (r) => {
                        setSelected(r);
                        await load();
                      })
                    }
                  />
                ) : null}
              </View>

              <SectionHeader title="Podium" kicker="Results" />
              <ChallengePodium places={podium} />

              <SectionHeader title="Pending verification" kicker="Inbox" />
              {pending.length === 0 ? (
                <Text style={styles.emptyInline}>No pending submissions</Text>
              ) : (
                pending.map((r) => (
                  <View key={r.id} style={styles.pendingCard}>
                    <Text style={styles.pendingName}>{r.member_name ?? r.member_id.slice(0, 8)}</Text>
                    <Text style={styles.pendingScore}>{r.score_display}</Text>
                    <View style={styles.pendingActions}>
                      <PrimaryButton
                        title="Verify"
                        onPress={() =>
                          void challenges
                            .verifyChallengeResult({ resultId: r.id, status: 'verified' })
                            .then(() => openDetail(selected))
                        }
                      />
                      <PrimaryButton
                        title="Reject"
                        variant="ghost"
                        onPress={() =>
                          void challenges
                            .verifyChallengeResult({ resultId: r.id, status: 'rejected' })
                            .then(() => openDetail(selected))
                        }
                      />
                    </View>
                  </View>
                ))
              )}

              <SectionHeader title="Leaderboard" kicker="Verified" />
              <LeaderboardList rows={results} showStatus />
              <View style={{ height: 40 }} />
            </>
          ) : null}
        </Screen>
      </Modal>

      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <Screen>
          <View style={styles.top}>
            <BackButton onPress={() => setEditorOpen(false)} />
            <Text style={styles.title}>{editId ? 'EDIT' : 'CREATE'}</Text>
          </View>
          <AppInput label="Name" value={name} onChangeText={setName} placeholder="THE ENGINE" />
          <AppInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Short blurb"
          />
          <AppInput
            label="Instructions / rules"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            style={{ minHeight: 80 }}
          />
          <AppInput
            label="Movements (one per line)"
            value={movementsText}
            onChangeText={setMovementsText}
            multiline
            style={{ minHeight: 100 }}
          />
          <Text style={styles.label}>SCORE TYPE</Text>
          <View style={styles.chips}>
            {SCORE_TYPES.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setScoreType(s.id)}
                style={[styles.chip, scoreType === s.id && styles.chipOn]}>
                <Text style={[styles.chipText, scoreType === s.id && styles.chipTextOn]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <AppInput label="Starts (local)" value={startsAt} onChangeText={setStartsAt} />
          <AppInput label="Ends (local)" value={endsAt} onChangeText={setEndsAt} />
          <AppInput label="XP for participation" value={xpParticipate} onChangeText={setXpParticipate} keyboardType="number-pad" />
          <PrimaryButton
            title={saving ? 'Saving…' : 'Save draft'}
            onPress={() => void onSave('draft')}
            disabled={saving || !name.trim()}
          />
          <PrimaryButton
            title={saving ? 'Publishing…' : 'Save & go live'}
            onPress={() => void onSave('live')}
            disabled={saving || !name.trim()}
          />
          <PrimaryButton title="Cancel" variant="ghost" onPress={() => setEditorOpen(false)} />
          <View style={{ height: 24 }} />
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    flex: 1,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: 10 },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  status: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  meta: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.text },
  cardDesc: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  dates: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  actions: { gap: 8, marginBottom: spacing.lg },
  emptyInline: {
    fontFamily: fonts.sans,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  pendingCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
    backgroundColor: colors.surface,
    marginBottom: 8,
    gap: 8,
  },
  pendingName: { fontFamily: fonts.sansSemiBold, color: colors.text },
  pendingScore: { fontFamily: fonts.display, fontSize: 28, color: colors.accent },
  pendingActions: { gap: 8 },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary },
  chipTextOn: { color: colors.text },
});
