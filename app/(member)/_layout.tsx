import { Redirect, Tabs } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { MessageToast } from '@/components/community/MessageToast';
import { MemberAppGuide } from '@/components/onboarding/MemberAppGuide';
import { AppTabBar } from '@/components/ui/AppTabBar';
import {
  BarbellTabIcon,
  ChatTabIcon,
  HomeTabIcon,
  ProfileTabIcon,
  ProgressTabIcon,
} from '@/components/ui/TabIcons';
import { postAuthRoute, useAuth } from '@/hooks/useAuth';
import { needsProfileOnboarding } from '@/services/memberOnboarding';
import { useMessageToast } from '@/hooks/useMessageToast';
import { StoreCartProvider } from '@/hooks/useStoreCart';
import { hasCompletedAppOnboarding, completeMemberAppOnboarding } from '@/services/onboarding';
import { colors } from '@/constants/theme';

export default function MemberLayout() {
  const { isLoading, isAuthenticated, role, profile, refreshProfile } = useAuth();
  const { toast, dismiss, open } = useMessageToast(
    role === 'member' ? profile?.id : undefined,
    { role },
  );
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

  if (needsProfileOnboarding(profile)) {
    return <Redirect href={postAuthRoute(profile)} />;
  }

  return (
    <StoreCartProvider userId={profile?.id}>
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
            title: 'Train',
            tabBarLabel: 'Train',
            tabBarIcon: ({ color, focused }) => (
              <BarbellTabIcon color={color} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
            tabBarLabel: 'Community',
            tabBarIcon: ({ color, focused }) => (
              <ChatTabIcon color={color} filled={focused} />
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
        {/* Available via Community hub / More menu */}
        <Tabs.Screen name="bookings" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen name="store" options={{ href: null }} />
        <Tabs.Screen name="challenges" options={{ href: null }} />
        <Tabs.Screen name="achievements" options={{ href: null }} />
        <Tabs.Screen name="league" options={{ href: null }} />
      </Tabs>

      <MessageToast notification={toast} onPress={(n) => void open(n)} onDismiss={dismiss} />

      <MemberAppGuide
        visible={showAppGuide}
        memberName={profile?.full_name}
        onComplete={finishGuide}
        onSkip={finishGuide}
      />
    </StoreCartProvider>
  );
}
