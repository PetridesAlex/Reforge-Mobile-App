import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MemberAppGuide } from '@/components/onboarding/MemberAppGuide';
import { PerformanceBuildProfile } from '@/components/performance/PerformanceBuildProfile';
import { AppCard } from '@/components/ui/AppCard';
import { Avatar } from '@/components/ui/Avatar';
import { MoreMenu } from '@/components/ui/MoreMenu';
import { PersonIcon } from '@/components/ui/PersonIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useAuth } from '@/hooks/useAuth';
import { pickAvatarImage } from '@/lib/utils/pickAvatar';
import * as community from '@/services/community';
import * as memberService from '@/services/member';
import { colors, radius, spacing, typography } from '@/constants/theme';

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

  const onSignOut = async () => {
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
      <SectionHeader title="Contact" />
      <AppCard style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="mail-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.email ?? '—'}</Text>
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
      </AppCard>

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

      <SectionHeader title="Training" />
      <AppCard style={styles.infoCard}>
        <Pressable onPress={() => void onMessageCoach()} style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <PersonIcon size={18} color={colors.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Coach</Text>
            <Text style={styles.infoValue}>{coachName ?? 'Studio coach'}</Text>
            <Text style={styles.infoHint}>
              {messagingCoach ? 'Opening chat…' : 'Tap to message your coach'}
            </Text>
          </View>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accent} />
        </Pressable>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="barbell-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>Program</Text>
            <Text style={styles.infoValue}>{plan ?? 'No active plan'}</Text>
          </View>
        </View>
      </AppCard>

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

      <PrimaryButton
        title={signingOut ? 'Signing out…' : 'Sign Out'}
        variant="secondary"
        onPress={onSignOut}
        disabled={signingOut}
        style={styles.signOut}
      />

      <View style={styles.brandFooter}>
        <ReforgeLogo width={110} height={28} />
        <Text style={styles.brandCaption}>REFORGE · Limassol</Text>
      </View>

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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  infoHint: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 52,
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
    marginBottom: spacing.lg,
  },
  brandFooter: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  brandCaption: {
    ...typography.label,
    color: colors.textMuted,
  },
});
