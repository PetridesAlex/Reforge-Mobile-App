import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, parseISO, addDays } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { PerformanceBuildProfile } from '@/components/performance/PerformanceBuildProfile';
import { AppInput } from '@/components/ui/AppInput';
import { Avatar } from '@/components/ui/Avatar';
import { MembershipBillingPanel } from '@/components/billing/MembershipBillingPanel';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { labelForPrimaryGoal, labelForTrainingLevel, TRAINING_INTEREST_OPTIONS } from '@/lib/onboarding/types';
import { canManageMemberships, canManageStudio } from '@/lib/permissions';
import { useSupabaseProgress } from '@/lib/progress/config';
import { formatTime, relativeTime } from '@/lib/utils/dates';
import { genderIcon, genderLabel, genderTone } from '@/lib/utils/gender';
import { formatPrescription, parsePrescription } from '@/lib/workouts/prescription';
import * as adminService from '@/services/admin';
import * as coachService from '@/services/coach';
import { ABSENCE_SCOPE_LABELS } from '@/services/absences';
import * as memberService from '@/services/member';
import * as progressSupabase from '@/services/progress.supabase';
import { createWorkoutFeedback } from '@/services/coaching.supabase';
import * as workoutsSupabase from '@/services/workouts.supabase';
import type { MembershipPayment } from '@/services/mock/data';
import type { MemberAbsence, Profile, Program, UserRole, WorkoutSession } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type Tab = 'overview' | 'program' | 'progress' | 'sessions' | 'notes' | 'billing';

type ClientDetail = NonNullable<Awaited<ReturnType<typeof coachService.getClientDetail>>>;

const TAB_CONFIG: Record<
  Tab,
  { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  overview: { label: 'Overview', icon: 'grid-outline' },
  billing: { label: 'Billing', icon: 'card-outline' },
  program: { label: 'Program', icon: 'barbell-outline' },
  progress: { label: 'Progress', icon: 'trending-up-outline' },
  sessions: { label: 'Sessions', icon: 'calendar-outline' },
  notes: { label: 'Notes', icon: 'document-text-outline' },
};

function staffRoleLabel(role: UserRole) {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'coach':
      return 'Coach';
    default:
      return 'Staff';
  }
}

function sessionStatusStyle(status: string) {
  switch (status) {
    case 'confirmed':
      return { bg: 'rgba(74,222,128,0.12)', text: colors.success, border: 'rgba(74,222,128,0.35)' };
    case 'pending':
      return { bg: 'rgba(250,204,21,0.12)', text: '#FACC15', border: 'rgba(250,204,21,0.35)' };
    case 'cancelled':
      return { bg: 'rgba(255,77,77,0.12)', text: colors.danger, border: 'rgba(255,77,77,0.35)' };
    default:
      return { bg: colors.surfaceElevated, text: colors.textMuted, border: colors.border };
  }
}

export default function ClientDetailScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { profile } = useAuth();
  const isAdmin = canManageStudio(profile?.role);
  const canBilling = canManageMemberships(profile?.role);
  const supabaseProgress = useSupabaseProgress();
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<ClientDetail | null>(null);
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [assignedCoachId, setAssignedCoachId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<adminService.MembershipRow | null>(null);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [memberAbsences, setMemberAbsences] = useState<MemberAbsence[]>([]);
  const [rosterActive, setRosterActive] = useState(true);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [athletePerformance, setAthletePerformance] = useState<{
    weeklyWorkouts: number;
    monthlyWorkouts: number;
    weightKg: number | null;
    bodyFatPct: number | null;
    performance: {
      onboardingComplete: boolean;
      profileCompletionPct: number;
      weeklyGoal: number;
      streak: number;
    };
  } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const detail = await coachService.getClientDetail(id);
      setData(detail);
      try {
        const sessions = await workoutsSupabase.listRecentSessions(id, 8);
        setRecentSessions(sessions.filter((s) => s.status === 'completed'));
        setFeedbackSessionId(sessions.find((s) => s.status === 'completed')?.id ?? null);
      } catch {
        setRecentSessions([]);
      }
      try {
        const from = format(new Date(), 'yyyy-MM-dd');
        const to = format(addDays(new Date(), 60), 'yyyy-MM-dd');
        setMemberAbsences(await memberService.getMemberAbsences(id, from, to));
      } catch {
        setMemberAbsences([]);
      }
      if (isAdmin) {
        const [staff, programList, members, membership] = await Promise.all([
          adminService.listCoaches(),
          adminService.listPrograms(),
          adminService.listMembers(),
          adminService.getMembershipForMember(id).catch(() => null),
        ]);
        setCoaches(staff);
        setPrograms(programList);
        const row = members.find((m) => m.member.id === id);
        setAssignedCoachId(row?.coach?.id ?? null);
        setRosterActive(row?.active !== false);
        setBilling(membership);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    if (supabaseProgress) {
      progressSupabase
        .getPerformanceStats(id)
        .then((perf) => {
          setAthletePerformance({
            weeklyWorkouts: perf.weeklyWorkouts,
            monthlyWorkouts: perf.monthlyWorkouts,
            weightKg: perf.weightKg,
            bodyFatPct: perf.bodyFatPct,
            performance: {
              onboardingComplete: perf.onboardingComplete,
              profileCompletionPct: perf.profileCompletionPct,
              weeklyGoal: perf.weeklyGoal,
              streak: perf.streak,
            },
          });
        })
        .catch(() => setAthletePerformance(null));
      return;
    }
    setAthletePerformance({
      weeklyWorkouts: data?.workoutsThisWeek ?? 0,
      monthlyWorkouts: data?.sessions.filter((s) => s.status === 'completed').length ?? 0,
      weightKg: data?.latestWeight?.weight_kg ?? null,
      bodyFatPct: data?.latestWeight?.body_fat_pct ?? null,
      performance: {
        onboardingComplete: Boolean(data?.latestWeight),
        profileCompletionPct: data?.latestWeight ? 80 : 35,
        weeklyGoal: 4,
        streak: 3,
      },
    });
  }, [id, data, supabaseProgress]);

  const loadBilling = useCallback(async () => {
    if (!id || !canBilling) return;
    setBillingLoading(true);
    try {
      const [membership, history] = await Promise.all([
        adminService.getMembershipForMember(id),
        adminService.getMembershipPaymentHistory(id),
      ]);
      setBilling(membership);
      setPayments(history);
    } catch {
      setBilling(null);
      setPayments([]);
    } finally {
      setBillingLoading(false);
    }
  }, [id, canBilling]);

  useEffect(() => {
    if (tab === 'billing') loadBilling();
  }, [tab, loadBilling]);

  useEffect(() => {
    if (canBilling) void loadBilling();
  }, [canBilling, loadBilling]);

  const addNote = async () => {
    if (!profile || !id || !note.trim()) return;
    await coachService.addCoachNote(profile.id, id, note.trim());
    setNote('');
    setToast('Note saved');
    load();
  };

  const tabs = useMemo<Tab[]>(
    () =>
      canBilling
        ? ['overview', 'billing', 'program', 'progress', 'sessions', 'notes']
        : ['overview', 'program', 'progress', 'sessions', 'notes'],
    [canBilling],
  );

  useEffect(() => {
    if (!tabParam) return;
    const next = tabParam as Tab;
    if (tabs.includes(next)) setTab(next);
  }, [tabParam, tabs]);

  const genderVisuals = useMemo(
    () => (data ? genderTone(data.member.gender) : genderTone(null)),
    [data],
  );

  const completedSessions = useMemo(
    () => data?.sessions.filter((s) => s.status === 'completed').length ?? 0,
    [data],
  );

  if (loading) {
    return (
      <Screen>
        <Skeleton height={160} style={{ marginTop: spacing.md }} />
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={200} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <ErrorState message={error ?? 'Client not found'} onRetry={load} />
      </Screen>
    );
  }

  const assignedCoach = coaches.find((c) => c.id === assignedCoachId);
  const onBilling = Boolean(
    billing &&
      (billing.membership.notes?.includes('Started with REFORGE') ||
        billing.membership.status === 'paid' ||
        billing.membership.last_paid_at),
  );

  return (
    <Screen>
      <BackButton label="Roster" style={styles.back} />

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}

      {/* Profile hero */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[genderVisuals.bg, 'transparent', `${genderVisuals.text}08`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGlow}
        />
        <View style={styles.heroRow}>
          <View style={[styles.avatarRing, { borderColor: genderVisuals.border }]}>
            <Avatar name={data.member.full_name} uri={data.member.avatar_url} size={72} />
            <View style={[styles.genderBadge, { backgroundColor: genderVisuals.pillBg, borderColor: genderVisuals.border }]}>
              <Ionicons name={genderIcon(data.member.gender)} size={11} color={genderVisuals.text} />
            </View>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroName}>{data.member.full_name}</Text>
            <View style={[styles.genderPill, { backgroundColor: genderVisuals.pillBg, borderColor: genderVisuals.border }]}>
              <Ionicons name={genderIcon(data.member.gender)} size={12} color={genderVisuals.text} />
              <Text style={[styles.genderPillText, { color: genderVisuals.text }]}>
                {genderLabel(data.member.gender)}
              </Text>
            </View>
            <Text style={styles.heroEmail}>{data.member.email}</Text>
            {data.member.phone ? <Text style={styles.heroPhone}>{data.member.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.heroChips}>
          {data.program ? (
            <View style={styles.heroChip}>
              <Ionicons name="barbell-outline" size={12} color={colors.accent} />
              <Text style={styles.heroChipText}>{data.program.name}</Text>
            </View>
          ) : null}
          {assignedCoach ? (
            <View style={styles.heroChip}>
              <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.heroChipText}>{assignedCoach.full_name}</Text>
            </View>
          ) : null}
          {canBilling && onBilling ? (
            <View style={[styles.heroChip, styles.heroChipBilling]}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={[styles.heroChipText, styles.heroChipBillingText]}>
                Billing · {billing?.membership.status}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        {tabs.map((t) => {
          const active = tab === t;
          const cfg = TAB_CONFIG[t];
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, active && styles.tabActive]}>
              {active ? (
                <LinearGradient
                  colors={['rgba(200,255,0,0.14)', 'rgba(200,255,0,0.04)']}
                  style={styles.tabGlow}
                />
              ) : null}
              <Ionicons name={cfg.icon} size={15} color={active ? colors.accent : colors.textMuted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{cfg.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'overview' ? (
        <>
          <View style={styles.kpiGrid}>
            <KpiTile
              featured
              kicker="Body"
              label="Weight"
              icon="scale-outline"
              value={data.latestWeight?.weight_kg ?? null}
              suffix=" kg"
              decimals={1}
              emptyLabel="—"
            />
            <KpiTile
              kicker="Activity"
              label="This week"
              icon="barbell-outline"
              value={data.workoutsThisWeek}
              suffix=""
            />
            <KpiTile
              kicker="Training"
              label="Completed"
              icon="checkmark-done-outline"
              value={completedSessions}
              suffix=""
            />
            <KpiTile
              kicker="Program"
              label="Assigned"
              icon="fitness-outline"
              textValue={data.program?.name ?? 'None'}
            />
          </View>

          <View style={styles.highlightCard}>
            <LinearGradient
              colors={['rgba(200,255,0,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.highlightGlow}
            />
            <Text style={styles.highlightKicker}>GOAL</Text>
            <Text style={styles.highlightTitle}>
              {labelForPrimaryGoal(data.member.primary_goal) !== 'Athlete'
                ? labelForPrimaryGoal(data.member.primary_goal)
                : data.goal}
            </Text>
            <View style={styles.highlightDivider} />
            <View style={styles.profileMetaGrid}>
              {data.member.training_level ? (
                <View style={styles.profileMetaItem}>
                  <Text style={styles.profileMetaLabel}>Level</Text>
                  <Text style={styles.profileMetaValue}>
                    {labelForTrainingLevel(data.member.training_level)}
                  </Text>
                </View>
              ) : null}
              {data.member.training_days_per_week ? (
                <View style={styles.profileMetaItem}>
                  <Text style={styles.profileMetaLabel}>Frequency</Text>
                  <Text style={styles.profileMetaValue}>
                    {data.member.training_days_per_week} days / week
                  </Text>
                </View>
              ) : null}
              {data.member.date_of_birth ? (
                <View style={styles.profileMetaItem}>
                  <Text style={styles.profileMetaLabel}>Age</Text>
                  <Text style={styles.profileMetaValue}>
                    {Math.max(
                      0,
                      new Date().getFullYear() -
                        Number(String(data.member.date_of_birth).slice(0, 4)),
                    )}
                  </Text>
                </View>
              ) : null}
              {data.member.created_at ? (
                <View style={styles.profileMetaItem}>
                  <Text style={styles.profileMetaLabel}>Joined</Text>
                  <Text style={styles.profileMetaValue}>
                    {format(parseISO(data.member.created_at), 'MMM yyyy')}
                  </Text>
                </View>
              ) : null}
            </View>
            {data.member.training_interests?.length ? (
              <>
                <View style={styles.highlightDivider} />
                <Text style={styles.profileMetaLabel}>Interests</Text>
                <Text style={styles.profileMetaValue}>
                  {data.member.training_interests
                    .map(
                      (id) =>
                        TRAINING_INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id,
                    )
                    .join(' · ')}
                </Text>
              </>
            ) : null}
            {data.member.preferred_workout_time ||
            data.member.preferred_workout_duration ||
            data.member.motivation_type ? (
              <>
                <View style={styles.highlightDivider} />
                <Text style={styles.profileMetaLabel}>Preferences</Text>
                <Text style={styles.profileMetaValue}>
                  {[
                    data.member.preferred_workout_time,
                    data.member.preferred_workout_duration
                      ? `${data.member.preferred_workout_duration} min`
                      : null,
                    data.member.motivation_type,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </>
            ) : null}
            <View style={styles.highlightDivider} />
            <View style={styles.highlightRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.accent} />
              <View style={styles.highlightCopy}>
                <Text style={styles.highlightLabel}>Next session</Text>
                <Text style={styles.highlightValue}>
                  {data.nextSession
                    ? `${format(parseISO(data.nextSession.starts_at), 'EEE d MMM')} · ${formatTime(data.nextSession.starts_at)}`
                    : 'None booked'}
                </Text>
              </View>
            </View>
          </View>

          {memberAbsences.length > 0 ? (
            <View style={styles.absenceSection}>
              <Text style={styles.sectionKicker}>AVAILABILITY</Text>
              <Text style={styles.sectionTitle}>Reported absences</Text>
              {memberAbsences.map((a) => (
                <View key={a.id} style={styles.absenceRow}>
                  <View style={styles.absenceIcon}>
                    <Ionicons name="calendar-clear-outline" size={16} color={colors.danger} />
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
                </View>
              ))}
            </View>
          ) : null}

          {isAdmin ? (
            <View style={styles.adminSection}>
              <Text style={styles.sectionKicker}>STUDIO CONTROLS</Text>
              <Text style={styles.sectionTitle}>Assign & manage</Text>

              <StudioControlCard
                kicker="Primary coach"
                title="Coach assignment"
                icon="person-outline"
                assigned={Boolean(assignedCoach)}>
                <View style={styles.assignHero}>
                  {assignedCoach ? (
                    <>
                      <View style={styles.assignHeroAvatar}>
                        <Avatar name={assignedCoach.full_name} uri={assignedCoach.avatar_url} size={52} />
                        <View style={styles.assignCheck}>
                          <Ionicons name="checkmark" size={12} color={colors.background} />
                        </View>
                      </View>
                      <View style={styles.assignHeroCopy}>
                        <Text style={styles.assignHeroName}>{assignedCoach.full_name}</Text>
                        <Text style={styles.assignHeroMeta}>{assignedCoach.email}</Text>
                        <View style={styles.assignStatusPill}>
                          <View style={styles.assignStatusDot} />
                          <Text style={styles.assignStatusText}>Assigned coach</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.assignEmptyIcon}>
                        <Ionicons name="person-add-outline" size={22} color={colors.textMuted} />
                      </View>
                      <View style={styles.assignHeroCopy}>
                        <Text style={styles.assignHeroName}>No coach assigned</Text>
                        <Text style={styles.assignHeroMeta}>Select a trainer below to link this member.</Text>
                        <View style={[styles.assignStatusPill, styles.assignStatusPillMuted]}>
                          <View style={[styles.assignStatusDot, styles.assignStatusDotMuted]} />
                          <Text style={[styles.assignStatusText, styles.assignStatusTextMuted]}>Unassigned</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>

                <Text style={styles.assignPickerLabel}>Available coaches</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.assignPickerRow}>
                  {coaches.map((c) => {
                    const active = assignedCoachId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={async () => {
                          if (!id) return;
                          await adminService.assignCoach(id, c.id);
                          setAssignedCoachId(c.id);
                          setToast(`Coach set to ${c.full_name}`);
                          load();
                        }}
                        style={({ pressed }) => [
                          styles.assignOption,
                          active && styles.assignOptionActive,
                          pressed && styles.pressed,
                        ]}>
                        {active ? (
                          <LinearGradient
                            colors={['rgba(200,255,0,0.16)', 'rgba(200,255,0,0.04)']}
                            style={styles.assignOptionGlow}
                          />
                        ) : null}
                        <Avatar name={c.full_name} uri={c.avatar_url} size={40} />
                        <View style={styles.assignOptionCopy}>
                          <Text style={[styles.assignOptionName, active && styles.assignOptionNameActive]} numberOfLines={1}>
                            {c.full_name}
                          </Text>
                          <Text style={styles.assignOptionRole}>{staffRoleLabel(c.role)}</Text>
                        </View>
                        {active ? (
                          <View style={styles.assignOptionBadge}>
                            <Ionicons name="checkmark" size={12} color={colors.background} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </StudioControlCard>

              <StudioControlCard
                kicker="Training plan"
                title="Program assignment"
                icon="barbell-outline"
                assigned={Boolean(data.program)}>
                <View style={styles.assignHero}>
                  {data.program ? (
                    <>
                      <View style={[styles.assignEmptyIcon, styles.programIconActive]}>
                        <Ionicons name="fitness-outline" size={22} color={colors.accent} />
                      </View>
                      <View style={styles.assignHeroCopy}>
                        <Text style={styles.assignHeroName}>{data.program.name}</Text>
                        <Text style={styles.assignHeroMeta}>
                          {data.program.duration_weeks} week plan · {data.days.length} training days
                        </Text>
                        <View style={styles.assignStatusPill}>
                          <View style={styles.assignStatusDot} />
                          <Text style={styles.assignStatusText}>Active program</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.assignEmptyIcon}>
                        <Ionicons name="barbell-outline" size={22} color={colors.textMuted} />
                      </View>
                      <View style={styles.assignHeroCopy}>
                        <Text style={styles.assignHeroName}>No program assigned</Text>
                        <Text style={styles.assignHeroMeta}>Choose a plan below to unlock workouts.</Text>
                        <View style={[styles.assignStatusPill, styles.assignStatusPillMuted]}>
                          <View style={[styles.assignStatusDot, styles.assignStatusDotMuted]} />
                          <Text style={[styles.assignStatusText, styles.assignStatusTextMuted]}>Not set</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>

                <Text style={styles.assignPickerLabel}>Available programs</Text>
                <View style={styles.programPickerGrid}>
                  {programs.map((p) => {
                    const active = data.program?.id === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={async () => {
                          if (!id) return;
                          await adminService.assignMemberProgram(id, p.id);
                          setToast(`Program set to ${p.name}`);
                          load();
                        }}
                        style={({ pressed }) => [
                          styles.programOption,
                          active && styles.programOptionActive,
                          pressed && styles.pressed,
                        ]}>
                        {active ? (
                          <LinearGradient
                            colors={['rgba(200,255,0,0.14)', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.assignOptionGlow}
                          />
                        ) : null}
                        <View style={styles.programOptionTop}>
                          <Ionicons name="barbell-outline" size={16} color={active ? colors.accent : colors.textMuted} />
                          {active ? (
                            <View style={styles.assignOptionBadge}>
                              <Ionicons name="checkmark" size={12} color={colors.background} />
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.programOptionName, active && styles.assignOptionNameActive]} numberOfLines={2}>
                          {p.name}
                        </Text>
                        <Text style={styles.programOptionMeta}>{p.duration_weeks} weeks</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </StudioControlCard>

              {!onBilling ? (
                <Pressable
                  onPress={async () => {
                    if (!id) return;
                    try {
                      await adminService.addExistingMemberToBilling(id);
                      await loadBilling();
                      setTab('billing');
                      setToast('Added to billing');
                    } catch (e) {
                      setToast(e instanceof Error ? e.message : 'Could not add to billing');
                    }
                  }}
                  style={({ pressed }) => [styles.billingCta, pressed && styles.pressed]}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.background} />
                  <Text style={styles.billingCtaText}>Add to billing</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setTab('billing')}
                  style={({ pressed }) => [styles.billingLink, pressed && styles.pressed]}>
                  <Ionicons name="wallet-outline" size={16} color={colors.accent} />
                  <Text style={styles.billingLinkText}>View billing & payments</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              )}

              <View style={styles.rosterDangerCard}>
                <View style={styles.rosterDangerHead}>
                  <View style={styles.rosterDangerIcon}>
                    <Ionicons
                      name={rosterActive ? 'person-remove-outline' : 'person-add-outline'}
                      size={18}
                      color={rosterActive ? colors.danger : colors.accent}
                    />
                  </View>
                  <View style={styles.rosterDangerCopy}>
                    <Text style={styles.rosterDangerTitle}>
                      {rosterActive ? 'Remove from roster' : 'Restore to roster'}
                    </Text>
                    <Text style={styles.rosterDangerSub}>
                      {rosterActive
                        ? 'Hides this member from the active roster and clears coach / program links. Account stays intact.'
                        : 'Bring this member back onto the active studio roster.'}
                    </Text>
                  </View>
                </View>

                {!rosterActive ? (
                  <View style={styles.rosterInactivePill}>
                    <View style={styles.rosterInactiveDot} />
                    <Text style={styles.rosterInactiveText}>Currently off roster</Text>
                  </View>
                ) : null}

                {confirmRemove && rosterActive ? (
                  <View style={styles.rosterConfirm}>
                    <Text style={styles.rosterConfirmText}>
                      Remove {data.member.full_name} from the active roster?
                    </Text>
                    <View style={styles.rosterConfirmActions}>
                      <Pressable
                        onPress={() => setConfirmRemove(false)}
                        disabled={rosterBusy}
                        style={styles.rosterConfirmGhost}>
                        <Text style={styles.rosterConfirmGhostText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          if (!id) return;
                          setRosterBusy(true);
                          try {
                            await adminService.removeMemberFromRoster(id);
                            setRosterActive(false);
                            setConfirmRemove(false);
                            setToast('Removed from roster');
                            setTimeout(() => router.replace('/(coach)/clients'), 500);
                          } catch (e) {
                            setToast(e instanceof Error ? e.message : 'Could not remove member');
                          } finally {
                            setRosterBusy(false);
                          }
                        }}
                        disabled={rosterBusy}
                        style={styles.rosterConfirmDanger}>
                        <Text style={styles.rosterConfirmDangerText}>
                          {rosterBusy ? 'Removing…' : 'Confirm remove'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={async () => {
                      if (rosterActive) {
                        setConfirmRemove(true);
                        return;
                      }
                      if (!id) return;
                      setRosterBusy(true);
                      try {
                        await adminService.restoreMemberToRoster(id);
                        setRosterActive(true);
                        setToast('Restored to roster');
                        await load();
                      } catch (e) {
                        setToast(e instanceof Error ? e.message : 'Could not restore member');
                      } finally {
                        setRosterBusy(false);
                      }
                    }}
                    disabled={rosterBusy}
                    style={({ pressed }) => [
                      rosterActive ? styles.rosterRemoveBtn : styles.rosterRestoreBtn,
                      pressed && styles.pressed,
                      rosterBusy && { opacity: 0.6 },
                    ]}>
                    <Text
                      style={
                        rosterActive ? styles.rosterRemoveBtnText : styles.rosterRestoreBtnText
                      }>
                      {rosterBusy
                        ? 'Please wait…'
                        : rosterActive
                          ? 'Remove from roster'
                          : 'Restore to roster'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {tab === 'billing' && canBilling ? (
        <MembershipBillingPanel
          membership={billing}
          payments={payments}
          loading={billingLoading}
          reminderBusy={reminderBusy}
          onMarkPaid={
            id
              ? async () => {
                  await adminService.markMembershipPaid(id);
                  loadBilling();
                  load();
                  setToast('Marked as paid');
                }
              : undefined
          }
          onMarkUnpaid={
            id
              ? async () => {
                  await adminService.markMembershipUnpaid(id);
                  loadBilling();
                  load();
                  setToast('Marked as unpaid');
                }
              : undefined
          }
          onSendReminder={
            id
              ? async () => {
                  setReminderBusy(true);
                  try {
                    await adminService.sendPaymentReminder(id);
                    setToast('Payment reminder sent');
                  } catch (e) {
                    setToast(e instanceof Error ? e.message : 'Could not send reminder');
                  } finally {
                    setReminderBusy(false);
                  }
                }
              : undefined
          }
        />
      ) : null}

      {tab === 'program' ? (
        data.days.length === 0 ? (
          <EmptyState
            title="No program assigned"
            description="Assign a training plan from Overview → Program."
          />
        ) : (
          <View style={styles.dayList}>
            {data.days.map((day, idx) => (
              <View key={day.id} style={styles.dayCard}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayIndex}>{String(idx + 1).padStart(2, '0')}</Text>
                  <View style={styles.dayCopy}>
                    <Text style={styles.dayName}>{day.name}</Text>
                    <Text style={styles.dayMeta}>{day.exercises.length} exercises</Text>
                  </View>
                </View>
                {day.exercises.map((pe, exIdx) => (
                  <View key={pe.id} style={styles.exerciseRow}>
                    <Text style={styles.exerciseIndex}>{exIdx + 1}</Text>
                    <View style={styles.exerciseCopy}>
                      <Text style={styles.exerciseName}>{pe.exercise?.name ?? 'Exercise'}</Text>
                      <Text style={styles.exerciseMeta}>{formatPrescription(parsePrescription(pe))}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )
      ) : null}

      {tab === 'progress' ? (
        <View style={styles.progressPanel}>
          {athletePerformance ? (
            <PerformanceBuildProfile
              stats={athletePerformance}
              performance={athletePerformance.performance}
              memberName={data.member.full_name}
              coachMode
              compact
            />
          ) : null}
          <View style={styles.kpiGrid}>
            <KpiTile
              featured
              kicker="Weight"
              label="Latest"
              icon="scale-outline"
              value={data.latestWeight?.weight_kg ?? null}
              suffix=" kg"
              decimals={1}
            />
            <KpiTile
              kicker="Body"
              label="Body fat"
              icon="pulse-outline"
              value={data.latestWeight?.body_fat_pct ?? null}
              suffix="%"
              decimals={1}
            />
          </View>
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Training volume</Text>
            <Text style={styles.progressValue}>{completedSessions} completed sessions</Text>
            <Text style={styles.progressSub}>{data.workoutsThisWeek} workouts logged this week</Text>
          </View>
        </View>
      ) : null}

      {tab === 'sessions' ? (
        data.bookings.length === 0 ? (
          <EmptyState title="No sessions" description="Bookings will appear here once scheduled." />
        ) : (
          <View style={styles.sessionList}>
            {data.bookings.map((b) => {
              const tone = sessionStatusStyle(b.status);
              return (
                <View key={b.id} style={[styles.sessionCard, { borderColor: tone.border }]}>
                  <View style={styles.sessionTop}>
                    <Text style={styles.sessionDate}>{format(parseISO(b.starts_at), 'EEE d MMM')}</Text>
                    <View style={[styles.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <Text style={[styles.statusText, { color: tone.text }]}>{b.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.sessionTime}>{formatTime(b.starts_at)}</Text>
                </View>
              );
            })}
          </View>
        )
      ) : null}

      {tab === 'notes' ? (
        <View style={styles.notesSection}>
          <View style={styles.noteComposer}>
            <AppInput
              label="Workout feedback (athlete visible)"
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Great session — keep pressing the top set…"
              multiline
              style={styles.noteInput}
            />
            {recentSessions.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                {recentSessions.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setFeedbackSessionId(s.id)}
                    style={[
                      styles.statusPill,
                      {
                        marginRight: spacing.sm,
                        borderColor:
                          feedbackSessionId === s.id ? colors.accent : colors.border,
                        backgroundColor:
                          feedbackSessionId === s.id
                            ? 'rgba(200,255,0,0.12)'
                            : colors.surfaceElevated,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.statusText,
                        { color: feedbackSessionId === s.id ? colors.accent : colors.textMuted },
                      ]}>
                      {s.finished_at
                        ? format(parseISO(s.finished_at), 'd MMM')
                        : 'Session'}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <PrimaryButton
              title="Send workout feedback"
              onPress={async () => {
                if (!profile || !feedbackSessionId || !feedback.trim() || !id) return;
                try {
                  await createWorkoutFeedback({
                    coachId: profile.id,
                    memberId: id,
                    sessionId: feedbackSessionId,
                    content: feedback.trim(),
                  });
                  setFeedback('');
                  setToast('Feedback sent');
                } catch (e) {
                  setToast(e instanceof Error ? e.message : 'Could not send feedback');
                }
              }}
              disabled={!feedback.trim() || !feedbackSessionId}
            />
          </View>
          <View style={styles.noteComposer}>
            <AppInput
              label="Private coach note"
              value={note}
              onChangeText={setNote}
              placeholder="Cues, injuries, preferences…"
              multiline
              style={styles.noteInput}
            />
            <PrimaryButton title="Save note" onPress={addNote} disabled={!note.trim()} />
          </View>
          {data.notes.length === 0 ? (
            <EmptyState title="No notes yet" description="Add private notes only coaches can see." />
          ) : (
            data.notes.map((n) => (
              <View key={n.id} style={styles.noteCard}>
                <View style={styles.noteHead}>
                  <Ionicons name="document-text-outline" size={14} color={colors.accent} />
                  <Text style={styles.noteTime}>{relativeTime(n.created_at)}</Text>
                </View>
                <Text style={styles.noteBody}>{n.content}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function StudioControlCard({
  kicker,
  title,
  icon,
  assigned,
  children,
}: {
  kicker: string;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  assigned: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.controlCard, assigned && styles.controlCardAssigned]}>
      {assigned ? (
        <LinearGradient
          colors={['rgba(200,255,0,0.1)', 'rgba(200,255,0,0.02)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.controlCardGlow}
        />
      ) : null}
      <View style={styles.controlCardHead}>
        <View style={styles.controlCardIconWrap}>
          <Ionicons name={icon} size={18} color={assigned ? colors.accent : colors.textSecondary} />
        </View>
        <View style={styles.controlCardCopy}>
          <Text style={styles.controlCardKicker}>{kicker}</Text>
          <Text style={styles.controlCardTitle}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function KpiTile({
  kicker,
  label,
  icon,
  value,
  suffix = '',
  decimals = 0,
  emptyLabel = '—',
  textValue,
  featured = false,
}: {
  kicker: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value?: number | null;
  suffix?: string;
  decimals?: number;
  emptyLabel?: string;
  textValue?: string;
  featured?: boolean;
}) {
  const hasNumeric = value != null && !Number.isNaN(value);

  return (
    <View style={[styles.kpiTile, featured && styles.kpiTileFeatured]}>
      {featured ? (
        <LinearGradient
          colors={['rgba(200,255,0,0.1)', 'transparent']}
          style={styles.kpiGlow}
        />
      ) : null}
      <View style={styles.kpiTop}>
        <Text style={[styles.kpiKicker, featured && styles.kpiKickerFeatured]}>{kicker}</Text>
        <Ionicons name={icon} size={14} color={featured ? colors.accent : colors.textMuted} />
      </View>
      {textValue != null ? (
        <Text style={[styles.kpiTextValue, featured && styles.kpiValueFeatured]} numberOfLines={2}>
          {textValue}
        </Text>
      ) : hasNumeric ? (
        <View style={styles.kpiValueRow}>
          <AnimatedCount
            value={value!}
            decimals={decimals}
            style={[styles.kpiValue, featured && styles.kpiValueFeatured]}
          />
          {suffix ? <Text style={styles.kpiSuffix}>{suffix}</Text> : null}
        </View>
      ) : (
        <Text style={styles.kpiEmpty}>{emptyLabel}</Text>
      )}
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: spacing.sm, marginBottom: spacing.sm },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
  },
  toastText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent, flex: 1 },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.md,
  },
  heroGlow: { ...StyleSheet.absoluteFillObject },
  heroRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  avatarRing: {
    position: 'relative',
    padding: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  genderBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, gap: 4, minWidth: 0 },
  heroName: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  genderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  genderPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroEmail: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  heroPhone: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textMuted },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroChipBilling: {
    borderColor: 'rgba(74,222,128,0.35)',
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  heroChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
  heroChipBillingText: { color: colors.success, textTransform: 'capitalize' },
  tabBar: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  tab: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  tabActive: { borderColor: 'rgba(200,255,0,0.35)' },
  tabGlow: { ...StyleSheet.absoluteFillObject },
  tabText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.textSecondary },
  tabTextActive: { color: colors.accent },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kpiTile: {
    position: 'relative',
    overflow: 'hidden',
    width: '48%',
    flexGrow: 1,
    minWidth: 148,
    minHeight: 108,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: 4,
  },
  kpiTileFeatured: {
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: '#121812',
  },
  kpiGlow: { ...StyleSheet.absoluteFillObject },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  kpiKickerFeatured: { color: 'rgba(200,255,0,0.7)' },
  kpiValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  kpiValue: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
    letterSpacing: 0.8,
  },
  kpiValueFeatured: { color: colors.accent },
  kpiTextValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 18,
    color: colors.text,
  },
  kpiSuffix: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  kpiEmpty: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.textMuted,
  },
  kpiLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  highlightCard: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: '#101410',
    gap: spacing.sm,
  },
  highlightGlow: { ...StyleSheet.absoluteFillObject },
  highlightKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  highlightTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
  },
  highlightDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  profileMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  profileMetaItem: {
    minWidth: '40%',
    gap: 2,
  },
  profileMetaLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  profileMetaValue: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  highlightCopy: { flex: 1, gap: 2 },
  highlightLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  highlightValue: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  adminSection: { gap: spacing.sm, marginBottom: spacing.lg },
  sectionKicker: { ...typography.sectionKicker, fontSize: 10 },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  absenceSection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  absenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.25)',
  },
  absenceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,77,77,0.12)',
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
  controlCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  controlCardAssigned: {
    borderColor: 'rgba(200,255,0,0.24)',
    backgroundColor: '#101410',
  },
  controlCardGlow: { ...StyleSheet.absoluteFillObject },
  controlCardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  controlCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  controlCardCopy: { flex: 1, gap: 2 },
  controlCardKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  controlCardTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.2,
  },
  assignHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  assignHeroAvatar: { position: 'relative' },
  assignCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#101410',
  },
  assignEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  programIconActive: {
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  assignHeroCopy: { flex: 1, gap: 4, minWidth: 0 },
  assignHeroName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  assignHeroMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  assignStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  assignStatusPillMuted: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  assignStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  assignStatusDotMuted: { backgroundColor: colors.textMuted },
  assignStatusText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.success,
  },
  assignStatusTextMuted: { color: colors.textMuted },
  assignPickerLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  assignPickerRow: { gap: spacing.sm, paddingRight: spacing.sm },
  assignOption: {
    position: 'relative',
    overflow: 'hidden',
    width: 148,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  assignOptionActive: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: '#121812',
  },
  assignOptionGlow: { ...StyleSheet.absoluteFillObject },
  assignOptionCopy: { gap: 2 },
  assignOptionName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  assignOptionNameActive: { color: colors.accent },
  assignOptionRole: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  assignOptionBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  programPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  programOption: {
    position: 'relative',
    overflow: 'hidden',
    width: '48%',
    flexGrow: 1,
    minWidth: 148,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    minHeight: 108,
  },
  programOptionActive: {
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: '#121812',
  },
  programOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  programOptionName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text,
  },
  programOptionMeta: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  billingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  billingCtaText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.background },
  billingLink: {
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
  billingLinkText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.accent, flex: 1 },
  rosterDangerCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.28)',
    backgroundColor: 'rgba(255,77,77,0.06)',
    gap: spacing.md,
  },
  rosterDangerHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rosterDangerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,77,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.22)',
  },
  rosterDangerCopy: { flex: 1, minWidth: 0, gap: 4 },
  rosterDangerTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  rosterDangerSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  rosterInactivePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rosterInactiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  rosterInactiveText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
  },
  rosterConfirm: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.25)',
  },
  rosterConfirmText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  rosterConfirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rosterConfirmGhost: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rosterConfirmGhostText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rosterConfirmDanger: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  rosterConfirmDangerText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  rosterRemoveBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.45)',
    backgroundColor: 'rgba(255,77,77,0.12)',
  },
  rosterRemoveBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.danger,
  },
  rosterRestoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  rosterRestoreBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.background,
  },
  pressed: { opacity: 0.92 },
  dayList: { gap: spacing.sm, marginBottom: spacing.lg },
  dayCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayIndex: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.accent,
    width: 32,
  },
  dayCopy: { flex: 1, gap: 2 },
  dayName: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.text },
  dayMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  exerciseRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseIndex: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textMuted, width: 16 },
  exerciseCopy: { flex: 1, gap: 2 },
  exerciseName: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  exerciseMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  progressPanel: { gap: spacing.sm, marginBottom: spacing.lg },
  progressCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: 4,
  },
  progressTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  progressValue: { fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: 0.8 },
  progressSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  sessionList: { gap: spacing.sm, marginBottom: spacing.lg },
  sessionCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
    gap: 4,
  },
  sessionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionDate: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  sessionTime: { fontFamily: fonts.display, fontSize: 24, color: colors.accent, letterSpacing: 1 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  notesSection: { gap: spacing.md, marginBottom: spacing.lg },
  noteComposer: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  noteCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noteTime: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textMuted },
  noteBody: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.text },
});
