import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AchievementMark } from '@/components/achievements/AchievementMark';
import { AppInput } from '@/components/ui/AppInput';
import { Avatar } from '@/components/ui/Avatar';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { canManageAchievements } from '@/lib/permissions';
import * as achievements from '@/services/achievements';
import * as adminService from '@/services/admin';
import type { Achievement } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type AwardMember = { id: string; full_name: string; avatar_url?: string | null };

const CATEGORIES = [
  { id: 'training', label: 'Training' },
  { id: 'performance', label: 'Performance' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'special', label: 'Special' },
] as const;

const RARITIES = [
  { id: 'common', label: 'Common', tone: 'rgba(255,255,255,0.35)' },
  { id: 'rare', label: 'Rare', tone: 'rgba(160,190,220,0.85)' },
  { id: 'epic', label: 'Epic', tone: 'rgba(200,255,0,0.7)' },
  { id: 'legendary', label: 'Legendary', tone: colors.accent },
] as const;

function rarityTone(rarity?: string | null) {
  return RARITIES.find((r) => r.id === rarity)?.tone ?? RARITIES[0].tone;
}

export default function AchievementManagerScreen() {
  const { role, profile } = useAuth();
  const allowed = canManageAchievements(role);
  const [rows, setRows] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('special');
  const [rarity, setRarity] = useState<string>('epic');
  const [xp, setXp] = useState('250');
  const [awardCode, setAwardCode] = useState('');
  const [coachNote, setCoachNote] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<AwardMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [awardToast, setAwardToast] = useState<string | null>(null);

  const manualAwards = useMemo(
    () => rows.filter((r) => r.award_mode === 'manual' && r.is_active !== false),
    [rows],
  );

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  const selectedAward = useMemo(
    () => manualAwards.find((a) => a.code === awardCode) ?? null,
    [manualAwards, awardCode],
  );

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      setError(null);
      setRows(await achievements.listAchievements({ activeOnly: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.is_active !== false).length;
    const manual = rows.filter((r) => r.award_mode === 'manual').length;
    return { total: rows.length, active, manual };
  }, [rows]);

  const openCreate = () => {
    setEditId(null);
    setCode('');
    setTitle('');
    setDescription('');
    setCategory('special');
    setRarity('epic');
    setXp('250');
    setEditorOpen(true);
  };

  const openEdit = (row: Achievement) => {
    setEditId(row.id);
    setCode(row.code);
    setTitle(row.title);
    setDescription(row.description ?? '');
    setCategory(row.category ?? 'special');
    setRarity(row.rarity ?? 'common');
    setXp(String(row.xp_reward ?? 50));
    setEditorOpen(true);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await achievements.upsertAchievement({
        id: editId ?? undefined,
        code,
        title,
        description,
        category,
        rarity,
        xp_reward: Number(xp) || 50,
        award_mode: category === 'special' ? 'manual' : 'automatic',
        icon_key: 'trophy',
        is_active: true,
      });
      setEditorOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const openAward = async () => {
    setAwardOpen(true);
    setCoachNote('');
    setMemberQuery('');
    setSelectedMemberId(null);
    setAwardCode(
      rows.find((r) => r.award_mode === 'manual' && r.is_active !== false)?.code ?? 'coachs_choice',
    );
    try {
      const all = await adminService.listMembers();
      setMembers(
        all.map((m) => ({
          id: m.member.id,
          full_name: m.member.full_name,
          avatar_url: m.member.avatar_url,
        })),
      );
    } catch {
      try {
        if (!profile) throw new Error('no profile');
        const { getClients } = await import('@/services/coach');
        const clients = await getClients(profile.id, { studioWide: role === 'admin' });
        setMembers(
          clients.map((c) => ({
            id: c.member.id,
            full_name: c.member.full_name,
            avatar_url: c.member.avatar_url,
          })),
        );
      } catch {
        setMembers([]);
      }
    }
  };

  const onAward = async () => {
    if (!selectedMemberId || !awardCode) return;
    setSaving(true);
    try {
      await achievements.manualAwardAchievement(selectedMemberId, awardCode, coachNote);
      setAwardOpen(false);
      setSelectedMemberId(null);
      setCoachNote('');
      setAwardToast('Awarded — live as Award of the Week.');
      setTimeout(() => setAwardToast(null), 4200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Award failed');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <Screen>
        <BackButton />
        <EmptyState
          icon="lock-closed-outline"
          title="Staff only"
          description="Achievement manager is for coaches and admins."
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={88} style={{ marginTop: spacing.lg }} />
        <Skeleton height={110} style={{ marginTop: spacing.md }} />
        <Skeleton height={110} style={{ marginTop: spacing.sm }} />
      </Screen>
    );
  }

  const filteredMembers = members.filter((m) =>
    m.full_name.toLowerCase().includes(memberQuery.trim().toLowerCase()),
  );

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
        <View style={styles.topCopy}>
          <Text style={styles.kicker}>CATALOG</Text>
          <Text style={styles.title}>ACHIEVEMENTS</Text>
        </View>
        <Pressable onPress={openCreate} style={styles.iconBtn} accessibilityLabel="Create achievement">
          <Ionicons name="add" size={20} color={colors.background} />
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <SummaryStat value={String(stats.total)} label="Total" />
        <SummaryStat value={String(stats.active)} label="Active" />
        <SummaryStat value={String(stats.manual)} label="Manual" />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => void openAward()}
          style={({ pressed }) => [styles.awardCta, pressed && styles.pressed]}>
          <LinearGradient
            colors={['rgba(200,255,0,0.14)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="ribbon-outline" size={18} color={colors.accent} />
          <View style={styles.awardCopy}>
            <Text style={styles.awardKicker}>RECOGNIZE</Text>
            <Text style={styles.awardTitle}>Award to athlete</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      {awardToast ? (
        <Pressable onPress={() => setAwardToast(null)} style={styles.toast}>
          <Ionicons name="ribbon" size={16} color={colors.background} />
          <Text style={styles.toastText}>{awardToast}</Text>
        </Pressable>
      ) : null}

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <Text style={styles.sectionHint}>Tap a card to edit · closest catalog order</Text>

      <View style={styles.list}>
        {rows.map((row) => {
          const active = row.is_active !== false;
          const tone = rarityTone(row.rarity);
          return (
            <Pressable
              key={row.id}
              onPress={() => openEdit(row)}
              style={({ pressed }) => [
                styles.card,
                !active && styles.cardOff,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.rail, { backgroundColor: tone }]} />
              <View style={styles.mark}>
                <AchievementMark
                  name={row.icon_key ?? row.code}
                  size={18}
                  color={active ? colors.accent : colors.textMuted}
                />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={[styles.rarity, { color: tone }]}>
                    {(row.rarity ?? 'common').toUpperCase()}
                  </Text>
                  <Text style={styles.cat}>{(row.category ?? 'special').toUpperCase()}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {row.title}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {row.description}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.xp}>+{row.xp_reward ?? 50} XP</Text>
                  <Text style={styles.code}>{row.code}</Text>
                  {!active ? <Text style={styles.disabledTag}>DISABLED</Text> : null}
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    onPress={() => {
                      void achievements.setAchievementActive(row.id, !active).then(load);
                    }}
                    hitSlop={8}>
                    <Text style={styles.link}>{active ? 'Disable' : 'Enable'}</Text>
                  </Pressable>
                  <Text style={styles.editHint}>EDIT</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: spacing.xxl }} />

      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <Screen>
          <View style={styles.top}>
            <BackButton onPress={() => setEditorOpen(false)} />
            <View style={styles.topCopy}>
              <Text style={styles.kicker}>{editId ? 'UPDATE' : 'NEW'}</Text>
              <Text style={styles.title}>{editId ? 'EDIT' : 'CREATE'}</Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Identity</Text>
            <AppInput label="Code" value={code} onChangeText={setCode} autoCapitalize="none" />
            <AppInput label="Title" value={title} onChangeText={setTitle} />
            <AppInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Classification</Text>
            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => {
                const on = category === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategory(c.id)}
                    style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>RARITY</Text>
            <View style={styles.chips}>
              {RARITIES.map((r) => {
                const on = rarity === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setRarity(r.id)}
                    style={[styles.chip, on && styles.chipOn, on && { borderColor: r.tone }]}>
                    <View style={[styles.rarityDot, { backgroundColor: r.tone }]} />
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Reward</Text>
            <AppInput label="XP reward" value={xp} onChangeText={setXp} keyboardType="number-pad" />
            <Text style={styles.helper}>
              Special category awards are manual. Other categories unlock automatically.
            </Text>
          </View>

          <View style={styles.formFooter}>
            <PrimaryButton
              title={saving ? 'Saving…' : editId ? 'Save changes' : 'Create achievement'}
              onPress={() => void onSave()}
              disabled={saving || !code.trim() || !title.trim()}
            />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setEditorOpen(false)} />
          </View>
        </Screen>
      </Modal>

      <Modal visible={awardOpen} animationType="slide" onRequestClose={() => setAwardOpen(false)}>
        <Screen>
          <View style={styles.top}>
            <BackButton onPress={() => setAwardOpen(false)} />
            <View style={styles.topCopy}>
              <Text style={styles.kicker}>RECOGNIZE</Text>
              <Text style={styles.title}>AWARD</Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Badge</Text>
            <Text style={styles.helper}>Manual awards become Award of the Week for the gym.</Text>
            <View style={styles.badgeGrid}>
              {manualAwards.map((a) => {
                const on = awardCode === a.code;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setAwardCode(a.code)}
                    style={[styles.badgeCard, on && styles.badgeCardOn]}>
                    <AchievementMark
                      name={a.icon_key ?? a.code}
                      size={18}
                      color={on ? colors.accent : colors.textMuted}
                    />
                    <Text style={[styles.badgeTitle, on && styles.badgeTitleOn]} numberOfLines={2}>
                      {a.title}
                    </Text>
                    <Text style={styles.badgeXp}>+{a.xp_reward ?? 250} XP</Text>
                  </Pressable>
                );
              })}
              {!manualAwards.length ? (
                <Text style={styles.helper}>No manual achievements in the catalog yet.</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Athlete</Text>
            {selectedMember ? (
              <View style={styles.selectedAthlete}>
                <Avatar
                  name={selectedMember.full_name}
                  uri={selectedMember.avatar_url}
                  size={48}
                />
                <View style={styles.selectedCopy}>
                  <Text style={styles.selectedKicker}>SELECTED</Text>
                  <Text style={styles.selectedName}>{selectedMember.full_name}</Text>
                  {selectedAward ? (
                    <Text style={styles.selectedAward} numberOfLines={1}>
                      {selectedAward.title}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              </View>
            ) : (
              <Text style={styles.helper}>Pick an athlete below.</Text>
            )}
            <AppInput label="Find athlete" value={memberQuery} onChangeText={setMemberQuery} />
            <ScrollView style={styles.memberList} nestedScrollEnabled>
              {filteredMembers.slice(0, 16).map((m) => {
                const on = selectedMemberId === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setSelectedMemberId(m.id)}
                    style={[styles.memberRow, on && styles.memberOn]}>
                    <Avatar name={m.full_name} uri={m.avatar_url} size={36} />
                    <Text style={[styles.memberName, on && styles.memberNameOn]}>{m.full_name}</Text>
                    {on ? <Ionicons name="checkmark-circle" size={18} color={colors.accent} /> : null}
                  </Pressable>
                );
              })}
              {!filteredMembers.length ? (
                <Text style={styles.helper}>No athletes match that search.</Text>
              ) : null}
            </ScrollView>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Coach note</Text>
            <AppInput
              label="Optional one-liner"
              value={coachNote}
              onChangeText={(t) => setCoachNote(t.slice(0, 120))}
              placeholder="Shown on Award of the Week"
            />
          </View>

          <View style={styles.formFooter}>
            <PrimaryButton
              title={saving ? 'Awarding…' : 'Award — make Award of the Week'}
              onPress={() => void onAward()}
              disabled={saving || !selectedMemberId || !awardCode.trim()}
            />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setAwardOpen(false)} />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  topCopy: { flex: 1, gap: 2 },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
  },
  summaryLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  actionRow: { marginBottom: spacing.lg },
  awardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  awardCopy: { flex: 1, gap: 2 },
  awardKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  awardTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  pressed: { opacity: 0.9 },
  sectionHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    minHeight: 124,
  },
  cardOff: { opacity: 0.55 },
  rail: { width: 3 },
  mark: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(200,255,0,0.04)',
  },
  cardBody: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rarity: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  cat: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  cardTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  cardDesc: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  xp: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.accent,
  },
  code: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  disabledTag: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.danger,
  },
  rowActions: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    fontFamily: fonts.sansBold,
    color: colors.accent,
    fontSize: 12,
  },
  editHint: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  formSection: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 4,
  },
  fieldLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
    marginBottom: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  chipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textMuted,
  },
  chipTextOn: { color: colors.text },
  rarityDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  helper: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  formFooter: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  memberList: {
    maxHeight: 280,
    marginTop: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  memberOn: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  memberName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  memberNameOn: { color: colors.text },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    gap: 6,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.surface,
  },
  badgeCardOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  badgeTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  badgeTitleOn: { color: colors.text },
  badgeXp: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.accent,
  },
  selectedAthlete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  selectedCopy: { flex: 1, gap: 2 },
  selectedKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  selectedName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  selectedAward: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  toastText: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.background,
  },
});
