import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { PLACEHOLDER_IMAGES, workoutImageForDay } from '@/constants/media';
import * as adminService from '@/services/admin';
import type { StudioSettings } from '@/services/mock/data';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_FILTER = ['All', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const KPI_ITEMS = [
  { key: 'open', label: 'Open days', icon: 'calendar-outline' as const },
  { key: 'scheduled', label: 'With workouts', icon: 'barbell-outline' as const },
  { key: 'sessions', label: 'Sessions', icon: 'flash-outline' as const },
] as const;

export default function AdminScheduleScreen() {
  const [rows, setRows] = useState<adminService.ScheduleDay[]>([]);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [schedule, studio] = await Promise.all([
        adminService.listTrainingSchedule(),
        adminService.getStudioSettings(),
      ]);
      setRows(schedule);
      setSettings(studio);
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

  const byDay = useMemo(() => {
    const map = new Map<number | 'unscheduled', adminService.ScheduleDay[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    map.set('unscheduled', []);
    for (const row of rows) {
      if (row.day_of_week == null) map.get('unscheduled')!.push(row);
      else map.get(row.day_of_week)!.push(row);
    }
    return map;
  }, [rows]);

  const scheduledDays = useMemo(
    () => [0, 1, 2, 3, 4, 5, 6].filter((d) => (byDay.get(d)?.length ?? 0) > 0).length,
    [byDay],
  );
  const openDays = settings?.workingDays.length ?? 0;
  const workoutCount = rows.filter((r) => r.day_of_week != null).length;
  const kpiValues = {
    open: openDays,
    scheduled: scheduledDays,
    sessions: workoutCount,
  } as const;

  const toggleWorkingDay = async (day: number) => {
    if (!settings) return;
    const next = settings.workingDays.includes(day)
      ? settings.workingDays.filter((d) => d !== day)
      : [...settings.workingDays, day].sort((a, b) => a - b);
    setSettings(await adminService.setWorkingDays(next));
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={180} style={{ marginTop: spacing.md }} />
        <Skeleton height={88} style={{ marginTop: spacing.md }} />
        <Skeleton height={200} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error && !settings) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  const daysToShow =
    selected == null ? ([0, 1, 2, 3, 4, 5, 6] as const) : ([selected] as const);

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
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}>
        <View style={styles.backPill}>
          <Ionicons name="chevron-back" size={16} color={colors.accent} />
          <Text style={styles.backText}>Studio</Text>
        </View>
      </Pressable>

      <View style={styles.hero}>
        <MediaImage uri={PLACEHOLDER_IMAGES.studio} style={styles.heroImage} rounded={radius.xl} />
        <LinearGradient
          colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.55)', 'rgba(10,10,10,0.96)']}
          style={styles.heroFade}
        />
        <LinearGradient
          colors={['rgba(200,255,0,0.12)', 'rgba(200,255,0,0.03)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroAccent}
        />
        <View style={styles.heroCopy}>
          <View style={styles.heroKickerRow}>
            <Ionicons name="grid-outline" size={12} color={colors.accent} />
            <Text style={styles.kicker}>OPERATIONS</Text>
          </View>
          <Text style={styles.title}>Week plan</Text>
          <Text style={styles.heroSub}>
            {settings?.name ?? 'REFORGE'} Limassol · open days, training slots & programs
          </Text>
        </View>
      </View>

      <View style={styles.kpiRow}>
        {KPI_ITEMS.map((item, index) => (
          <View key={item.key} style={[styles.kpiCard, index === 0 && styles.kpiCardFeatured]}>
            {index === 0 ? (
              <LinearGradient
                colors={['rgba(200,255,0,0.1)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.kpiGlow}
              />
            ) : null}
            <View style={[styles.kpiIconWrap, index === 0 && styles.kpiIconWrapFeatured]}>
              <Ionicons
                name={item.icon}
                size={14}
                color={index === 0 ? colors.accent : colors.textSecondary}
              />
            </View>
            <AnimatedCount
              value={kpiValues[item.key]}
              style={[styles.kpiValue, index === 0 && styles.kpiValueFeatured]}
              duration={800}
            />
            <Text style={styles.kpiLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {settings ? (
        <View style={styles.hoursCard}>
          <LinearGradient
            colors={['rgba(200,255,0,0.06)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.hoursGlow}
          />
          <View style={styles.hoursTop}>
            <View style={styles.hoursIconWrap}>
              <Ionicons name="time-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.hoursCopy}>
              <Text style={styles.hoursEyebrow}>OPERATING HOURS</Text>
              <Text style={styles.hoursTime}>
                {settings.openTime} – {settings.closeTime}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(coach)/admin/settings')}
              hitSlop={8}
              style={({ pressed }) => [styles.hoursEditBtn, pressed && styles.pressed]}>
              <Text style={styles.hoursEdit}>Edit</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </Pressable>
          </View>
          <Text style={styles.hoursHint}>Tap a day to open or close the studio</Text>
          <View style={styles.weekPanel}>
            <View style={styles.weekRow}>
              {WEEK_SHORT.map((label, idx) => {
                const on = settings.workingDays.includes(idx);
                return (
                  <Pressable
                    key={`${label}-${idx}`}
                    onPress={() => void toggleWorkingDay(idx)}
                    style={[styles.weekChip, on && styles.weekChipOn]}>
                    <Text style={[styles.weekChipText, on && styles.weekChipTextOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <Pressable
          onPress={() => router.push('/(coach)/programs')}
          style={({ pressed }) => [styles.toolTile, styles.toolTileAccent, pressed && styles.pressed]}>
          <LinearGradient
            colors={['rgba(200,255,0,0.14)', 'rgba(200,255,0,0.03)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.toolTileGlow}
          />
          <View style={styles.toolIconWrap}>
            <Ionicons name="barbell-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.toolCopy}>
            <Text style={styles.toolTitle}>Edit workouts</Text>
            <Text style={styles.toolMeta}>Programs & exercises</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/(coach)/admin/classes')}
          style={({ pressed }) => [styles.toolTile, pressed && styles.pressed]}>
          <View style={[styles.toolIconWrap, styles.toolIconWrapMuted]}>
            <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
          </View>
          <View style={styles.toolCopy}>
            <Text style={styles.toolTitleMuted}>Classes</Text>
            <Text style={styles.toolMeta}>Group & private</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.filterPanel}>
        <View style={styles.filterHead}>
          <Text style={styles.sectionEyebrow}>VIEW BY DAY</Text>
          <Text style={styles.filterHint}>
            {selected == null ? 'All weekdays' : WEEKDAYS[selected]}
          </Text>
        </View>
        <View style={styles.filterRow}>
          {WEEK_FILTER.map((label, idx) => {
            const value = idx === 0 ? null : idx - 1;
            const on = selected === value;
            return (
              <Pressable
                key={label}
                onPress={() => setSelected(value)}
                style={[styles.filterChip, on && styles.filterChipOn]}>
                <Text style={[styles.filterText, on && styles.filterTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {daysToShow.map((day) => {
        const items = byDay.get(day) ?? [];
        const working = settings?.workingDays.includes(day) ?? false;
        const hasWorkouts = items.length > 0;
        return (
          <View
            key={day}
            style={[
              styles.dayCard,
              working && styles.dayCardOpen,
              hasWorkouts && styles.dayCardActive,
            ]}>
            {hasWorkouts ? (
              <LinearGradient
                colors={['rgba(200,255,0,0.06)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dayCardGlow}
              />
            ) : null}
            <View
              style={[
                styles.dayRail,
                working && styles.dayRailOpen,
                hasWorkouts && styles.dayRailActive,
              ]}
            />
            <View style={styles.dayHead}>
              <View style={styles.dayHeadLeft}>
                <View style={[styles.dayBadgeLetter, working && styles.dayBadgeLetterOpen]}>
                  <Text style={[styles.dayBadgeLetterText, working && styles.dayBadgeLetterTextOn]}>
                    {WEEK_SHORT[day]}
                  </Text>
                </View>
                <View style={styles.dayHeadCopy}>
                  <Text style={styles.dayTitle}>{WEEKDAYS[day]}</Text>
                  <Text style={styles.daySub}>
                    {items.length === 0
                      ? 'Rest / no program day'
                      : `${items.length} workout${items.length === 1 ? '' : 's'} scheduled`}
                  </Text>
                </View>
              </View>
              <View style={[styles.dayStatusPill, working ? styles.dayOpen : styles.dayClosed]}>
                <View style={[styles.dayDot, working && styles.dayDotOn]} />
                <Text style={[styles.dayBadgeText, working && styles.dayBadgeTextOn]}>
                  {working ? 'OPEN' : 'CLOSED'}
                </Text>
              </View>
            </View>

            {items.length === 0 ? (
              <View style={[styles.emptyDay, !working && styles.emptyDayClosed]}>
                <Ionicons
                  name={working ? 'barbell-outline' : 'moon-outline'}
                  size={22}
                  color={working ? colors.accent : colors.textMuted}
                />
                <Text style={styles.emptyTitle}>
                  {working ? 'No workout assigned' : 'Studio closed'}
                </Text>
                <Text style={styles.emptyMeta}>
                  {working
                    ? 'Add a training day to a program for this weekday'
                    : 'Members won’t see floor hours today'}
                </Text>
                {working ? (
                  <Pressable
                    onPress={() => router.push('/(coach)/programs')}
                    style={({ pressed }) => [styles.emptyLinkBtn, pressed && styles.pressed]}>
                    <Text style={styles.emptyLink}>Open week plan</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.accent} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.workoutList}>
                {items.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/(coach)/programs/${item.program_id}`)}
                    style={({ pressed }) => [styles.workoutCard, pressed && styles.pressed]}>
                    <LinearGradient
                      colors={['rgba(200,255,0,0.07)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.workoutGlow}
                    />
                    <MediaImage
                      uri={workoutImageForDay(item.name)}
                      style={styles.workoutThumb}
                      rounded={radius.md}
                    />
                    <View style={styles.workoutCopy}>
                      <Text style={styles.workoutName}>{item.name}</Text>
                      <View style={styles.workoutMetaPill}>
                        <Ionicons name="layers-outline" size={11} color={colors.accent} />
                        <Text style={styles.workoutMeta}>
                          {item.programName} · {item.exerciseCount} exercises
                        </Text>
                      </View>
                    </View>
                    <View style={styles.workoutChevron}>
                      <Ionicons name="create-outline" size={16} color={colors.accent} />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {(byDay.get('unscheduled')?.length ?? 0) > 0 && selected == null ? (
        <View style={styles.unscheduled}>
          <View style={styles.unscheduledHead}>
            <Ionicons name="alert-circle-outline" size={18} color="#FACC15" />
            <View style={styles.unscheduledHeadCopy}>
              <Text style={styles.sectionEyebrow}>NEEDS WEEKDAY</Text>
              <Text style={styles.unscheduledTitle}>Unassigned sessions</Text>
            </View>
          </View>
          <Text style={styles.unscheduledSub}>
            These training days have no weekday yet — tap to assign
          </Text>
          {byDay.get('unscheduled')!.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/(coach)/programs/${item.program_id}`)}
              style={({ pressed }) => [styles.workoutCard, styles.workoutCardWarn, pressed && styles.pressed]}>
              <LinearGradient
                colors={['rgba(250,204,21,0.1)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.workoutGlow}
              />
              <MediaImage
                uri={workoutImageForDay(item.name)}
                style={styles.workoutThumb}
                rounded={radius.md}
              />
              <View style={styles.workoutCopy}>
                <Text style={styles.workoutName}>{item.name}</Text>
                <Text style={styles.workoutMeta}>{item.programName}</Text>
                <Text style={styles.workoutLink}>Set weekday →</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No training days yet"
          description="Build a program week to populate this schedule."
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  backText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  hero: {
    position: 'relative',
    height: 180,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: '#101410',
  },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroFade: { ...StyleSheet.absoluteFillObject },
  heroAccent: { ...StyleSheet.absoluteFillObject },
  heroCopy: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
    gap: 6,
  },
  heroKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.72)',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kpiCard: {
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
    minHeight: 96,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: 4,
    justifyContent: 'flex-end',
  },
  kpiCardFeatured: {
    backgroundColor: '#121812',
    borderColor: 'rgba(200,255,0,0.22)',
  },
  kpiGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  kpiIconWrap: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  kpiIconWrapFeatured: {
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  kpiValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.8,
    color: colors.text,
  },
  kpiValueFeatured: {
    color: colors.accent,
  },
  kpiLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  hoursCard: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#101410',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    gap: spacing.sm,
  },
  hoursGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  hoursTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hoursIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
  },
  hoursCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  hoursEyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  hoursTime: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: 1.2,
    color: colors.text,
  },
  hoursEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  hoursEdit: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accent,
  },
  hoursHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  weekPanel: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekChip: {
    flex: 1,
    minWidth: 36,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  weekChipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  weekChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  weekChipTextOn: {
    color: '#0A0A0A',
  },
  toolbar: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  toolTile: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  toolTileAccent: {
    borderColor: 'rgba(200,255,0,0.24)',
    backgroundColor: '#121812',
  },
  toolTileGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  toolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  toolIconWrapMuted: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toolCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  toolTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 0.8,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  toolTitleMuted: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  toolMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  filterPanel: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  filterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  filterHint: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filterChipOn: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: colors.accentMuted,
  },
  filterText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textMuted,
  },
  filterTextOn: {
    color: colors.accent,
    fontFamily: fonts.sansSemiBold,
  },
  dayCard: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.md,
    padding: spacing.md,
    paddingLeft: spacing.md + 6,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#101410',
    gap: spacing.sm,
  },
  dayCardOpen: {
    borderColor: 'rgba(200,255,0,0.16)',
  },
  dayCardActive: {
    borderColor: 'rgba(200,255,0,0.28)',
  },
  dayCardGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  dayRail: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 3,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dayRailOpen: {
    backgroundColor: 'rgba(200,255,0,0.35)',
  },
  dayRailActive: {
    backgroundColor: colors.accent,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dayHeadLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  dayBadgeLetter: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayBadgeLetterOpen: {
    backgroundColor: colors.accentMuted,
    borderColor: 'rgba(200,255,0,0.3)',
  },
  dayBadgeLetterText: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  dayBadgeLetterTextOn: {
    color: colors.accent,
  },
  dayHeadCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  dayTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  daySub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  dayStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  dayOpen: {
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: colors.accentMuted,
  },
  dayClosed: {
    opacity: 0.85,
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  dayDotOn: {
    backgroundColor: colors.accent,
  },
  dayBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  dayBadgeTextOn: {
    color: colors.accent,
  },
  emptyDay: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.16)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(200,255,0,0.04)',
  },
  emptyDayClosed: {
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    opacity: 0.9,
  },
  emptyTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
  },
  emptyMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  emptyLink: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accent,
  },
  workoutList: {
    gap: spacing.sm,
  },
  workoutCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    alignItems: 'center',
  },
  workoutCardWarn: {
    borderColor: 'rgba(250,204,21,0.28)',
    backgroundColor: 'rgba(250,204,21,0.04)',
  },
  workoutGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  workoutThumb: {
    width: 68,
    height: 68,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  workoutCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  workoutName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: -0.2,
  },
  workoutMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
  },
  workoutMeta: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  workoutChevron: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  workoutLink: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: '#FACC15',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.9,
  },
  unscheduled: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.22)',
    backgroundColor: '#141210',
    gap: spacing.sm,
  },
  unscheduledHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unscheduledHeadCopy: {
    flex: 1,
    gap: 2,
  },
  unscheduledTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  unscheduledSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});
