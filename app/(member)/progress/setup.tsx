import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppInput } from '@/components/ui/AppInput';
import { Avatar } from '@/components/ui/Avatar';
import { BackButton } from '@/components/ui/BackButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import { pickAvatarImage } from '@/lib/utils/pickAvatar';
import * as memberService from '@/services/member';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const GOAL_OPTIONS = [
  { value: 3, label: '3×', hint: 'Light week' },
  { value: 4, label: '4×', hint: 'Balanced' },
  { value: 5, label: '5×', hint: 'Recommended' },
  { value: 6, label: '6×', hint: 'High volume' },
] as const;

const UNLOCK_ITEMS = [
  {
    icon: 'scale-outline' as const,
    title: 'Weight tracking',
    body: 'Log weigh-ins and see trends on Progress',
  },
  {
    icon: 'barbell-outline' as const,
    title: 'Weekly goal ring',
    body: 'Home shows sessions vs your target',
  },
  {
    icon: 'trending-up-outline' as const,
    title: 'Performance stats',
    body: 'Body fat, streak & monthly volume',
  },
];

function completionPct(fields: {
  weight: string;
  height: string;
  birthYear: string;
  goalWeight: string;
  bio: string;
  avatarUrl?: string | null;
}) {
  let score = 0;
  if (fields.weight.trim()) score += 30;
  if (fields.height.trim()) score += 15;
  if (fields.birthYear.trim()) score += 10;
  if (fields.goalWeight.trim()) score += 15;
  if (fields.bio.trim()) score += 10;
  if (fields.avatarUrl) score += 20;
  return Math.min(100, score);
}

function bmiFrom(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export default function FitnessSetupScreen() {
  const { profile, updateAvatar } = useAuth();
  const [height, setHeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState(4);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    memberService.getFitnessProfile(profile.id).then((existing) => {
      if (!existing) return;
      if (existing.height_cm) setHeight(String(existing.height_cm));
      if (existing.birth_year) setBirthYear(String(existing.birth_year));
      if (existing.goal_weight_kg) setGoalWeight(String(existing.goal_weight_kg));
      if (existing.weekly_session_goal) setWeeklyGoal(existing.weekly_session_goal);
      if (existing.bio) setBio(existing.bio);
    });
  }, [profile]);

  const progress = useMemo(
    () =>
      completionPct({
        weight,
        height,
        birthYear,
        goalWeight,
        bio,
        avatarUrl: profile?.avatar_url,
      }),
    [weight, height, birthYear, goalWeight, bio, profile?.avatar_url],
  );

  const weightNum = Number(weight);
  const heightNum = Number(height);
  const goalNum = Number(goalWeight);
  const bmi =
    weightNum > 0 && heightNum > 0 ? bmiFrom(weightNum, heightNum) : null;
  const weightDelta =
    weightNum > 0 && goalNum > 0 ? goalNum - weightNum : null;

  const onPickAvatar = async () => {
    const uri = await pickAvatarImage();
    if (!uri) return;
    setUploading(true);
    setError(null);
    try {
      await updateAvatar(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update photo');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!profile) return;
    const weightKg = Number(weight);
    if (!weightKg || weightKg <= 0) {
      setError('Enter your current weight to start tracking');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await memberService.saveFitnessProfile({
        memberId: profile.id,
        heightCm: height ? Number(height) : undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
        goalWeightKg: goalWeight ? Number(goalWeight) : undefined,
        weeklySessionGoal: weeklyGoal,
        bio: bio || undefined,
        onboardingComplete: true,
        initialWeightKg: weightKg,
        initialBodyFatPct: bodyFat ? Number(bodyFat) : undefined,
      });
      router.replace('/(member)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroHeader}>
          <LinearGradient
            colors={['rgba(200,255,0,0.1)', 'transparent', 'rgba(200,255,0,0.04)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.heroHeaderGlow}
          />
          <View style={styles.heroHeaderTop}>
            <BackButton compact />
            <View style={styles.progressRing}>
              <Text style={styles.progressValue}>{progress}%</Text>
              <Text style={styles.progressLabel}>READY</Text>
            </View>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="analytics-outline" size={24} color={colors.accent} />
          </View>
          <Text style={styles.heroKicker}>PERFORMANCE SETUP</Text>
          <Text style={styles.heroTitle}>Your Profile</Text>
          <Text style={styles.heroSub}>
            One-time baseline. After this, weight logs and completed workouts update your stats
            automatically on Home and Progress.
          </Text>
        </View>

        <View style={styles.unlockRow}>
          {UNLOCK_ITEMS.map((item) => (
            <View key={item.title} style={styles.unlockCard}>
              <View style={styles.unlockIcon}>
                <Ionicons name={item.icon} size={16} color={colors.accent} />
              </View>
              <Text style={styles.unlockTitle}>{item.title}</Text>
              <Text style={styles.unlockBody}>{item.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionStep}>01</Text>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionKicker}>IDENTITY</Text>
              <Text style={styles.sectionTitle}>Profile photo</Text>
            </View>
          </View>
          <View style={styles.avatarBlock}>
            <LinearGradient
              colors={['rgba(200,255,0,0.12)', 'transparent']}
              style={styles.avatarGlow}
            />
            <Avatar
              name={profile?.full_name}
              uri={profile?.avatar_url}
              size={104}
              editable
              onPress={onPickAvatar}
            />
            <Text style={styles.avatarName}>{profile?.full_name ?? 'Member'}</Text>
            <Text style={styles.avatarHint}>
              {uploading ? 'Updating photo…' : 'Tap photo to upload — shown on roster & messages'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionStep}>02</Text>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionKicker}>BASELINES</Text>
              <Text style={styles.sectionTitle}>Body metrics</Text>
            </View>
          </View>
          <Text style={styles.sectionHint}>
            Current weight is required. Everything else improves your charts and coach visibility.
          </Text>
          <View style={styles.form}>
            <View style={styles.highlightRow}>
              <View style={styles.highlightField}>
                <AppInput
                  label="Current weight (kg) *"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="78.5"
                />
              </View>
              <View style={styles.highlightField}>
                <AppInput
                  label="Body fat %"
                  keyboardType="decimal-pad"
                  value={bodyFat}
                  onChangeText={setBodyFat}
                  placeholder="14.2"
                />
              </View>
            </View>
            <View style={styles.highlightRow}>
              <View style={styles.highlightField}>
                <AppInput
                  label="Height (cm)"
                  keyboardType="number-pad"
                  value={height}
                  onChangeText={setHeight}
                  placeholder="175"
                />
              </View>
              <View style={styles.highlightField}>
                <AppInput
                  label="Birth year"
                  keyboardType="number-pad"
                  value={birthYear}
                  onChangeText={setBirthYear}
                  placeholder="1995"
                />
              </View>
            </View>
          </View>
          {bmi != null ? (
            <View style={styles.insightStrip}>
              <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
              <Text style={styles.insightText}>
                BMI {bmi.toFixed(1)}
                {birthYear ? ` · born ${birthYear}` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionStep}>03</Text>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionKicker}>GOALS</Text>
              <Text style={styles.sectionTitle}>Training targets</Text>
            </View>
          </View>
          <View style={styles.form}>
            <AppInput
              label="Goal weight (kg)"
              keyboardType="decimal-pad"
              value={goalWeight}
              onChangeText={setGoalWeight}
              placeholder="75"
            />
            {weightDelta != null ? (
              <View style={styles.insightStrip}>
                <Ionicons name="flag-outline" size={16} color={colors.accent} />
                <Text style={styles.insightText}>
                  {weightDelta === 0
                    ? 'Maintenance target — same as current weight'
                    : weightDelta < 0
                      ? `${Math.abs(weightDelta).toFixed(1)} kg to lose`
                      : `${weightDelta.toFixed(1)} kg to gain`}
                </Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Weekly session goal</Text>
            <Text style={styles.fieldHint}>
              Drives the progress ring on your Home screen
            </Text>
            <View style={styles.goalGrid}>
              {GOAL_OPTIONS.map((opt) => {
                const active = weeklyGoal === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setWeeklyGoal(opt.value)}
                    style={({ pressed }) => [
                      styles.goalChip,
                      active && styles.goalChipActive,
                      pressed && styles.pressed,
                    ]}>
                    {active ? (
                      <LinearGradient
                        colors={['rgba(200,255,0,0.22)', 'rgba(200,255,0,0.08)']}
                        style={styles.goalChipGlow}
                      />
                    ) : null}
                    <Text style={[styles.goalChipLabel, active && styles.goalChipLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.goalChipHint, active && styles.goalChipHintActive]}>
                      {opt.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <AppInput
              label="About your training (optional)"
              value={bio}
              onChangeText={setBio}
              placeholder="Strength focus, morning classes, returning after injury…"
              multiline
            />
          </View>
        </View>

        <View style={styles.previewCard}>
          <LinearGradient
            colors={['rgba(200,255,0,0.08)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.previewGlow}
          />
          <Text style={styles.previewKicker}>HOME PREVIEW</Text>
          <Text style={styles.previewTitle}>How your stats will look</Text>
          <View style={styles.previewStats}>
            <PreviewStat
              label="This week"
              value={weight.trim() ? `0 / ${weeklyGoal}` : '—'}
              hint="sessions"
            />
            <PreviewStat
              label="Weight"
              value={weight.trim() ? `${weight} kg` : '—'}
              hint="current"
              accent
            />
            <PreviewStat
              label="Body fat"
              value={bodyFat.trim() ? `${bodyFat}%` : '—'}
              hint={bodyFat.trim() ? 'baseline' : 'optional'}
            />
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <PrimaryButton
          title={loading ? 'Saving…' : 'Save & unlock tracking'}
          onPress={onSave}
          disabled={loading || !weight.trim()}
          style={styles.saveBtn}
        />
        <Text style={styles.footerNote}>
          You can update weight anytime from Progress → Log Weight
        </Text>
      </ScrollView>
    </Screen>
  );
}

function PreviewStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.previewStat}>
      <Text style={styles.previewStatLabel}>{label}</Text>
      <Text style={[styles.previewStatValue, accent && styles.previewStatValueAccent]}>
        {value}
      </Text>
      <Text style={styles.previewStatHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  heroHeader: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: spacing.sm,
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
  progressRing: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    minWidth: 56,
  },
  progressValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.accent,
  },
  progressLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 1.2,
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
  },
  unlockRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  unlockCard: {
    flex: 1,
    minWidth: 140,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  unlockIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    marginBottom: 2,
  },
  unlockTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  unlockBody: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionStep: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.accent,
    opacity: 0.85,
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionKicker: {
    ...typography.sectionKicker,
    fontSize: 9,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 18,
    color: colors.text,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  avatarBlock: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.15)',
  },
  avatarGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    zIndex: 1,
  },
  avatarHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    zIndex: 1,
  },
  form: {
    gap: spacing.md,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  highlightField: {
    flex: 1,
  },
  insightStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  insightText: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.text,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: -spacing.xs,
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.xs,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  goalChip: {
    position: 'relative',
    overflow: 'hidden',
    width: '47%',
    flexGrow: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 2,
  },
  goalChipActive: {
    borderColor: 'rgba(200,255,0,0.45)',
  },
  goalChipGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  goalChipLabel: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
    zIndex: 1,
  },
  goalChipLabelActive: {
    color: colors.accent,
  },
  goalChipHint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    zIndex: 1,
  },
  goalChipHintActive: {
    color: colors.textSecondary,
  },
  previewCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  previewGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  previewKicker: {
    ...typography.sectionKicker,
    fontSize: 9,
    zIndex: 1,
  },
  previewTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    zIndex: 1,
  },
  previewStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    zIndex: 1,
  },
  previewStat: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  previewStatLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewStatValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
  },
  previewStatValueAccent: {
    color: colors.accent,
  },
  previewStatHint: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textMuted,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,77,77,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.25)',
  },
  error: {
    flex: 1,
    ...typography.caption,
    color: colors.danger,
  },
  saveBtn: {
    marginTop: spacing.xs,
  },
  footerNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.88,
  },
});
