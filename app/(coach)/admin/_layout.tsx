import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { canManageStudio } from '@/lib/permissions';
import { colors } from '@/constants/theme';

export default function AdminLayout() {
  const { role, isLoading } = useAuth();

  if (!isLoading && !canManageStudio(role)) {
    return <Redirect href="/(coach)" />;
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
