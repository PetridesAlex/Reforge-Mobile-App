import { Redirect, Tabs } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { MemberAppGuide } from '@/components/onboarding/MemberAppGuide';
import { AppTabBar } from '@/components/ui/AppTabBar';
import {
  BarbellTabIcon,
  HomeTabIcon,
  ProfileTabIcon,
  ProgressTabIcon,
} from '@/components/ui/TabIcons';
import { useAuth } from '@/hooks/useAuth';
import { hasCompletedAppOnboarding, completeMemberAppOnboarding } from '@/services/onboarding';
import { colors } from '@/constants/theme';

export default function MemberLayout() {
  const { isLoading, isAuthenticated, role, profile, refreshProfile } = useAuth();
  const [guideDismissed, setGuideDismissed] = useState(false);

  const showAppGuide =
    !guideDismissed &&
    Boolean(profile) &&
    profile?.role === 'member' &&
    !hasCompletedAppOnboarding(profile);

  const finishGuide = useCallback(async () => {
    if (!profile) return;
    setGuideDismissed(true);
    try {
      await completeMemberAppOnboarding(profile.id);
      await refreshProfile();
    } catch {
      // Guide stays dismissed for this session even if persistence fails.
    }
  }, [profile, refreshProfile]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (role === 'coach' || role === 'admin') {
    return <Redirect href="/(coach)" />;
  }

  return (
    <>
      <Tabs
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <HomeTabIcon color={color} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="workouts"
          options={{
            title: 'Workouts',
            tabBarLabel: 'Workouts',
            tabBarIcon: ({ color, focused }) => (
              <BarbellTabIcon color={color} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarLabel: 'Progress',
            tabBarIcon: ({ color, focused }) => (
              <ProgressTabIcon color={color} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <ProfileTabIcon color={color} filled={focused} />
            ),
          }}
        />
        {/* Available via top-right More menu */}
        <Tabs.Screen name="bookings" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
      </Tabs>

      <MemberAppGuide
        visible={showAppGuide}
        memberName={profile?.full_name}
        onComplete={finishGuide}
        onSkip={finishGuide}
      />
    </>
  );
}
