import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppInput } from '@/components/ui/AppInput';
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

const CATEGORIES = ['training', 'performance', 'consistency', 'challenges', 'special'] as const;
const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

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
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

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
    setAwardCode(rows.find((r) => r.award_mode === 'manual')?.code ?? 'coachs_choice');
    try {
      const all = await adminService.listMembers();
      setMembers(all.map((m) => ({ id: m.member.id, full_name: m.member.full_name })));
    } catch {
      try {
        if (!profile) throw new Error('no profile');
        const { getClients } = await import('@/services/coach');
        const clients = await getClients(profile.id, { studioWide: role === 'admin' });
        setMembers(clients.map((c) => ({ id: c.member.id, full_name: c.member.full_name })));
      } catch {
        setMembers([]);
      }
    }
  };

  const onAward = async () => {
    if (!selectedMemberId || !awardCode) return;
    setSaving(true);
    try {
      await achievements.manualAwardAchievement(selectedMemberId, awardCode);
      setAwardOpen(false);
      setSelectedMemberId(null);
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
        <EmptyState icon="lock-closed-outline" title="Staff only" description="Achievement manager is for coaches and admins." />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <Skeleton height={120} />
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
        <Text style={styles.title}>ACHIEVEMENTS</Text>
        <Pressable onPress={openCreate} style={styles.iconBtn}>
          <Ionicons name="add" size={18} color={colors.background} />
        </Pressable>
      </View>
      <PrimaryButton title="Award to athlete" onPress={() => void openAward()} />
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <View style={styles.list}>
        {rows.map((row) => (
          <View key={row.id} style={[styles.card, row.is_active === false && styles.cardOff]}>
            <View style={styles.cardTop}>
              <Text style={styles.rarity}>{(row.rarity ?? 'common').toUpperCase()}</Text>
              <Text style={styles.cat}>{row.category}</Text>
            </View>
            <Text style={styles.cardTitle}>{row.title}</Text>
            <Text style={styles.cardDesc}>{row.description}</Text>
            <Text style={styles.xp}>+{row.xp_reward ?? 50} XP · {row.code}</Text>
            <View style={styles.rowActions}>
              <Pressable
                onPress={() =>
                  void achievements.setAchievementActive(row.id, row.is_active === false).then(load)
                }>
                <Text style={styles.link}>{row.is_active === false ? 'Enable' : 'Disable'}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <Screen>
          <View style={styles.top}>
            <BackButton onPress={() => setEditorOpen(false)} />
            <Text style={styles.title}>CREATE</Text>
          </View>
          <AppInput label="Code" value={code} onChangeText={setCode} autoCapitalize="none" />
          <AppInput label="Title" value={title} onChangeText={setTitle} />
          <AppInput label="Description" value={description} onChangeText={setDescription} multiline />
          <Text style={styles.label}>CATEGORY</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipOn]}>
                <Text style={styles.chipText}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>RARITY</Text>
          <View style={styles.chips}>
            {RARITIES.map((r) => (
              <Pressable key={r} onPress={() => setRarity(r)} style={[styles.chip, rarity === r && styles.chipOn]}>
                <Text style={styles.chipText}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <AppInput label="XP reward" value={xp} onChangeText={setXp} keyboardType="number-pad" />
          <PrimaryButton title={saving ? 'Saving…' : 'Save'} onPress={() => void onSave()} disabled={saving || !code || !title} />
          <PrimaryButton title="Cancel" variant="ghost" onPress={() => setEditorOpen(false)} />
        </Screen>
      </Modal>

      <Modal visible={awardOpen} animationType="slide" onRequestClose={() => setAwardOpen(false)}>
        <Screen>
          <View style={styles.top}>
            <BackButton onPress={() => setAwardOpen(false)} />
            <Text style={styles.title}>AWARD</Text>
          </View>
          <AppInput label="Achievement code" value={awardCode} onChangeText={setAwardCode} autoCapitalize="none" />
          <AppInput label="Find athlete" value={memberQuery} onChangeText={setMemberQuery} />
          {filteredMembers.slice(0, 12).map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setSelectedMemberId(m.id)}
              style={[styles.memberRow, selectedMemberId === m.id && styles.memberOn]}>
              <Text style={styles.memberName}>{m.full_name}</Text>
            </Pressable>
          ))}
          <PrimaryButton
            title={saving ? 'Awarding…' : 'Award achievement'}
            onPress={() => void onAward()}
            disabled={saving || !selectedMemberId || !awardCode}
          />
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.sm, marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, flex: 1 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: 10, marginTop: spacing.md },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: 6,
  },
  cardOff: { opacity: 0.5 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rarity: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.2, color: colors.accent },
  cat: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text },
  cardDesc: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  xp: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  rowActions: { marginTop: 4 },
  link: { fontFamily: fonts.sansBold, color: colors.accent, fontSize: 12 },
  label: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.2, color: colors.textSecondary, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: colors.border },
  chipOn: { borderColor: colors.accent, backgroundColor: 'rgba(200,255,0,0.12)' },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.text },
  memberRow: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  memberOn: { borderColor: colors.accent },
  memberName: { fontFamily: fonts.sansSemiBold, color: colors.text },
});
