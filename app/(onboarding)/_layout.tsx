import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { OnboardingProvider, useOnboarding } from '@/components/onboarding/profile/OnboardingContext';
import { AppPreload } from '@/components/ui/AppPreload';
import { useAuth } from '@/hooks/useAuth';
import { routeForOnboardingStep } from '@/lib/onboarding/types';
import { needsProfileOnboarding } from '@/services/memberOnboarding';
import { colors } from '@/constants/theme';

function ResumeRedirect({ step }: { step: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready } = useOnboarding();

  useEffect(() => {
    if (!ready) return;
    const target = routeForOnboardingStep(step);
    if (step > 1 && (pathname === '/' || pathname === '/(onboarding)' || pathname.endsWith('/onboarding'))) {
      router.replace(target as never);
    }
  }, [pathname, ready, router, step]);

  return null;
}

function OnboardingGate({ children }: { children: ReactNode }) {
  const { ready } = useOnboarding();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function OnboardingLayout() {
  const { isLoading, isAuthenticated, profile, role } = useAuth();

  if (isLoading) {
    return <AppPreload userName={profile?.full_name} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (role === 'coach' || role === 'admin') {
    return <Redirect href="/(coach)" />;
  }

  if (!needsProfileOnboarding(profile)) {
    return <Redirect href="/(member)" />;
  }

  if (!profile?.id) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <OnboardingProvider profileId={profile.id}>
      <OnboardingGate>
        <ResumeRedirect step={profile.onboarding_step ?? 1} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        />
      </OnboardingGate>
    </OnboardingProvider>
  );
}
