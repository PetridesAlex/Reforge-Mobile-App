import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { communityPathsFor, type CommunitySurface } from '@/lib/community/paths';
import * as community from '@/services/community';
import type { Profile } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  surface: CommunitySurface;
};

export function CommunityPeopleTab({ surface }: Props) {
  const paths = communityPathsFor(surface);
  const { profile, role } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const rows =
        surface === 'coach'
          ? await community.getCoachMessageRoster(profile.id, role)
          : await community.listStudioCommunityMembers(profile.id);
      setMembers(rows.filter((m) => m.id !== profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [profile, role, surface]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.username ?? '').toLowerCase().includes(q),
    );
  }, [members, query]);

  const openMessage = async (peer: Profile) => {
    if (!profile) return;
    setMessagingId(peer.id);
    try {
      const thread =
        surface === 'coach'
          ? await community.createCoachAthleteChat(profile.id, peer.id, role)
          : await community.createPrivateChat(profile.id, peer.id);
      router.push(`${paths.messages}/${thread.id}` as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open chat');
    } finally {
      setMessagingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search athletes…"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!filtered.length ? (
        <EmptyState
          icon="people-outline"
          title="No members found"
          description={
            query.trim()
              ? 'Try a different name.'
              : 'Studio athletes will appear here once they’re on the roster.'
          }
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((m) => {
            const busy = messagingId === m.id;
            return (
              <View key={m.id} style={styles.row}>
                <LinearGradient
                  colors={['rgba(200,255,0,0.06)', 'transparent']}
                  style={StyleSheet.absoluteFillObject}
                />
                <Pressable
                  onPress={() => router.push(paths.profile(m.id) as never)}
                  style={styles.identity}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${m.full_name} profile`}>
                  <Avatar name={m.full_name} uri={m.avatar_url} size={48} />
                  <View style={styles.copy}>
                    <Text style={styles.name} numberOfLines={1}>
                      {m.full_name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {m.username ? `@${m.username}` : m.role === 'member' ? 'Athlete' : m.role}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void openMessage(m)}
                    disabled={busy}
                    style={({ pressed }) => [styles.msgBtn, pressed && styles.pressed]}
                    accessibilityLabel={`Message ${m.full_name}`}>
                    {busy ? (
                      <ActivityIndicator color={colors.background} size="small" />
                    ) : (
                      <Ionicons name="chatbubble" size={16} color={colors.background} />
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(paths.profile(m.id) as never)}
                    style={({ pressed }) => [styles.profileBtn, pressed && styles.pressed]}
                    accessibilityLabel={`View ${m.full_name}`}>
                    <Text style={styles.profileBtnText}>PROFILE</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.surfaceElevated,
  },
  search: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
  },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  msgBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  profileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  profileBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  pressed: { opacity: 0.88 },
});
