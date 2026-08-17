import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { MessageToast } from '@/components/community/MessageToast';
import { AppTabBar } from '@/components/ui/AppTabBar';
import {
  BarbellTabIcon,
  CalendarTabIcon,
  ChatTabIcon,
  GridTabIcon,
  PeopleTabIcon,
} from '@/components/ui/TabIcons';
import { useAuth } from '@/hooks/useAuth';
import { useMessageToast } from '@/hooks/useMessageToast';
import { isAdmin } from '@/lib/permissions';
import { colors } from '@/constants/theme';

export default function CoachLayout() {
  const { isLoading, isAuthenticated, role, profile } = useAuth();
  const { toast, dismiss, open } = useMessageToast(
    role === 'coach' || role === 'admin' ? profile?.id : undefined,
    { role },
  );

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

  if (role === 'member') {
    return <Redirect href="/(member)" />;
  }

  return (
    <View style={{ flex: 1 }}>
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
            title: isAdmin(role) ? 'Studio' : 'Dashboard',
            tabBarLabel: isAdmin(role) ? 'Studio' : 'Base',
            tabBarIcon: ({ color, focused }) => (
              <GridTabIcon color={color} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: isAdmin(role) ? 'Members' : 'Clients',
            tabBarLabel: isAdmin(role) ? 'Roster' : 'Clients',
            tabBarIcon: ({ color, focused }) => (
              <PeopleTabIcon color={color} filled={focused} />
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
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarLabel: 'Calendar',
            tabBarIcon: ({ color, focused }) => (
              <CalendarTabIcon color={color} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="programs"
          options={{
            title: 'Programs',
            tabBarLabel: 'Programs',
            tabBarIcon: ({ color, focused }) => (
              <BarbellTabIcon color={color} filled={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            href: null,
          }}
        />
        <Tabs.Screen name="exercises" options={{ href: null }} />
        <Tabs.Screen name="admin" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen name="challenges" options={{ href: null }} />
        <Tabs.Screen name="achievements" options={{ href: null }} />
      </Tabs>
      <MessageToast notification={toast} onPress={(n) => void open(n)} onDismiss={dismiss} />
    </View>
  );
}
