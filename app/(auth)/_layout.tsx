import { Redirect, Stack } from 'expo-router';

import { AppPreload } from '@/components/ui/AppPreload';
import { postAuthRoute, useAuth } from '@/hooks/useAuth';
import { colors } from '@/constants/theme';

export default function AuthLayout() {
  const { isLoading, isAuthenticated, profile } = useAuth();

  if (isLoading) {
    return <AppPreload userName={profile?.full_name} />;
  }

  if (isAuthenticated) {
    return <Redirect href={postAuthRoute(profile)} />;
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
