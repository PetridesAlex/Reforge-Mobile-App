import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppInput } from '@/components/ui/AppInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { WodMovementEditor } from '@/components/workouts/WodMovementEditor';
import { WodPrescriptionList } from '@/components/workouts/WodPrescriptionList';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { workoutImageForDay } from '@/constants/media';
import {
  defaultWodMovements,
  normalizeMovements,
  type WodMovement,
} from '@/lib/workouts/wod';
import * as adminService from '@/services/admin';
import type { Profile } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type RsvpTab = 'joined' | 'skipped' | 'pending';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AdminWodScreen() {
  const { profile } = useAuth();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const publishDate = typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : undefined;
  const [wod, setWod] = useState<adminService.WodAdminView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rsvpTab, setRsvpTab] = useState<RsvpTab>('joined');

  const [title, setTitle] = useState('Engine & Iron');
  const [focus, setFocus] = useState('Full body · Conditioning');
  const [description, setDescription] = useState(
    'Studio session for everyone — coach-led on the floor.',
  );
  const [duration, setDuration] = useState('45');
  const [level, setLevel] = useState('All levels');
  const [location, setLocation] = useState('Studio Floor');
  const [startTime, setStartTime] = useState('18:00');
  const [movements, setMovements] = useState<WodMovement[]>(() => defaultWodMovements());

  const openCompose = () => {
    if (wod) {
      setTitle(wod.title);
      setFocus(wod.focus);
      setDescription(wod.description);
      setDuration(String(wod.duration_min));
      setLevel(wod.level);
      setLocation(wod.location);
      setStartTime(wod.start_time);
      setMovements(normalizeMovements(wod.movements, wod.moves));
    } else {
      setTitle('Engine & Iron');
      setFocus('Full body · Conditioning');
      setDescription('Studio session for everyone — coach-led on the floor.');
      setDuration('45');
      setLevel('All levels');
      setLocation('Studio Floor');
      setStartTime('18:00');
      setMovements(defaultWodMovements());
    }
    setFormError(null);
    setComposeOpen(true);
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      setWod(await adminService.getActiveWorkoutOfTheDay());
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

  useEffect(() => {
    if (publishDate) setComposeOpen(true);
  }, [publishDate]);

  const publish = async () => {
    if (!profile) return;
    setFormError(null);
    setSaving(true);
    try {
      const next = await adminService.publishWorkoutOfTheDay({
        title,
        focus,
        description,
        durationMin: Number(duration) || 45,
        level,
        location,
        startTime,
        movements,
        authorId: profile.id,
        date: publishDate,
      });
      setWod(next);
      setComposeOpen(false);
      setRsvpTab('joined');
      setToast(
        publishDate
          ? `Published for ${publishDate} — athletes see it on their calendar`
          : 'Live on every member Home',
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not publish');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!wod) return;
    await adminService.deactivateWorkoutOfTheDay(wod.id);
    setToast('Removed from member Home');
    await load();
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={160} style={{ marginTop: spacing.md }} />
        <Skeleton height={56} style={{ marginTop: spacing.md }} />
        <Skeleton height={220} style={{ marginTop: spacing.md }} />
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

  const rsvpPeople =
    rsvpTab === 'joined' ? wod?.joined ?? [] : rsvpTab === 'skipped' ? wod?.skipped ?? [] : wod?.pending ?? [];
  const rsvpEmpty =
    rsvpTab === 'joined'
      ? 'Nobody has joined yet'
      : rsvpTab === 'skipped'
        ? 'No skips yet'
        : 'Everyone responded';

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
      {/* Hero header */}
      <View style={styles.heroHeader}>
        <LinearGradient
          colors={['rgba(200,255,0,0.1)', 'transparent', 'rgba(200,255,0,0.04)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.heroHeaderGlow}
        />
        <View style={styles.heroHeaderTop}>
          <BackButton compact />
          {wod ? (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE ON HOME</Text>
            </View>
          ) : (
            <View style={styles.idlePill}>
              <Text style={styles.idleText}>NOT PUBLISHED</Text>
            </View>
          )}
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="flash-outline" size={24} color={colors.accent} />
        </View>
        <Text style={styles.heroKicker}>STUDIO FLOOR</Text>
        <Text style={styles.heroTitle}>Workout of the day</Text>
        <Text style={styles.heroSub}>
          {publishDate
            ? `Publishing for ${publishDate} — appears on athlete training calendars and Home.`
            : 'One shared session for every member — publish once, track joins and skips on Home.'}
        </Text>
      </View>

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      {/* Quick actions */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={openCompose}
          style={({ pressed }) => [styles.publishBtnOuter, pressed && styles.pressed]}>
          <LinearGradient
            colors={[colors.accent, '#A8E600']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.publishBtn}>
            <Ionicons name={wod ? 'refresh' : 'rocket-outline'} size={18} color={colors.background} />
            <Text style={styles.publishBtnText}>{wod ? 'Replace workout' : 'Publish workout'}</Text>
          </LinearGradient>
        </Pressable>
        {wod ? (
          <Pressable
            onPress={deactivate}
            style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
            <Ionicons name="eye-off-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.secondaryActionText}>Take down</Text>
          </Pressable>
        ) : null}
      </View>

      {!wod ? (
        <View style={styles.emptyCard}>
          <LinearGradient
            colors={['rgba(200,255,0,0.06)', 'transparent']}
            style={styles.emptyGlow}
          />
          <View style={styles.emptyIcon}>
            <Ionicons name="barbell-outline" size={28} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>No workout live</Text>
          <Text style={styles.emptyBody}>
            Members will see Join / Skip on their Home screen as soon as you publish.
          </Text>
          <View style={styles.steps}>
            {[
              { n: '1', label: 'Publish', desc: 'Set title, time & movements' },
              { n: '2', label: 'Members see it', desc: 'Shows on every Home feed' },
              { n: '3', label: 'Track RSVPs', desc: 'Joined, skipped & waiting' },
            ].map((step) => (
              <View key={step.n} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.n}</Text>
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepLabel}>{step.label}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <>
          {/* Hero */}
          <View style={styles.hero}>
            <MediaImage
              uri={workoutImageForDay(wod.title)}
              style={styles.heroImage}
              rounded={radius.xl}
            />
            <LinearGradient
              colors={['transparent', 'rgba(10,10,10,0.55)', 'rgba(10,10,10,0.96)']}
              locations={[0.15, 0.55, 1]}
              style={styles.heroFade}
            />
            <View style={styles.heroContent}>
              <View style={styles.heroBadges}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{wod.date}</Text>
                </View>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>{wod.level}</Text>
                </View>
              </View>
              <Text style={styles.wodHeroTitle}>{wod.title}</Text>
              <Text style={styles.heroFocus}>{wod.focus}</Text>
              <View style={styles.metaRow}>
                <MetaChip label={wod.start_time} />
                <MetaChip label={`${wod.duration_min} min`} />
                <MetaChip label={wod.location} />
              </View>
            </View>
          </View>

          {/* Response KPIs */}
          <Text style={styles.sectionKicker}>MEMBER RESPONSES</Text>
          <View style={styles.statsRow}>
            <StatTile
              value={wod.joinedCount}
              label="Joined"
              active={rsvpTab === 'joined'}
              tone="ok"
              onPress={() => setRsvpTab('joined')}
            />
            <StatTile
              value={wod.skippedCount}
              label="Skipped"
              active={rsvpTab === 'skipped'}
              tone="danger"
              onPress={() => setRsvpTab('skipped')}
            />
            <StatTile
              value={wod.pendingCount}
              label="Waiting"
              active={rsvpTab === 'pending'}
              tone="muted"
              onPress={() => setRsvpTab('pending')}
            />
          </View>

          {/* Detail */}
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>SESSION</Text>
            <Text style={styles.body}>{wod.description}</Text>

            <Text style={[styles.panelLabel, styles.movesHeading]}>MOVEMENTS</Text>
            <WodPrescriptionList
              movements={normalizeMovements(wod.movements, wod.moves)}
              variant="admin"
            />
          </View>

          {/* RSVP */}
          <View style={styles.rsvpHeader}>
            <Text style={styles.rsvpTitle}>
              {rsvpTab === 'joined' ? 'Joined' : rsvpTab === 'skipped' ? 'Skipped' : 'Waiting'}
            </Text>
            <Text style={styles.rsvpCount}>{rsvpPeople.length}</Text>
          </View>
          <RsvpList people={rsvpPeople} empty={rsvpEmpty} tone={rsvpTab} />
        </>
      )}

      <Modal visible={composeOpen} animationType="slide" transparent>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              <Text style={styles.sheetKicker}>PUBLISH</Text>
              <Text style={styles.sheetTitle}>Workout of the day</Text>
              <Text style={styles.sheetHint}>Members see this on Home and can Join or Skip</Text>
              <AppInput label="Title" value={title} onChangeText={setTitle} />
              <AppInput label="Focus" value={focus} onChangeText={setFocus} />
              <AppInput label="Description" value={description} onChangeText={setDescription} />
              <View style={styles.row}>
                <View style={styles.half}>
                  <AppInput label="Start time" value={startTime} onChangeText={setStartTime} />
                </View>
                <View style={styles.half}>
                  <AppInput
                    label="Minutes"
                    value={duration}
                    onChangeText={setDuration}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <AppInput label="Location" value={location} onChangeText={setLocation} />
                </View>
                <View style={styles.half}>
                  <AppInput label="Level" value={level} onChangeText={setLevel} />
                </View>
              </View>
              <WodMovementEditor movements={movements} onChange={setMovements} />
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              <PrimaryButton
                title={saving ? 'Publishing…' : 'Publish to members'}
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

function MetaChip({ label }: { label: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

function StatTile({
  value,
  label,
  active,
  tone,
  onPress,
}: {
  value: number;
  label: string;
  active: boolean;
  tone: 'ok' | 'danger' | 'muted';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.stat,
        active && styles.statActive,
        pressed && styles.pressed,
      ]}>
      <Text
        style={[
          styles.statValue,
          tone === 'ok' && styles.statOk,
          tone === 'danger' && styles.statDanger,
          tone === 'muted' && styles.statMuted,
        ]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, active && styles.statLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function RsvpList({
  people,
  empty,
  tone,
}: {
  people: Profile[];
  empty: string;
  tone: RsvpTab;
}) {
  if (people.length === 0) {
    return (
      <View style={styles.rsvpEmpty}>
        <Text style={styles.emptyRsvp}>{empty}</Text>
      </View>
    );
  }
  return (
    <View style={styles.rsvpList}>
      {people.map((p) => (
        <View key={p.id} style={styles.rsvpRow}>
          <View
            style={[
              styles.rsvpAvatar,
              tone === 'joined' && styles.rsvpAvatarJoined,
              tone === 'skipped' && styles.rsvpAvatarSkipped,
            ]}>
            <Text style={styles.rsvpInitials}>{initials(p.full_name)}</Text>
          </View>
          <View style={styles.rsvpCopy}>
            <Text style={styles.rsvpName}>{p.full_name}</Text>
            <Text style={styles.rsvpMeta}>{p.email}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
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
    maxWidth: 360,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    fontFamily: fonts.sansSemiBold,
    color: colors.success,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  idlePill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  idleText: {
    fontFamily: fonts.sansSemiBold,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  toastText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  publishBtnOuter: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 15,
    paddingHorizontal: spacing.md,
  },
  publishBtnText: {
    fontFamily: fonts.sansBold,
    color: colors.background,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryActionText: {
    fontFamily: fonts.sansSemiBold,
    color: colors.textSecondary,
    fontSize: 14,
  },
  pressed: { opacity: 0.88 },
  emptyCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.16)',
    backgroundColor: colors.surface,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  emptyGlow: { ...StyleSheet.absoluteFillObject },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  steps: { gap: spacing.sm },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.3)',
  },
  stepBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
  },
  stepCopy: { flex: 1, gap: 2 },
  stepLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  stepDesc: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  sectionKicker: {
    ...typography.sectionKicker,
    fontSize: 10,
    marginBottom: spacing.sm,
  },
  hero: {
    height: 240,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroFade: { ...StyleSheet.absoluteFillObject },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
    gap: 6,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: 4,
  },
  dateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(200,255,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  dateBadgeText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 10,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  levelBadgeText: {
    ...typography.label,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
  },
  wodHeroTitle: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 0.8,
  },
  heroFocus: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  metaChipText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  statActive: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: colors.accentMuted,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.6,
  },
  statOk: { color: colors.accent },
  statDanger: { color: colors.danger },
  statMuted: { color: colors.textSecondary },
  statLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  statLabelActive: { color: colors.accent },
  panel: {
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  panelLabel: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 1.4,
    fontSize: 10,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  movesHeading: { marginTop: spacing.sm },
  movesList: { gap: spacing.sm },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  moveIndex: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveIndexText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 11,
  },
  moveText: {
    ...typography.body,
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  rsvpHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rsvpTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 17,
  },
  rsvpCount: {
    ...typography.label,
    color: colors.accent,
    fontSize: 13,
  },
  rsvpEmpty: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  emptyRsvp: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  rsvpList: { gap: spacing.sm, marginBottom: spacing.lg },
  rsvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rsvpAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  rsvpAvatarJoined: { backgroundColor: colors.accentMuted },
  rsvpAvatarSkipped: { backgroundColor: 'rgba(255,77,77,0.12)' },
  rsvpInitials: { ...typography.label, color: colors.textSecondary },
  rsvpCopy: { flex: 1, gap: 2 },
  rsvpName: { ...typography.subtitle, color: colors.text, fontSize: 15 },
  rsvpMeta: { ...typography.caption, color: colors.textMuted },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#101010',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetScroll: { gap: spacing.xs, paddingBottom: spacing.xl },
  sheetKicker: {
    ...typography.label,
    color: colors.accent,
    letterSpacing: 1.6,
    fontSize: 10,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sheetHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  movesInput: { minHeight: 110, textAlignVertical: 'top' },
  formError: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
});
