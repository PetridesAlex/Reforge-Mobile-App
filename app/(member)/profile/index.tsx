import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MemberAppGuide } from '@/components/onboarding/MemberAppGuide';
import { MemberSubscriptionCard } from '@/components/billing/MemberSubscriptionCard';
import { PerformanceBuildProfile } from '@/components/performance/PerformanceBuildProfile';
import { TrophyCabinetCard } from '@/components/achievements/TrophyCabinetCard';
import { AppBottomSheet, SheetFormError } from '@/components/ui/AppBottomSheet';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { Avatar } from '@/components/ui/Avatar';
import { MoreMenu } from '@/components/ui/MoreMenu';
import { PersonIcon } from '@/components/ui/PersonIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useAuth } from '@/hooks/useAuth';
import {
  PRIMARY_GOAL_OPTIONS,
  TRAINING_FREQUENCY_OPTIONS,
  TRAINING_INTEREST_OPTIONS,
  TRAINING_LEVEL_OPTIONS,
  WORKOUT_DURATION_OPTIONS,
  WORKOUT_TIME_OPTIONS,
} from '@/lib/onboarding/types';
import {
  activeMoodForDisplay,
  COMMUNITY_MOODS,
  type CommunityMoodId,
  isMoodFreshToday,
} from '@/lib/community/moods';
import { pickAvatarImage } from '@/lib/utils/pickAvatar';
import type { MembershipStatus } from '@/services/mock/data';
import * as community from '@/services/community';
import * as memberService from '@/services/member';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const BIO_MAX = 280;

const MENU_ITEMS = [
  { id: 'achievements', label: 'Achievements', icon: 'ribbon-outline' as const, href: '/(member)/achievements' },
  { id: 'challenges', label: 'Weekly Challenge', icon: 'trophy-outline' as const, href: '/(member)/challenges' },
  { id: 'orders', label: 'My Orders', icon: 'receipt-outline' as const, href: '/(member)/store/orders' },
  { id: 'favorites', label: 'Favorites', icon: 'heart-outline' as const, href: '/(member)/store/favorites' },
  { id: 'store', label: 'Store', icon: 'bag-handle-outline' as const, href: '/(member)/store' },
  { id: 'sessions', label: 'Sessions', icon: 'calendar-outline' as const, href: '/(member)/bookings' },
  { id: 'absence', label: 'Report absence', icon: 'calendar-clear-outline' as const, href: '/(member)/workouts/absences' },
  { id: 'chat', label: 'Messages', icon: 'chatbubbles-outline' as const, href: '/(member)/messages' },
  { id: 'community', label: 'Community', icon: 'people-outline' as const, href: '/(member)/community' },
  { id: '1', label: 'Notifications', icon: 'notifications-outline' as const },
  { id: '2', label: 'Change password', icon: 'key-outline' as const, href: '/(auth)/reset-password' },
  { id: '3', label: 'Privacy', icon: 'shield-outline' as const },
  { id: '4', label: 'Terms', icon: 'document-text-outline' as const },
];

export default function ProfileScreen() {
  const { profile, signOut, updateAvatar, updateProfile } = useAuth();
  const [coachName, setCoachName] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string | null>(null);
  const [membershipPlan, setMembershipPlan] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [membershipEnds, setMembershipEnds] = useState<string | null>(null);
  const [membershipAmountEur, setMembershipAmountEur] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [primaryGoal, setPrimaryGoal] = useState(profile?.primary_goal ?? '');
  const [trainingLevel, setTrainingLevel] = useState(profile?.training_level ?? '');
  const [trainingDays, setTrainingDays] = useState(
    profile?.training_days_per_week != null ? String(profile.training_days_per_week) : '',
  );
  const [interests, setInterests] = useState<string[]>(profile?.training_interests ?? []);
  const [workoutTime, setWorkoutTime] = useState(profile?.preferred_workout_time ?? '');
  const [workoutDuration, setWorkoutDuration] = useState(
    profile?.preferred_workout_duration ?? '',
  );
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bio, setBio] = useState(profile?.community_bio ?? '');
  const [moodId, setMoodId] = useState<CommunityMoodId | null>(
    isMoodFreshToday(profile?.community_mood_updated_at)
      ? ((profile?.community_mood as CommunityMoodId | null | undefined) ?? null)
      : null,
  );
  const [messagingCoach, setMessagingCoach] = useState(false);
  const [performanceStats, setPerformanceStats] = useState<{
    weeklyWorkouts: number;
    monthlyWorkouts: number;
    weightKg: number | null;
    bodyFatPct: number | null;
    performance?: {
      onboardingComplete: boolean;
      profileCompletionPct: number;
      weeklyGoal: number;
      streak: number;
    };
  } | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setFirstName(profile?.first_name ?? '');
    setLastName(profile?.last_name ?? '');
    setUsername(profile?.username ?? '');
    setEmail(profile?.email ?? '');
    setPhone(profile?.phone ?? '');
    setPrimaryGoal(profile?.primary_goal ?? '');
    setTrainingLevel(profile?.training_level ?? '');
    setTrainingDays(
      profile?.training_days_per_week != null ? String(profile.training_days_per_week) : '',
    );
    setInterests(profile?.training_interests ?? []);
    setWorkoutTime(profile?.preferred_workout_time ?? '');
    setWorkoutDuration(profile?.preferred_workout_duration ?? '');
    setBio(profile?.community_bio ?? '');
    setMoodId(
      isMoodFreshToday(profile?.community_mood_updated_at)
        ? ((profile?.community_mood as CommunityMoodId | null | undefined) ?? null)
        : null,
    );
  }, [
    profile?.full_name,
    profile?.first_name,
    profile?.last_name,
    profile?.username,
    profile?.email,
    profile?.phone,
    profile?.primary_goal,
    profile?.training_level,
    profile?.training_days_per_week,
    profile?.training_interests,
    profile?.preferred_workout_time,
    profile?.preferred_workout_duration,
    profile?.community_bio,
    profile?.community_mood,
    profile?.community_mood_updated_at,
  ]);

  useEffect(() => {
    if (!profile) return;
    void memberService.getFitnessProfile(profile.id).then((fitness) => {
      if (fitness?.height_cm) setHeightCm(String(fitness.height_cm));
    });
    void memberService.getMeasurements(profile.id).then((rows) => {
      const last = rows.length ? rows[rows.length - 1] : null;
      if (last?.weight_kg) setWeightKg(String(last.weight_kg));
    });
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    memberService.getMemberProfileExtras(profile.id).then((extras) => {
      setCoachName(extras.coach?.full_name ?? null);
      setProgramName(extras.programName ?? null);
      setMembershipPlan(extras.membership ?? null);
      setMembershipStatus((extras.membershipStatus as MembershipStatus | null) ?? null);
      setMembershipEnds(extras.membershipEnds ?? null);
      setMembershipAmountEur(extras.membershipAmountEur ?? null);
    });
    memberService.getMemberDashboard(profile.id, profile).then((dash) => {
      setPerformanceStats({
        weeklyWorkouts: dash.stats.weeklyWorkouts,
        monthlyWorkouts: dash.stats.monthlyWorkouts,
        weightKg: dash.stats.weightKg,
        bodyFatPct: dash.stats.bodyFatPct,
        performance: dash.performance,
      });
    });
  }, [profile]);

  const openEdit = () => {
    setFullName(profile?.full_name ?? '');
    setFirstName(profile?.first_name ?? '');
    setLastName(profile?.last_name ?? '');
    setUsername(profile?.username ?? '');
    setEmail(profile?.email ?? '');
    setPhone(profile?.phone ?? '');
    setPrimaryGoal(profile?.primary_goal ?? '');
    setTrainingLevel(profile?.training_level ?? '');
    setTrainingDays(
      profile?.training_days_per_week != null ? String(profile.training_days_per_week) : '',
    );
    setInterests(profile?.training_interests ?? []);
    setWorkoutTime(profile?.preferred_workout_time ?? '');
    setWorkoutDuration(profile?.preferred_workout_duration ?? '');
    setBio(profile?.community_bio ?? '');
    setMoodId(
      isMoodFreshToday(profile?.community_mood_updated_at)
        ? ((profile?.community_mood as CommunityMoodId | null | undefined) ?? null)
        : null,
    );
    setEditError(null);
    setSuccess(null);
    setEditOpen(true);
  };

  const onSaveProfile = async () => {
    setSavingProfile(true);
    setEditError(null);
    setSuccess(null);
    setError(null);
    try {
      const hadFreshMood = isMoodFreshToday(profile?.community_mood_updated_at);
      const days = trainingDays.trim() ? Number(trainingDays) : null;
      await updateProfile({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        fullName: [firstName, lastName].filter(Boolean).join(' ').trim() || fullName.trim(),
        username: username.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        primaryGoal: primaryGoal || null,
        trainingLevel: trainingLevel || null,
        trainingDaysPerWeek: days && days > 0 ? days : null,
        trainingInterests: interests,
        preferredWorkoutTime: workoutTime || null,
        preferredWorkoutDuration: workoutDuration || null,
        communityBio: bio.trim() || null,
        ...(moodId != null || hadFreshMood ? { communityMood: moodId } : {}),
      });

      if (profile?.id) {
        const height = heightCm.trim() ? Number(heightCm) : null;
        const daysNum = days && days > 0 ? days : undefined;
        if (height && height > 0) {
          const existing = await memberService.getFitnessProfile(profile.id);
          await memberService.saveFitnessProfile({
            memberId: profile.id,
            heightCm: height,
            weeklySessionGoal: daysNum ?? existing?.weekly_session_goal ?? undefined,
            birthYear: existing?.birth_year ?? undefined,
            goalWeightKg: existing?.goal_weight_kg ?? undefined,
            bio: existing?.bio ?? undefined,
            onboardingComplete: existing?.onboarding_complete,
          });
        }
        const weight = weightKg.trim() ? Number(weightKg) : null;
        if (weight && weight > 0) {
          await memberService.logWeight({
            memberId: profile.id,
            weightKg: weight,
            measuredAt: new Date().toISOString().slice(0, 10),
          });
        }
      }

      setEditOpen(false);
      setSuccess('Profile updated');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save profile';
      const code = e instanceof Error ? (e as Error & { code?: string }).code : undefined;
      if (code === 'EMAIL_CONFIRM_REQUIRED') {
        setEditOpen(false);
        setSuccess(message);
      } else {
        setEditError(message);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const onMessageCoach = async () => {
    if (!profile) return;
    setMessagingCoach(true);
    setError(null);
    try {
      const thread = await community.getOrCreateCoachDm(profile.id);
      router.push(`/(member)/messages/${thread.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open coach chat');
    } finally {
      setMessagingCoach(false);
    }
  };

  const onUpload = async () => {
    setError(null);
    const uri = await pickAvatarImage();
    if (!uri) return;
    setUploading(true);
    try {
      await updateAvatar(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update photo');
    } finally {
      setUploading(false);
    }
  };

  const signOutScale = useRef(new Animated.Value(1)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandY = useRef(new Animated.Value(10)).current;
  const feelingOpacity = useRef(new Animated.Value(0.4)).current;
  const feelingY = useRef(new Animated.Value(8)).current;

  const todayMood = activeMoodForDisplay(
    profile?.community_mood,
    profile?.community_mood_updated_at,
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 700,
        delay: 180,
        useNativeDriver: true,
      }),
      Animated.spring(brandY, {
        toValue: 0,
        friction: 9,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [brandOpacity, brandY]);

  useEffect(() => {
    if (todayMood) {
      feelingOpacity.stopAnimation();
      feelingY.stopAnimation();
      feelingOpacity.setValue(1);
      return;
    }
    feelingOpacity.setValue(0.4);
    feelingY.setValue(8);
    const anim = Animated.parallel([
      Animated.spring(feelingY, {
        toValue: 0,
        friction: 8,
        tension: 64,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(feelingOpacity, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(feelingOpacity, {
            toValue: 0.45,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [todayMood, feelingOpacity, feelingY]);

  const onSignOutPressIn = () => {
    Animated.spring(signOutScale, {
      toValue: 0.97,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const onSignOutPressOut = () => {
    Animated.spring(signOutScale, {
      toValue: 1,
      friction: 5,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  const onSignOut = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.topLabel}>PROFILE</Text>
        <MoreMenu compact />
      </View>

      <View style={styles.hero}>
        <Avatar
          name={profile?.full_name}
          uri={profile?.avatar_url}
          size={104}
          editable
          onPress={onUpload}
        />
        <Text style={styles.name}>{profile?.full_name}</Text>
        <View style={styles.membershipBadge}>
          <Text style={styles.membershipText}>
            {membershipStatus === 'paid'
              ? 'Active member'
              : membershipStatus === 'trial'
                ? 'Trial member'
                  : membershipStatus === 'unpaid' || membershipStatus === 'overdue'
                  ? 'Payment due'
                  : programName ?? membershipPlan ?? 'REFORGE Member'}
          </Text>
        </View>
        {todayMood ? (
          <View style={styles.moodBadge}>
            <Text style={styles.moodBadgeEmoji}>{todayMood.emoji}</Text>
            <Text style={styles.moodBadgeText}>Feeling {todayMood.label.toLowerCase()} today</Text>
          </View>
        ) : (
          <Pressable
            onPress={openEdit}
            accessibilityRole="button"
            accessibilityLabel="How are you feeling today?"
            style={styles.moodPrompt}>
            <Animated.Text
              style={[
                styles.moodPromptText,
                {
                  opacity: feelingOpacity,
                  transform: [{ translateY: feelingY }],
                },
              ]}>
              How are you feeling today?
            </Animated.Text>
            <Animated.View style={[styles.moodPromptRule, { opacity: feelingOpacity }]} />
          </Pressable>
        )}
        {profile?.community_bio?.trim() ? (
          <Text style={styles.heroBio}>{profile.community_bio.trim()}</Text>
        ) : null}
        <Text style={styles.uploadHint}>
          {uploading ? 'Updating photo…' : 'Tap photo to change'}
        </Text>
        <Pressable
          onPress={openEdit}
          style={({ pressed }) => [styles.editProfileBtn, pressed && styles.editProfileBtnPressed]}>
          <Ionicons name="create-outline" size={16} color={colors.background} />
          <Text style={styles.editProfileBtnText}>EDIT PROFILE</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
      </View>

      {profile?.id ? (
        <TrophyCabinetCard memberId={profile.id} memberName={profile.full_name} />
      ) : null}

      <MemberSubscriptionCard
        planLabel={membershipPlan ?? 'REFORGE Group'}
        status={membershipStatus}
        amountEur={membershipAmountEur}
        periodEnd={membershipEnds}
      />

      <View style={styles.contactHead}>
        <View style={{ flex: 1 }}>
          <SectionHeader title="Contact" kicker="Account" />
        </View>
        <Pressable onPress={openEdit} hitSlop={8} style={styles.editLink}>
          <Text style={styles.editLinkText}>EDIT</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </Pressable>
      </View>
      <Pressable
        onPress={openEdit}
        style={({ pressed }) => [styles.premiumCard, pressed && styles.contactPressed]}>
        <LinearGradient
          colors={['rgba(200,255,0,0.18)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.premiumCardSheen}
        />
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="mail-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile?.email ?? '—'}
            </Text>
          </View>
          <Ionicons name="pencil" size={14} color={colors.textMuted} />
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="call-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={[styles.infoValue, !profile?.phone && styles.infoValueMuted]}>
              {profile?.phone?.trim() ? profile.phone : 'Tap to add number'}
            </Text>
          </View>
          <Ionicons name="pencil" size={14} color={colors.textMuted} />
        </View>
      </Pressable>

      <SectionHeader title="Performance build" kicker="Analytics" />
      {performanceStats ? (
        <PerformanceBuildProfile
          stats={performanceStats}
          performance={performanceStats.performance}
          memberName={profile?.full_name}
          compact
        />
      ) : null}

      <SectionHeader title="Performance" />
      <AppCard onPress={() => router.push('/(member)/progress/setup')} style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="analytics-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Fitness profile</Text>
            <Text style={styles.infoValue}>Weight, goals & weekly targets</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </AppCard>

      <SectionHeader title="Training" kicker="Studio" />
      <View style={[styles.premiumCard, styles.trainingCard]}>
        <LinearGradient
          colors={['rgba(200,255,0,0.22)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.premiumCardSheen}
        />
        <Pressable
          onPress={() => void onMessageCoach()}
          disabled={messagingCoach}
          style={({ pressed }) => [
            styles.coachRow,
            pressed && styles.coachRowPressed,
            messagingCoach && styles.coachRowDisabled,
          ]}>
          <View style={styles.coachIcon}>
            <PersonIcon size={20} color={colors.background} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Coach</Text>
            <Text style={styles.coachName}>{coachName ?? 'Studio coach'}</Text>
            <Text style={styles.infoHint}>
              {messagingCoach ? 'Opening chat…' : 'Tap to message your coach'}
            </Text>
          </View>
          <View style={styles.messagePill}>
            <Ionicons name="chatbubble-ellipses" size={14} color={colors.background} />
            <Text style={styles.messagePillText}>Message</Text>
          </View>
        </Pressable>

        <View style={styles.trainingDivider} />

        <View style={styles.programRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="barbell-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Program</Text>
            <Text style={styles.infoValue}>{programName ?? 'No active plan'}</Text>
          </View>
          {programName ? (
            <View style={styles.activeChip}>
              <View style={styles.activeDot} />
              <Text style={styles.activeChipText}>Active</Text>
            </View>
          ) : null}
        </View>
      </View>

      <SectionHeader title="Settings" />
      <View style={styles.menu}>
        <AppCard onPress={openEdit} style={styles.menuItem}>
          <Ionicons name="person-outline" size={20} color={colors.accent} />
          <Text style={styles.menuLabel}>Edit profile</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </AppCard>
        <AppCard onPress={() => setGuideOpen(true)} style={styles.menuItem}>
          <Ionicons name="map-outline" size={20} color={colors.accent} />
          <Text style={styles.menuLabel}>App guide</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </AppCard>
        <AppCard onPress={onUpload} style={styles.menuItem}>
          <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.menuLabel}>{uploading ? 'Uploading…' : 'Change profile photo'}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </AppCard>
        {MENU_ITEMS.map((item) => (
          <AppCard
            key={item.id}
            onPress={() => {
              if (item.href) router.push(item.href as never);
            }}
            style={styles.menuItem}>
            <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </AppCard>
        ))}
      </View>

      <Animated.View style={{ transform: [{ scale: signOutScale }] }}>
        <Pressable
          onPress={onSignOut}
          onPressIn={onSignOutPressIn}
          onPressOut={onSignOutPressOut}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [
            styles.signOut,
            pressed && styles.signOutPressed,
            signingOut && styles.signOutDisabled,
          ]}>
          <LinearGradient
            colors={['rgba(255,77,77,0.14)', 'rgba(255,77,77,0.04)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.signOutInner}>
            <View style={styles.signOutIconWrap}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            </View>
            <Text style={styles.signOutLabel}>
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.brandFooter,
          { opacity: brandOpacity, transform: [{ translateY: brandY }] },
        ]}>
        <View style={styles.brandRuleRow}>
          <LinearGradient
            colors={['transparent', 'rgba(200,255,0,0.35)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.brandRule}
          />
        </View>
        <ReforgeLogo width={44} height={44} />
        <View style={styles.brandCaptionRow}>
          <Text style={styles.brandWord}>REFORGE</Text>
          <View style={styles.brandDot} />
          <Text style={styles.brandPlace}>LIMASSOL</Text>
        </View>
      </Animated.View>

      <MemberAppGuide
        visible={guideOpen}
        memberName={profile?.full_name}
        onComplete={() => setGuideOpen(false)}
        onSkip={() => setGuideOpen(false)}
      />

      <AppBottomSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        kicker="Profile"
        title="Edit profile"
        hint="Update your details, bio, and how you’re feeling today."
        icon="person-outline"
        footer={
          <>
            <PrimaryButton
              title={savingProfile ? 'Saving…' : 'Save changes'}
              onPress={() => void onSaveProfile()}
              disabled={
                savingProfile ||
                !(firstName.trim() || lastName.trim() || fullName.trim()) ||
                !email.trim()
              }
            />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setEditOpen(false)} />
          </>
        }>
        <AppInput
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          autoCapitalize="words"
        />
        <AppInput
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          autoCapitalize="words"
        />
        <AppInput
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <AppInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <AppInput
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          placeholder="+357 99 000000"
          keyboardType="phone-pad"
        />
        <AppInput
          label="Height (cm)"
          value={heightCm}
          onChangeText={setHeightCm}
          keyboardType="number-pad"
          placeholder="175"
        />
        <AppInput
          label="Weight (kg)"
          value={weightKg}
          onChangeText={setWeightKg}
          keyboardType="decimal-pad"
          placeholder="75"
        />

        <Text style={styles.moodLabel}>PRIMARY GOAL</Text>
        <View style={styles.chipWrap}>
          {PRIMARY_GOAL_OPTIONS.map((opt) => {
            const active = primaryGoal === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setPrimaryGoal(opt.id);
                }}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.moodLabel}>TRAINING LEVEL</Text>
        <View style={styles.chipWrap}>
          {TRAINING_LEVEL_OPTIONS.map((opt) => {
            const active = trainingLevel === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTrainingLevel(opt.id);
                }}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.moodLabel}>DAYS PER WEEK</Text>
        <View style={styles.chipWrap}>
          {TRAINING_FREQUENCY_OPTIONS.map((opt) => {
            const active = trainingDays === String(opt.id);
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTrainingDays(String(opt.id));
                }}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.moodLabel}>INTERESTS</Text>
        <View style={styles.chipWrap}>
          {TRAINING_INTEREST_OPTIONS.map((opt) => {
            const active = interests.includes(opt.id);
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setInterests((prev) =>
                    prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id],
                  );
                }}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.moodLabel}>WORKOUT TIME</Text>
        <View style={styles.chipWrap}>
          {WORKOUT_TIME_OPTIONS.map((opt) => {
            const active = workoutTime === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setWorkoutTime(opt.id);
                }}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.moodLabel}>SESSION LENGTH</Text>
        <View style={styles.chipWrap}>
          {WORKOUT_DURATION_OPTIONS.map((opt) => {
            const active = workoutDuration === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setWorkoutDuration(opt.id);
                }}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <AppInput
          label="About you"
          value={bio}
          onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
          placeholder="What drives you? Goals, vibe, training style…"
          multiline
          textAlignVertical="top"
          style={styles.bioInput}
        />
        <Text style={styles.bioCount}>
          {bio.trim().length}/{BIO_MAX}
        </Text>

        <Text style={styles.moodLabel}>HOW ARE YOU FEELING TODAY?</Text>
        <Text style={styles.moodHint}>Members can see this on your profile until midnight.</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moodRow}>
          {COMMUNITY_MOODS.map((m) => {
            const active = moodId === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setMoodId((prev) => (prev === m.id ? null : m.id));
                }}
                style={({ pressed }) => [
                  styles.moodChip,
                  active && styles.moodChipActive,
                  pressed && styles.moodChipPressed,
                ]}>
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodChipText, active && styles.moodChipTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {editError ? <SheetFormError message={editError} /> : null}
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  topLabel: {
    ...typography.label,
    color: colors.accent,
    letterSpacing: 2,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    gap: spacing.sm,
  },
  name: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  membershipBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  membershipText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  moodBadgeEmoji: {
    fontSize: 16,
  },
  moodBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  moodPrompt: {
    marginTop: spacing.xs,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  moodPromptText: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 1.6,
    color: colors.accent,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  moodPromptRule: {
    width: 56,
    height: 1,
    backgroundColor: 'rgba(200,255,0,0.55)',
  },
  heroBio: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.sm,
  },
  bioInput: {
    minHeight: 88,
    paddingTop: spacing.md,
  },
  bioCount: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  moodLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent,
    marginBottom: 4,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.14)',
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accent,
  },
  moodHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  moodRow: {
    gap: 8,
    paddingBottom: spacing.sm,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moodChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.14)',
  },
  moodChipPressed: {
    opacity: 0.85,
  },
  moodEmoji: {
    fontSize: 16,
  },
  moodChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  moodChipTextActive: {
    color: colors.text,
  },
  uploadHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  editProfileBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  editProfileBtnPressed: { opacity: 0.9 },
  editProfileBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.background,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  success: {
    ...typography.caption,
    color: colors.accent,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  contactHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: 0,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.md + 2,
  },
  editLinkText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  contactPressed: { opacity: 0.94 },
  infoCard: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  premiumCard: {
    marginBottom: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    overflow: 'hidden',
  },
  trainingCard: {
    borderColor: 'rgba(200,255,0,0.28)',
    paddingVertical: spacing.md,
  },
  premiumCardSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md - 2,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
  },
  coachRowPressed: {
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  coachRowDisabled: {
    opacity: 0.7,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  infoLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  infoValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  infoValueMuted: {
    color: colors.textMuted,
    fontFamily: fonts.sansMedium,
  },
  coachName: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.25,
  },
  infoHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  messagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  messagePillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.background,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  activeChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 58,
  },
  trainingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(200,255,0,0.16)',
    marginVertical: spacing.sm,
    marginLeft: 62,
  },
  menu: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  menuLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  signOut: {
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.35)',
    backgroundColor: 'rgba(255,77,77,0.06)',
    minHeight: 56,
    justifyContent: 'center',
  },
  signOutPressed: {
    borderColor: 'rgba(255,77,77,0.55)',
    backgroundColor: 'rgba(255,77,77,0.12)',
  },
  signOutDisabled: {
    opacity: 0.55,
  },
  signOutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  signOutIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,77,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.22)',
  },
  signOutLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.danger,
  },
  brandFooter: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  brandRuleRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  brandRule: {
    width: 160,
    height: 1,
  },
  brandCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandWord: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 3.2,
    color: colors.text,
  },
  brandDot: {
    width: 4,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  brandPlace: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.8,
    color: colors.accent,
  },
});
