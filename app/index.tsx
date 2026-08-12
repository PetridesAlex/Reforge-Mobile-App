import { Redirect } from 'expo-router';

import { AppPreload } from '@/components/ui/AppPreload';
import { homeRouteForRole, useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { isLoading, isAuthenticated, role, profile } = useAuth();

  if (isLoading) {
    return <AppPreload userName={profile?.full_name} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href={homeRouteForRole(role)} />;
}
