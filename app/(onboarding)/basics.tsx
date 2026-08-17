import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingHeader } from '@/components/onboarding/profile/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { OnboardingOptionCard } from '@/components/onboarding/profile/OnboardingOptionCard';
import { OnboardingProgress } from '@/components/onboarding/profile/OnboardingProgress';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';
import { AppInput } from '@/components/ui/AppInput';
import { useAuth } from '@/hooks/useAuth';
import { GENDER_OPTIONS } from '@/lib/onboarding/types';
import { pickAvatarImage } from '@/lib/utils/pickAvatar';
import * as memberOnboarding from '@/services/memberOnboarding';
import type { MemberGender } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function OnboardingBasicsScreen() {
  const { profile, updateAvatar, refreshProfile } = useAuth();
  const { draft, patchDraft, saveStep, saving, error, setError } = useOnboarding();
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const first = draft.first_name ?? '';
  const last = draft.last_name ?? '';
  const username = draft.username ?? '';
  const dob = draft.date_of_birth ?? '';
  const gender = draft.gender ?? null;

  const pickPhoto = async () => {
    if (!profile) return;
    const uri = await pickAvatarImage();
    if (!uri) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await updateAvatar(uri);
      patchDraft({ avatar_url: updated.avatar_url });
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  };

  const continueNext = async () => {
    setLocalError(null);
    setError(null);
    if (!first.trim() || !last.trim()) {
      setLocalError('Enter your first and last name');
      return;
    }
    if (!username.trim()) {
      setLocalError('Choose a username');
      return;
    }
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setLocalError('Date of birth must be YYYY-MM-DD');
      return;
    }
    if (!gender) {
      setLocalError('Select your gender');
      return;
    }

    const availability = await memberOnboarding.checkUsernameAvailable(username, profile?.id);
    if (!availability.available) {
      setLocalError(availability.reason ?? 'Username unavailable');
      return;
    }

    try {
      await saveStep(3, {
        first_name: first.trim(),
        last_name: last.trim(),
        username: username.trim(),
        date_of_birth: dob,
        gender,
      });
      router.push('/(onboarding)/height');
    } catch {
      // error set in context
    }
  };

  return (
    <OnboardingLayout
      footer={
        <OnboardingFooter
          primaryLabel="Continue"
          onPrimary={() => void continueNext()}
          loading={saving || uploading}
          error={localError || error}
        />
      }>
      <OnboardingProgress step={2} />
      <OnboardingHeader
        kicker="IDENTITY"
        title="The basics"
        subtitle="Name, username, and identity so coaches know who you are."
      />

      <Pressable onPress={() => void pickPhoto()} style={styles.avatarBtn}>
        {draft.avatar_url ? (
          <Image source={{ uri: draft.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="camera-outline" size={28} color={colors.accent} />
          </View>
        )}
        <Text style={styles.avatarHint}>{draft.avatar_url ? 'Change photo' : 'Add photo (optional)'}</Text>
      </Pressable>

      <AppInput
        label="First name"
        value={first}
        onChangeText={(v) => patchDraft({ first_name: v })}
        autoCapitalize="words"
      />
      <AppInput
        label="Last name"
        value={last}
        onChangeText={(v) => patchDraft({ last_name: v })}
        autoCapitalize="words"
      />
      <AppInput
        label="Username"
        value={username}
        onChangeText={(v) => patchDraft({ username: v.replace(/\s/g, '') })}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AppInput
        label="Date of birth"
        value={dob}
        onChangeText={(v) => patchDraft({ date_of_birth: v })}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />

      <Text style={styles.sectionLabel}>Gender</Text>
      <View style={styles.list}>
        {GENDER_OPTIONS.map((opt, index) => (
          <OnboardingOptionCard
            key={opt.id}
            index={index}
            label={opt.label}
            selected={gender === opt.id}
            onPress={() => patchDraft({ gender: opt.id as MemberGender })}
          />
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  avatarBtn: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
  },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  list: {
    gap: spacing.sm,
  },
});
