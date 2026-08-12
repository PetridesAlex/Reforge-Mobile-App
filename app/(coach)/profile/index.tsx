import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { Avatar } from '@/components/ui/Avatar';
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
import { colors, radius, spacing, typography } from '@/constants/theme';

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

      <SectionHeader title="Account" />
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

      <SectionHeader title="Studio" />
      {loadingSettings ? (
        <Skeleton height={120} style={{ marginBottom: spacing.md }} />
      ) : (
        <AppCard style={styles.card}>
          <InfoRow label="Studio" value={settings?.name ?? 'REFORGE Limassol'} />
          <InfoRow label="Location" value={settings?.location ?? 'Limassol, Cyprus'} />
          <InfoRow
            label="Access"
            value={isAdmin ? 'Owner — full studio control' : 'Trainer — assigned clients'}
          />
          <InfoRow label="Membership label" value={settings?.membershipLabel ?? 'REFORGE Strength'} />
          {settings ? (
            <>
              <InfoRow label="Hours" value={`${settings.openTime} – ${settings.closeTime}`} />
              <InfoRow label="Open days" value={weekLabel || '—'} />
              <InfoRow
                label="Member booking"
                value={settings.allowMemberBooking ? 'Enabled' : 'Disabled'}
              />
              <InfoRow
                label="Group chat"
                value={settings.groupChatEnabled ? 'Enabled' : 'Disabled'}
              />
            </>
          ) : (
            <InfoRow label="Role" value={isAdmin ? 'Admin' : 'Coach'} />
          )}
          {isAdmin ? (
            <Pressable
              onPress={() => router.push('/(coach)/admin/settings')}
              style={styles.inlineLink}>
              <Text style={styles.inlineLinkText}>Edit studio settings →</Text>
            </Pressable>
          ) : null}
        </AppCard>
      )}

      <SectionHeader title={isAdmin ? 'Studio tools' : 'Shortcuts'} />
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
            <Text style={styles.chevron}>›</Text>
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
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <PrimaryButton
        title={signingOut ? 'Signing out…' : 'Sign out'}
        variant="secondary"
        onPress={async () => {
          setSigningOut(true);
          try {
            await signOut();
            router.replace('/(auth)/login');
          } finally {
            setSigningOut(false);
          }
        }}
        disabled={signingOut}
        style={styles.signOut}
      />

      <View style={styles.brandFooter}>
        <ReforgeLogo width={120} height={32} />
        <Text style={styles.brandCaption}>
          {isAdmin ? 'Andreas Petrides · Owner' : 'Andreas Petrides · Trainer'} · Limassol
        </Text>
      </View>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  infoRow: {
    gap: 2,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
    fontSize: 15,
  },
  inlineLink: {
    paddingTop: spacing.xs,
  },
  inlineLinkText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
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
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
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
