import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppTabBar } from '@/components/ui/AppTabBar';
import {
  BarbellTabIcon,
  HomeTabIcon,
  ProfileTabIcon,
  ProgressTabIcon,
} from '@/components/ui/TabIcons';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/constants/theme';

export default function MemberLayout() {
  const { isLoading, isAuthenticated, role } = useAuth();

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
  );
}
