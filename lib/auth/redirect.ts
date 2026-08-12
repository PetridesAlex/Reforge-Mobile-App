import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const APP_SCHEME = 'reforge';

function webAuthCallbackUrl(): string | null {
  if (typeof window === 'undefined' || !window.location?.origin) return null;
  return `${window.location.origin}/auth/callback`;
}

/** Deep link Supabase redirects to after email confirm / OAuth / magic link. */
export function getAuthCallbackUrl(): string {
  if (Platform.OS === 'web') {
    return webAuthCallbackUrl() ?? `${APP_SCHEME}://auth/callback`;
  }

  const nativeUri = makeRedirectUri({
    scheme: APP_SCHEME,
    path: 'auth/callback',
    preferLocalhost: false,
  });

  if (nativeUri.startsWith(`${APP_SCHEME}://`)) {
    return nativeUri;
  }

  return Linking.createURL('auth/callback');
}

export function getPasswordResetUrl(): string {
  if (Platform.OS === 'web') {
    const origin = typeof window !== 'undefined' ? window.location?.origin : null;
    if (origin) return `${origin}/reset-password`;
  }

  const nativeUri = makeRedirectUri({
    scheme: APP_SCHEME,
    path: 'reset-password',
    preferLocalhost: false,
  });

  if (nativeUri.startsWith(`${APP_SCHEME}://`)) {
    return nativeUri;
  }

  return Linking.createURL('reset-password');
}

/** URLs passed to WebBrowser.openAuthSessionAsync must match redirectTo. */
export function getOAuthReturnUrl(): string {
  return getAuthCallbackUrl();
}
