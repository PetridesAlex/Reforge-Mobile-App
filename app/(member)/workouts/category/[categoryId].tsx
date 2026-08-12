import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useStudioSync } from '@/hooks/useStudioSync';
import {
  CATEGORY_COACHING_TIPS,
  CATEGORY_QUICK_ACTIONS,
  getWorkoutCategory,
  isWorkoutCategoryId,
} from '@/lib/workouts/categories';
import { formatTime } from '@/lib/utils/dates';
import * as memberService from '@/services/member';
import type { WorkoutCategoryContent } from '@/services/member';
import type { MuscleGroup } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type MuscleFilter = MuscleGroup | 'All';

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <View style={[styles.statTile, accent && styles.statTileAccent]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InlineEmpty({
  icon,
  title,
  description,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
}) {
  return (
    <View style={styles.inlineEmpty}>
      <View style={styles.inlineEmptyIcon}>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
      </View>
      <View style={styles.inlineEmptyCopy}>
        <Text style={styles.inlineEmptyTitle}>{title}</Text>
        <Text style={styles.inlineEmptyDesc}>{description}</Text>
      </View>
    </View>
  );
}

export default function WorkoutCategoryScreen() {
  const { categoryId: rawCategoryId } = useLocalSearchParams<{ categoryId: string }>();
  const categoryId = rawCategoryId && isWorkoutCategoryId(rawCategoryId) ? rawCategoryId : null;
  const config = categoryId ? getWorkoutCategory(categoryId) : null;
  const { profile } = useAuth();
  const [content, setContent] = useState<WorkoutCategoryContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [joiningClassId, setJoiningClassId] = useState<string | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<MuscleFilter>('All');

  const load = useCallback(async () => {
    if (!profile || !categoryId) return;
    try {
      setError(null);
      setContent(await memberService.getWorkoutCategoryContent(profile.id, categoryId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [profile, categoryId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  useStudioSync(load);

  const filteredExercises = useMemo(() => {
    if (!content) return [];
    if (muscleFilter === 'All') return content.exercises;
    return content.exercises.filter((e) => e.muscle_group === muscleFilter);
  }, [content, muscleFilter]);

  const onJoinClass = async (classId: string) => {
    if (!profile) return;
    setJoiningClassId(classId);
    try {
      await memberService.joinClass(classId, profile.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join class');
    } finally {
      setJoiningClassId(null);
    }
  };

  const onLeaveClass = async (classId: string) => {
    if (!profile) return;
    setJoiningClassId(classId);
    try {
      await memberService.leaveClass(classId, profile.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave class');
    } finally {
      setJoiningClassId(null);
    }
  };

  if (!categoryId || !config) {
    return (
      <Screen>
        <ErrorState message="Category not found" onRetry={() => router.back()} />
      </Screen>
    );
  }

  if (loading && !content) {
    return (
      <Screen scrollable={false}>
        <Skeleton height={240} style={{ marginTop: spacing.md }} />
        <Skeleton height={72} style={{ marginTop: spacing.lg }} />
        <Skeleton height={120} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error && !content) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  const data = content!;
  const totalItems =
    data.exercises.length + data.programDays.length + data.wods.length + data.classes.length;
  const isEmpty = totalItems === 0;
  const tips = CATEGORY_COACHING_TIPS[categoryId];
  const actions = CATEGORY_QUICK_ACTIONS[categoryId];
  const muscleGroups = config.muscleGroups;

  return (
    <Screen scrollable={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: config.tint }]}>
          <LinearGradient
            colors={['rgba(200,255,0,0.14)', 'transparent', 'rgba(0,0,0,0.5)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.heroGlow}
          />
          <MediaImage uri={config.image} style={styles.heroImage} rounded={0} overlay />

          <View style={styles.heroTop}>
            <BackButton compact />
            <View style={styles.heroPill}>
              <Ionicons name="layers-outline" size={11} color={colors.accent} />
              <Text style={styles.heroPillText}>TRAINING CATEGORY</Text>
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{config.label.toUpperCase()}</Text>
            <Text style={styles.heroSubtitle}>{config.subtitle}</Text>
            {data.programName ? (
              <Text style={styles.heroProgram}>Program · {data.programName}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatTile label="Moves" value={data.exercises.length} accent={data.exercises.length > 0} />
          <StatTile label="Program" value={data.programDays.length} />
          <StatTile label="WODs" value={data.wods.length} />
          {categoryId === 'class' ? (
            <StatTile label="Classes" value={data.classes.length} accent />
          ) : null}
        </View>

        {categoryId !== 'class' && muscleGroups.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>
            <Pressable
              onPress={() => setMuscleFilter('All')}
              style={[styles.chip, muscleFilter === 'All' && styles.chipActive]}>
              <Text style={[styles.chipText, muscleFilter === 'All' && styles.chipTextActive]}>
                All
              </Text>
            </Pressable>
            {muscleGroups.map((group) => (
              <Pressable
                key={group}
                onPress={() => setMuscleFilter(group)}
                style={[styles.chip, muscleFilter === group && styles.chipActive]}>
                <Text style={[styles.chipText, muscleFilter === group && styles.chipTextActive]}>
                  {group}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.quickActions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => router.push(action.route as never)}
              style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
              <Ionicons
                name={action.icon as React.ComponentProps<typeof Ionicons>['name']}
                size={16}
                color={colors.accent}
              />
              <Text style={styles.quickActionText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}

        {categoryId === 'class' ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>STUDIO SCHEDULE</Text>
            <Text style={styles.sectionTitle}>Upcoming classes</Text>
            {data.classes.length === 0 ? (
              <InlineEmpty
                icon="calendar-outline"
                title="No classes on the calendar"
                description="Book a group session and your class roster chat unlocks automatically."
              />
            ) : (
              data.classes.map((gymClass) => {
                const spotsLeft = Math.max(0, gymClass.capacity - (gymClass.enrolled_count ?? 0));
                const busy = joiningClassId === gymClass.id;
                return (
                  <View key={gymClass.id} style={styles.classCard}>
                    <View style={styles.cardRail} />
                    <View style={styles.sessionCopy}>
                      <Text style={styles.sessionTitle}>{gymClass.title}</Text>
                      <Text style={styles.sessionMeta}>
                        {format(parseISO(gymClass.starts_at), 'EEE d MMM')} ·{' '}
                        {formatTime(gymClass.starts_at)} · {gymClass.location}
                      </Text>
                      <Text style={styles.sessionHint}>
                        {gymClass.enrolled_count ?? 0}/{gymClass.capacity} athletes ·{' '}
                        {gymClass.joined ? 'You’re in' : `${spotsLeft} spots left`}
                      </Text>
                    </View>
                    <PrimaryButton
                      title={
                        gymClass.joined
                          ? busy
                            ? '…'
                            : 'Leave'
                          : busy
                            ? 'Joining…'
                            : spotsLeft
                              ? 'Join class'
                              : 'Full'
                      }
                      variant={gymClass.joined ? 'ghost' : 'secondary'}
                      disabled={busy || (!gymClass.joined && spotsLeft === 0)}
                      onPress={() =>
                        gymClass.joined ? onLeaveClass(gymClass.id) : onJoinClass(gymClass.id)
                      }
                    />
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionKicker}>YOUR PROGRAM</Text>
              <Text style={styles.sectionTitle}>Assigned training days</Text>
              {data.programDays.length === 0 ? (
                <InlineEmpty
                  icon="barbell-outline"
                  title="No program days in this category"
                  description={
                    data.programName
                      ? `Your coach will tag ${config.label.toLowerCase()} work inside ${data.programName}.`
                      : 'Once your coach assigns a program, matching days appear here.'
                  }
                />
              ) : (
                data.programDays.map((day) => (
                  <Pressable
                    key={day.id}
                    onPress={() => router.push(`/(member)/workouts/${day.id}`)}
                    style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}>
                    <View style={styles.cardRail} />
                    <MediaImage
                      uri={config.image}
                      style={styles.sessionThumb}
                      rounded={radius.md}
                      overlay
                    />
                    <View style={styles.sessionCopy}>
                      <Text style={styles.sessionTitle}>{day.name}</Text>
                      <Text style={styles.sessionMeta}>
                        {day.exercises.length} exercises ·{' '}
                        <Text style={styles.statusText}>{day.status}</Text>
                      </Text>
                    </View>
                    <View style={styles.startPill}>
                      <Text style={styles.startPillText}>Open</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                    </View>
                  </Pressable>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionKicker}>STUDIO FLOOR</Text>
              <Text style={styles.sectionTitle}>Coach-published WODs</Text>
              {data.wods.length === 0 ? (
                <InlineEmpty
                  icon="flash-outline"
                  title="No matching WODs this month"
                  description="When your coach publishes strength work on the calendar, it surfaces here."
                />
              ) : (
                data.wods.map((wod) => (
                  <Pressable
                    key={wod.id}
                    onPress={() => router.push(`/(member)/workouts/wod/${wod.id}`)}
                    style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}>
                    <View style={[styles.cardRail, styles.cardRailWod]} />
                    <View style={styles.wodIcon}>
                      <Ionicons name="flash" size={18} color={colors.accent} />
                    </View>
                    <View style={styles.sessionCopy}>
                      <Text style={styles.sessionTitle}>{wod.title}</Text>
                      <Text style={styles.sessionMeta}>
                        {format(parseISO(wod.date), 'EEE d MMM')}
                        {wod.startTime ? ` · ${wod.startTime}` : ''}
                      </Text>
                      {wod.focus ? <Text style={styles.sessionHint}>{wod.focus}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionKicker}>EXERCISE LIBRARY</Text>
                  <Text style={styles.sectionTitle}>Coach-prescribed moves</Text>
                </View>
                {data.libraryExercises.length > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{data.libraryExercises.length} in library</Text>
                  </View>
                ) : null}
              </View>

              {filteredExercises.length === 0 ? (
                <InlineEmpty
                  icon="library-outline"
                  title={
                    muscleFilter === 'All'
                      ? 'Library building up'
                      : `No ${muscleFilter} exercises yet`
                  }
                  description={
                    muscleFilter === 'All'
                      ? 'Your coach adds custom exercises to the studio library. Moves from your program also appear here.'
                      : `Try “All” or check back — your coach may add ${muscleFilter.toLowerCase()} work soon.`
                  }
                />
              ) : (
                filteredExercises.map((exercise) => {
                  const expanded = expandedExerciseId === exercise.id;
                  const fromProgram = !data.libraryExercises.some((e) => e.id === exercise.id);
                  return (
                    <Pressable
                      key={exercise.id}
                      onPress={() =>
                        setExpandedExerciseId((current) =>
                          current === exercise.id ? null : exercise.id,
                        )
                      }
                      style={({ pressed }) => [styles.exerciseCard, pressed && styles.pressed]}>
                      <MediaImage
                        uri={exercise.image_url}
                        style={styles.exerciseThumb}
                        rounded={radius.md}
                      />
                      <View style={styles.exerciseCopy}>
                        <View style={styles.exerciseTitleRow}>
                          <Text style={styles.exerciseName}>{exercise.name}</Text>
                          {fromProgram ? (
                            <View style={styles.sourcePill}>
                              <Text style={styles.sourcePillText}>Program</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.exerciseMeta}>
                          {exercise.muscle_group}
                          {exercise.equipment ? ` · ${exercise.equipment}` : ''}
                        </Text>
                        {expanded && exercise.instructions ? (
                          <Text style={styles.exerciseInstructions}>{exercise.instructions}</Text>
                        ) : null}
                        {expanded && exercise.description ? (
                          <Text style={styles.exerciseHint}>{exercise.description}</Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  );
                })
              )}
            </View>
          </>
        )}

        {isEmpty ? (
          <View style={styles.coachingPanel}>
            <LinearGradient
              colors={['rgba(200,255,0,0.1)', 'rgba(200,255,0,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.coachingGlow}
            />
            <View style={styles.coachingHeader}>
              <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
              <Text style={styles.coachingKicker}>COACHING GUIDE</Text>
            </View>
            <Text style={styles.coachingTitle}>
              Your {config.label.toLowerCase()} hub is ready
            </Text>
            <Text style={styles.coachingBody}>
              Content appears here as your coach assigns programs, publishes WODs, and adds exercises
              to the studio library. Use the shortcuts above while your plan is being built.
            </Text>
            {tips.map((tip) => (
              <View key={tip} style={styles.tipRow}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
            <PrimaryButton
              title="Return to training hub"
              variant="secondary"
              onPress={() => router.push('/(member)/workouts')}
              style={styles.coachingCta}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  hero: {
    minHeight: 240,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    zIndex: 2,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  heroPillText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xxl,
    zIndex: 2,
    gap: spacing.xs,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 44,
    color: colors.text,
    letterSpacing: 1.2,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    maxWidth: 340,
  },
  heroProgram: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statTileAccent: {
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
  },
  statValueAccent: {
    color: colors.accent,
  },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  chipRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accent,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surfaceElevated,
  },
  quickActionText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.text,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.3)',
  },
  countBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.accent,
  },
  inlineEmpty: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  inlineEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  inlineEmptyCopy: {
    flex: 1,
    gap: 4,
  },
  inlineEmptyTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  inlineEmptyDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sessionCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingLeft: spacing.md + 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRail: {
    position: 'absolute',
    left: 0,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  cardRailWod: {
    backgroundColor: '#F59E0B',
  },
  sessionThumb: {
    width: 52,
    height: 52,
  },
  wodIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  sessionCopy: {
    flex: 1,
    gap: 3,
  },
  sessionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  sessionMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statusText: {
    color: colors.accent,
    textTransform: 'capitalize',
  },
  sessionHint: {
    ...typography.caption,
    color: colors.accent,
  },
  startPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
  },
  startPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.accent,
  },
  classCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    paddingLeft: spacing.md + 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseThumb: {
    width: 56,
    height: 56,
  },
  exerciseCopy: {
    flex: 1,
    gap: 2,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  exerciseName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  sourcePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourcePillText: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  exerciseMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  exerciseInstructions: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  exerciseHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  coachingPanel: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  coachingGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  coachingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coachingKicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  coachingTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 18,
    color: colors.text,
  },
  coachingBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: 2,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    ...typography.caption,
    color: colors.text,
    lineHeight: 19,
  },
  coachingCta: {
    marginTop: spacing.sm,
  },
  inlineError: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.88,
  },
});
