import { Redirect, Stack } from 'expo-router';

import { AppPreload } from '@/components/ui/AppPreload';
import { homeRouteForRole, useAuth } from '@/hooks/useAuth';
import { colors } from '@/constants/theme';

export default function AuthLayout() {
  const { isLoading, isAuthenticated, role, profile } = useAuth();

  if (isLoading) {
    return <AppPreload userName={profile?.full_name} />;
  }

  if (isAuthenticated) {
    return <Redirect href={homeRouteForRole(role)} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
