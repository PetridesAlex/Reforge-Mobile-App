import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MemberAppGuide } from '@/components/onboarding/MemberAppGuide';
import { PerformanceBuildProfile } from '@/components/performance/PerformanceBuildProfile';
import { AppCard } from '@/components/ui/AppCard';
import { Avatar } from '@/components/ui/Avatar';
import { MoreMenu } from '@/components/ui/MoreMenu';
import { PersonIcon } from '@/components/ui/PersonIcon';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useAuth } from '@/hooks/useAuth';
import { pickAvatarImage } from '@/lib/utils/pickAvatar';
import * as community from '@/services/community';
import * as memberService from '@/services/member';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const MENU_ITEMS = [
  { id: 'sessions', label: 'Sessions', icon: 'calendar-outline' as const, href: '/(member)/bookings' },
  { id: 'absence', label: 'Report absence', icon: 'calendar-clear-outline' as const, href: '/(member)/workouts/absences' },
  { id: 'chat', label: 'Group Chat', icon: 'chatbubbles-outline' as const, href: '/(member)/messages' },
  { id: '1', label: 'Notifications', icon: 'notifications-outline' as const },
  { id: '2', label: 'Change password', icon: 'key-outline' as const, href: '/(auth)/reset-password' },
  { id: '3', label: 'Privacy', icon: 'shield-outline' as const },
  { id: '4', label: 'Terms', icon: 'document-text-outline' as const },
];

export default function ProfileScreen() {
  const { profile, signOut, updateAvatar } = useAuth();
  const [coachName, setCoachName] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
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
    if (!profile) return;
    memberService.getMemberProfileExtras(profile.id).then((extras) => {
      setCoachName(extras.coach?.full_name ?? null);
      setPlan(extras.programName ?? extras.membership);
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

      {/* Public profile header */}
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
          <Text style={styles.membershipText}>{plan ?? 'REFORGE Member'}</Text>
        </View>
        <Text style={styles.uploadHint}>
          {uploading ? 'Updating photo…' : 'Tap photo to change'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {/* Contact details below */}
      <SectionHeader title="Contact" kicker="Account" />
      <View style={styles.premiumCard}>
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
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="call-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile?.phone ?? 'Not added'}</Text>
          </View>
        </View>
      </View>

      {/* Performance build profile */}
      <SectionHeader title="Performance build" kicker="Analytics" />
      {performanceStats ? (
        <PerformanceBuildProfile
          stats={performanceStats}
          performance={performanceStats.performance}
          memberName={profile?.full_name}
          compact
        />
      ) : null}

      {/* Training info */}
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
            <Text style={styles.infoValue}>{plan ?? 'No active plan'}</Text>
          </View>
          {plan ? (
            <View style={styles.activeChip}>
              <View style={styles.activeDot} />
              <Text style={styles.activeChipText}>Active</Text>
            </View>
          ) : null}
        </View>
      </View>

      <SectionHeader title="Settings" />
      <View style={styles.menu}>
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
        <ReforgeLogo width={128} height={32} />
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
  uploadHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
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
