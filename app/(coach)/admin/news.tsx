import { router } from 'expo-router';
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

import { AppInput } from '@/components/ui/AppInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import {
  newsAudienceLabel,
  newsAudienceOptions,
  resolveNewsAudienceMemberIds,
  type NewsAudience,
} from '@/lib/news/audience';
import { formatDateLabel } from '@/lib/utils/dates';
import * as adminService from '@/services/admin';
import type { StudioNews } from '@/services/mock/data';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

export default function AdminNewsScreen() {
  const { profile } = useAuth();
  const audienceOptions = useMemo(() => newsAudienceOptions(), []);
  const [rows, setRows] = useState<StudioNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<NewsAudience>('all');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selectedAudience = audienceOptions.find((o) => o.id === audience);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await adminService.listNews());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCompose = () => {
    setFormError(null);
    setAudience('all');
    setComposeOpen(true);
  };

  const publish = async () => {
    if (!profile) return;
    setFormError(null);
    setSaving(true);
    try {
      await adminService.publishNews({ title, body, authorId: profile.id, audience });
      const count = resolveNewsAudienceMemberIds(audience).length;
      setTitle('');
      setBody('');
      setComposeOpen(false);
      setToast(`Sent to ${count} member${count === 1 ? '' : 's'} · ${newsAudienceLabel(audience)}`);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not post');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await adminService.deleteNews(id);
    setToast('Update removed');
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

  if (error) {
    return (
      <Screen>
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
            load();
          }}
          tintColor={colors.accent}
        />
      }>
      <BackButton label="Studio" style={styles.back} />

      <View style={styles.hero}>
        <LinearGradient
          colors={['rgba(200,255,0,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGlow}
        />
        <Text style={styles.heroKicker}>Broadcast</Text>
        <Text style={styles.heroTitle}>Studio news</Text>
        <Text style={styles.heroSub}>
          Target a class group, private clients, or everyone — members get a notification and see it on Home.
        </Text>
      </View>

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      <PrimaryButton title="Write update" onPress={openCompose} style={styles.cta} />

      <SectionHeader title="Published" kicker="Feed" />

      {rows.length === 0 ? (
        <EmptyState title="No news yet" description="Post your first studio update." />
      ) : (
        <View style={styles.list}>
          {rows.map((item, index) => (
            <View key={item.id} style={[styles.card, index === 0 && styles.cardFeatured]}>
              <View style={styles.cardRail} />
              <View style={styles.cardInner}>
                <View style={styles.cardTop}>
                  <View style={styles.audiencePill}>
                    <Text style={styles.audiencePillText}>
                      {newsAudienceLabel(item.audience ?? 'all').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.cardDate}>{formatDateLabel(item.created_at)}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody} numberOfLines={4}>
                  {item.body}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardMeta}>
                    {resolveNewsAudienceMemberIds(item.audience ?? 'all').length} notified ·{' '}
                    {item.published ? 'Live' : 'Draft'}
                  </Text>
                  <Pressable
                    onPress={() => remove(item.id)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <Modal visible={composeOpen} animationType="slide" transparent onRequestClose={() => setComposeOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetKicker}>NEW UPDATE</Text>
            <Text style={styles.sheetTitle}>Who should see this?</Text>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={styles.audienceGrid}>
                {audienceOptions.map((option) => {
                  const selected = audience === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setAudience(option.id)}
                      style={({ pressed }) => [
                        styles.audienceTile,
                        selected && styles.audienceTileSelected,
                        pressed && styles.pressed,
                      ]}>
                      {selected ? (
                        <LinearGradient
                          colors={['rgba(200,255,0,0.12)', 'rgba(200,255,0,0.03)']}
                          style={styles.audienceTileGlow}
                        />
                      ) : null}
                      <Text style={[styles.audienceLabel, selected && styles.audienceLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={styles.audienceDesc}>{option.description}</Text>
                      <Text style={styles.audienceCount}>
                        {option.memberCount} member{option.memberCount === 1 ? '' : 's'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <AppInput
                label="Title"
                value={title}
                onChangeText={setTitle}
                placeholder="Week 4 focus"
              />
              <AppInput
                label="Message"
                value={body}
                onChangeText={setBody}
                placeholder="What should members know?"
                multiline
                style={styles.bodyInput}
              />

              {selectedAudience ? (
                <View style={styles.sendPreview}>
                  <Ionicons name="notifications-outline" size={16} color={colors.accent} />
                  <Text style={styles.sendPreviewText}>
                    Sends to {selectedAudience.memberCount} member
                    {selectedAudience.memberCount === 1 ? '' : 's'} · {selectedAudience.label}
                  </Text>
                </View>
              ) : null}

              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

              <PrimaryButton
                title={saving ? 'Sending…' : 'Publish & notify'}
                onPress={publish}
                disabled={saving}
              />
              <PrimaryButton title="Cancel" variant="ghost" onPress={() => setComposeOpen(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.sm },
  hero: {
    position: 'relative',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
  },
  heroKicker: {
    ...typography.sectionKicker,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: 1.5,
    color: colors.text,
    textTransform: 'uppercase',
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    maxWidth: 360,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
  },
  toastText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    flex: 1,
  },
  cta: { marginBottom: spacing.xl },
  list: { gap: spacing.sm, marginBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  cardFeatured: {
    backgroundColor: '#121812',
  },
  cardRail: {
    width: 3,
    backgroundColor: colors.accent,
  },
  cardInner: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  audiencePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
  },
  audiencePillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  cardDate: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  cardBody: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  cardMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  removeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  removeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.danger,
  },
  pressed: { opacity: 0.88 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#0C0C0C',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetKicker: {
    ...typography.sectionKicker,
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  audienceGrid: {
    gap: spacing.sm,
  },
  audienceTile: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: 4,
  },
  audienceTileSelected: {
    backgroundColor: '#141a10',
  },
  audienceTileGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  audienceLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  audienceLabelSelected: {
    color: colors.accent,
  },
  audienceDesc: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  audienceCount: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  bodyInput: { minHeight: 110, textAlignVertical: 'top' },
  sendPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
  },
  sendPreviewText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    flex: 1,
  },
  formError: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
  },
});
