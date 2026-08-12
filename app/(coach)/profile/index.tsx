import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { Avatar } from '@/components/ui/Avatar';
import { NavChevron } from '@/components/ui/BackButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { canManageStudio } from '@/lib/permissions';
import { pickAvatarImage } from '@/lib/utils/pickAvatar';
import * as adminService from '@/services/admin';
import type { StudioSettings } from '@/services/mock/data';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type LinkItem = {
  key: string;
  title: string;
  meta: string;
  mark: string;
  href: string;
};

const ADMIN_LINKS: LinkItem[] = [
  { key: 'memberships', title: 'Memberships', meta: 'Paid & unpaid clients', mark: '$', href: '/(coach)/admin/memberships' },
  { key: 'classes', title: 'Classes', meta: 'Group & private sessions', mark: 'C', href: '/(coach)/admin/classes' },
  { key: 'chat', title: 'Class chats', meta: 'Moderate WhatsApp groups', mark: '@', href: '/(coach)/messages' },
  { key: 'wod', title: 'WOD', meta: 'Workout of the day', mark: 'D', href: '/(coach)/admin/wod' },
  { key: 'settings', title: 'Studio settings', meta: 'Hours, access, branding', mark: 'S', href: '/(coach)/admin/settings' },
  { key: 'members', title: 'Members & classes', meta: 'Roster, invites, schedules', mark: 'M', href: '/(coach)/clients' },
  { key: 'workouts', title: 'Workouts', meta: 'Weekly training plan', mark: 'W', href: '/(coach)/programs' },
  { key: 'schedule', title: 'Schedule', meta: 'Premium week plan', mark: 'K', href: '/(coach)/admin/schedule' },
  { key: 'news', title: 'News', meta: 'Posts for members', mark: 'N', href: '/(coach)/admin/news' },
  { key: 'challenges', title: 'Challenges', meta: 'Gym competitions', mark: 'G', href: '/(coach)/admin/challenges' },
  { key: 'staff', title: 'Staff', meta: 'Coaches and roles', mark: 'T', href: '/(coach)/admin/staff' },
];

const COACH_LINKS: LinkItem[] = [
  { key: 'clients', title: 'Clients', meta: 'Your assigned athletes', mark: 'C', href: '/(coach)/clients' },
  { key: 'calendar', title: 'Calendar', meta: 'Sessions & availability', mark: 'K', href: '/(coach)/calendar' },
  { key: 'chat', title: 'Class chats', meta: 'Message your groups', mark: '@', href: '/(coach)/messages' },
  { key: 'programs', title: 'Programs', meta: 'Training plans', mark: 'P', href: '/(coach)/programs' },
];

export default function CoachProfileScreen() {
  const { profile, signOut, updateAvatar, updateProfile } = useAuth();
  const isAdmin = canManageStudio(profile?.role);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(isAdmin);
  const [signingOut, setSigningOut] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  const loadSettings = useCallback(async () => {
    if (!isAdmin) {
      setLoadingSettings(false);
      return;
    }
    try {
      setSettings(await adminService.getStudioSettings());
    } finally {
      setLoadingSettings(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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

  const onSaveProfile = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const links = isAdmin ? ADMIN_LINKS : COACH_LINKS;
  const weekLabel = settings
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .filter((_, i) => settings.workingDays.includes(i))
        .join(' · ')
    : null;

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
        <View style={[styles.rolePill, isAdmin && styles.rolePillAdmin]}>
          <View style={styles.roleDot} />
          <Text style={styles.rolePillText}>{isAdmin ? 'ADMIN' : 'COACH'}</Text>
        </View>
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
        <Text style={styles.email}>{profile?.email}</Text>
        <Text style={styles.uploadHint}>
          {uploading ? 'Updating photo…' : 'Tap photo to change'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.saved}>Profile saved</Text> : null}
      </View>

      <SectionHeader title="Account" kicker="Profile" />
      <AppCard style={styles.card}>
        <AppInput label="Full name" value={fullName} onChangeText={setFullName} />
        <AppInput label="Email" value={profile?.email ?? ''} editable={false} />
        <AppInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="+357 ..."
          keyboardType="phone-pad"
        />
        <PrimaryButton
          title={saving ? 'Saving…' : 'Save profile'}
          onPress={onSaveProfile}
          disabled={saving}
          style={styles.saveBtn}
        />
      </AppCard>

      <SectionHeader title="Studio" kicker="Operations" />
      {loadingSettings ? (
        <Skeleton height={180} style={{ marginBottom: spacing.md }} />
      ) : (
        <View style={styles.studioCard}>
          <LinearGradient
            colors={['rgba(200,255,0,0.2)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.studioSheen}
          />
          <View style={styles.studioIdentity}>
            <View style={styles.studioMark}>
              <Ionicons name="business-outline" size={20} color={colors.background} />
            </View>
            <View style={styles.studioIdentityCopy}>
              <Text style={styles.studioName}>{settings?.name ?? 'REFORGE Limassol'}</Text>
              <Text style={styles.studioLocation}>{settings?.location ?? 'Limassol, Cyprus'}</Text>
            </View>
            <View style={[styles.accessChip, isAdmin ? styles.accessChipOwner : styles.accessChipCoach]}>
              <Text style={styles.accessChipText}>{isAdmin ? 'Owner' : 'Trainer'}</Text>
            </View>
          </View>

          <View style={styles.studioFlags}>
            <View style={styles.flagPill}>
              <View
                style={[
                  styles.flagDot,
                  settings?.allowMemberBooking ? styles.flagDotOn : styles.flagDotOff,
                ]}
              />
              <Text style={styles.flagText}>
                Booking {settings?.allowMemberBooking ? 'on' : 'off'}
              </Text>
            </View>
            <View style={styles.flagPill}>
              <View
                style={[
                  styles.flagDot,
                  settings?.groupChatEnabled ? styles.flagDotOn : styles.flagDotOff,
                ]}
              />
              <Text style={styles.flagText}>
                Chat {settings?.groupChatEnabled ? 'on' : 'off'}
              </Text>
            </View>
          </View>

          <View style={styles.studioGrid}>
            <StudioMetric
              icon="pricetag-outline"
              label="Membership"
              value={settings?.membershipLabel ?? 'REFORGE Strength'}
            />
            <StudioMetric
              icon="time-outline"
              label="Hours"
              value={settings ? `${settings.openTime} – ${settings.closeTime}` : '—'}
            />
            <StudioMetric
              icon="calendar-outline"
              label="Open days"
              value={weekLabel || '—'}
            />
            <StudioMetric
              icon="shield-checkmark-outline"
              label="Access"
              value={isAdmin ? 'Full studio control' : 'Assigned clients'}
            />
          </View>

          {isAdmin ? (
            <Pressable
              onPress={() => router.push('/(coach)/admin/settings')}
              style={({ pressed }) => [styles.studioCta, pressed && styles.studioCtaPressed]}>
              <View style={styles.studioCtaIcon}>
                <Ionicons name="settings-outline" size={16} color={colors.background} />
              </View>
              <View style={styles.studioCtaCopy}>
                <Text style={styles.studioCtaTitle}>Edit studio settings</Text>
                <Text style={styles.studioCtaSub}>Hours, access & branding</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.background} />
            </Pressable>
          ) : null}
        </View>
      )}

      <SectionHeader title={isAdmin ? 'Studio tools' : 'Shortcuts'} kicker="Navigate" />
      <View style={styles.linkList}>
        {links.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.href as never)}
            style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
            <View style={styles.linkMark}>
              <Text style={styles.linkMarkText}>{item.mark}</Text>
            </View>
            <View style={styles.linkCopy}>
              <Text style={styles.linkTitle}>{item.title}</Text>
              <Text style={styles.linkMeta}>{item.meta}</Text>
            </View>
            <NavChevron size="sm" />
          </Pressable>
        ))}
        <Pressable
          onPress={onUpload}
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
          <View style={styles.linkMark}>
            <Text style={styles.linkMarkText}>P</Text>
          </View>
          <View style={styles.linkCopy}>
            <Text style={styles.linkTitle}>
              {uploading ? 'Uploading photo…' : 'Change profile photo'}
            </Text>
            <Text style={styles.linkMeta}>Update your avatar</Text>
          </View>
          <NavChevron size="sm" />
        </Pressable>
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
        <Text style={styles.brandRole}>
          {isAdmin ? 'Owner access' : 'Trainer access'}
        </Text>
      </Animated.View>
    </Screen>
  );
}

function StudioMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.studioMetric}>
      <View style={styles.studioMetricIcon}>
        <Ionicons name={icon} size={14} color={colors.accent} />
      </View>
      <Text style={styles.studioMetricLabel}>{label}</Text>
      <Text style={styles.studioMetricValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  topLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rolePillAdmin: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: colors.accentMuted,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  rolePillText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 10,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: {
    ...typography.title,
    color: colors.text,
    fontSize: 26,
    textAlign: 'center',
  },
  email: {
    ...typography.body,
    color: colors.textSecondary,
  },
  uploadHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  saved: {
    ...typography.caption,
    color: colors.success,
  },
  card: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  saveBtn: {
    marginTop: spacing.xs,
  },
  studioCard: {
    marginBottom: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    overflow: 'hidden',
    gap: spacing.md,
  },
  studioSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  studioIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  studioMark: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioIdentityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  studioName: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.2,
  },
  studioLocation: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  accessChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  accessChipOwner: {
    backgroundColor: colors.accentMuted,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  accessChipCoach: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
  },
  accessChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  studioFlags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  flagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  flagDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  flagDotOn: {
    backgroundColor: colors.success,
  },
  flagDotOff: {
    backgroundColor: colors.textMuted,
  },
  flagText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  studioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  studioMetric: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  studioMetricIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    marginBottom: 2,
  },
  studioMetricLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  studioMetricValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  studioCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  studioCtaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  studioCtaIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  studioCtaCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  studioCtaTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.background,
  },
  studioCtaSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: 'rgba(10,10,10,0.62)',
  },
  linkList: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.9,
  },
  linkMark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  linkMarkText: {
    ...typography.subtitle,
    color: colors.accent,
    fontSize: 14,
  },
  linkCopy: {
    flex: 1,
    gap: 2,
  },
  linkTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  linkMeta: {
    ...typography.caption,
    color: colors.textMuted,
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
  brandRole: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
});
